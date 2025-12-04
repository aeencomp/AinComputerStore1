import { WebSocketServer, WebSocket } from 'ws';
import { Server, IncomingMessage } from 'http';
import { neon } from '@neondatabase/serverless';

interface AdminNotification {
  type: 'new_order' | 'order_update';
  data: {
    orderId: string;
    orderNumber: string;
    customerName: string;
    total: string;
    createdAt: string;
  };
  timestamp: string;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    const value = rest.join('=');
    if (name && value) {
      cookies[name.trim()] = decodeURIComponent(value.trim());
    }
  });
  
  return cookies;
}

function parseSessionId(signedCookie: string, secret: string): string | null {
  if (!signedCookie.startsWith('s:')) {
    return null;
  }
  
  const value = signedCookie.slice(2);
  const dotIndex = value.lastIndexOf('.');
  if (dotIndex === -1) {
    return null;
  }
  
  return value.slice(0, dotIndex);
}

class AdminNotificationService {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private sessionSecret: string = process.env.SESSION_SECRET || 'default-secret-please-change-in-production';
  private sql: ReturnType<typeof neon> | null = null;

  initialize(server: Server) {
    // Initialize neon HTTP client for session verification
    if (process.env.DATABASE_URL) {
      this.sql = neon(process.env.DATABASE_URL);
    }

    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws/admin',
      verifyClient: async (info, callback) => {
        try {
          const cookies = parseCookies(info.req.headers.cookie);
          const sessionCookie = cookies['connect.sid'];
          
          if (!sessionCookie) {
            console.log('WebSocket connection rejected: No session cookie');
            callback(false, 401, 'Unauthorized');
            return;
          }

          const sessionId = parseSessionId(sessionCookie, this.sessionSecret);
          if (!sessionId) {
            console.log('WebSocket connection rejected: Invalid session cookie');
            callback(false, 401, 'Unauthorized');
            return;
          }

          // Check if admin session exists in database
          const isAdmin = await this.verifyAdminSession(sessionId);
          if (!isAdmin) {
            console.log('WebSocket connection rejected: Not an admin session');
            callback(false, 403, 'Forbidden');
            return;
          }

          console.log('WebSocket connection authorized for admin');
          callback(true);
        } catch (error) {
          console.error('WebSocket auth error:', error);
          callback(false, 500, 'Internal Server Error');
        }
      }
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      console.log('Admin WebSocket client connected (authenticated)');
      this.clients.add(ws);

      ws.on('close', () => {
        console.log('Admin WebSocket client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      ws.send(JSON.stringify({ type: 'connected', message: 'Connected to admin notifications' }));
    });

    console.log('Admin WebSocket server initialized on /ws/admin (with authentication)');
  }

  private async verifyAdminSession(sessionId: string): Promise<boolean> {
    try {
      if (!this.sql) {
        console.error('Database not initialized for session verification');
        return false;
      }

      // Use neon HTTP client for session verification
      const result = await this.sql`SELECT sess FROM "session" WHERE sid = ${sessionId}`;
      
      if (result.length === 0) {
        return false;
      }

      const session = result[0].sess as any;
      // Check if session has adminId (set during admin login)
      return session && typeof session.adminId === 'string' && session.adminId.length > 0;
    } catch (error) {
      console.error('Error verifying admin session:', error);
      return false;
    }
  }

  broadcastNewOrder(order: {
    id: string;
    orderNumber: string;
    customerName: string;
    total: string;
    createdAt: string | Date;
  }) {
    const notification: AdminNotification = {
      type: 'new_order',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        total: order.total,
        createdAt: typeof order.createdAt === 'string' ? order.createdAt : order.createdAt.toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    const message = JSON.stringify(notification);
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    console.log(`Broadcasted new order notification: ${order.orderNumber} to ${this.clients.size} clients`);
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const adminNotifications = new AdminNotificationService();
