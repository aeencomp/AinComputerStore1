import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
const { Pool } = pg;

import { registerRoutes } from "./routes";

const PgStore = connectPgSimple(session);

// Create a dedicated pg pool for the session store with generous timeouts.
// Neon serverless databases wake from sleep slowly — without a longer timeout
// the first connection after inactivity throws "Authentication timed out".
const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 20000, // wait up to 20s for Neon cold start
  idleTimeoutMillis: 60000,
  max: 5,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Log pool errors instead of crashing
sessionPool.on('error', (err) => {
  console.error('[session-pool] idle client error:', err.message);
});

declare module "express-session" {
  interface SessionData {
    userId?: string;
    cartInitialized?: boolean;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const app = express();

// Trust proxy - required for secure cookies behind Replit's reverse proxy
app.set('trust proxy', 1);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

app.use(session({
  store: new PgStore({
    pool: sessionPool,
    createTableIfMissing: true,
    errorLog: (err: string) => console.error('[session-store]', err),
  }),
  secret: process.env.SESSION_SECRET || 'default-secret-please-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  const server = await registerRoutes(app);

  // Catch session store / DB connection errors and return a friendly response
  // instead of crashing the request with a raw pg error message.
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const message = err.message || "Internal Server Error";
    const isDbTimeout = message.includes('timed out') || message.includes('timeout') || message.includes('ECONNREFUSED');
    if (isDbTimeout) {
      console.error('[session-error] DB connection issue during request:', message);
      return res.status(503).json({ error: 'Service starting up, please refresh and try again.' });
    }
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ message });
    throw err;
  });

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
}
