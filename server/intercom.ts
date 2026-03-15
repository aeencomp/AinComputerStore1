import { WebSocketServer, WebSocket } from 'ws';
import { Server, IncomingMessage } from 'http';
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';
import type { Duplex } from 'stream';

interface IntercomClient {
  ws: WebSocket;
  peerId: string;
  displayName: string;
  portal: 'admin' | 'sales' | 'technician';
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

function parseSessionId(signedCookie: string): string | null {
  if (!signedCookie.startsWith('s:')) return null;
  const value = signedCookie.slice(2);
  const dotIndex = value.lastIndexOf('.');
  if (dotIndex === -1) return null;
  return value.slice(0, dotIndex);
}

class IntercomService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, IntercomClient> = new Map();
  private sql: ReturnType<typeof neon> | null = null;

  initialize(_server: Server) {
    if (process.env.DATABASE_URL) {
      this.sql = neon(process.env.DATABASE_URL);
    }

    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const userInfo = (req as any)._intercomUser as { displayName: string; portal: 'admin' | 'sales' | 'technician' };
      const peerId = randomUUID();

      const client: IntercomClient = {
        ws,
        peerId,
        displayName: userInfo.displayName,
        portal: userInfo.portal,
      };

      this.clients.set(peerId, client);
      console.log(`Intercom: ${userInfo.portal}/${userInfo.displayName} connected (${peerId})`);

      ws.send(JSON.stringify({ type: 'welcome', peerId }));
      this.broadcastPresence();

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          this.handleMessage(peerId, msg);
        } catch (e) {
          console.error('Intercom: invalid message', e);
        }
      });

      ws.on('close', () => {
        console.log(`Intercom: ${userInfo.portal}/${userInfo.displayName} disconnected`);
        this.clients.delete(peerId);
        this.broadcastPresence();
      });

      ws.on('error', (err) => {
        console.error('Intercom WS error:', err);
        this.clients.delete(peerId);
        this.broadcastPresence();
      });
    });

    console.log('Intercom WebSocket server initialized on /ws/intercom (noServer mode)');
  }

  async handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const sessionCookie = cookies['connect.sid'];
      if (!sessionCookie) {
        console.log('Intercom: upgrade rejected - no session cookie');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      const sessionId = parseSessionId(sessionCookie);
      if (!sessionId) {
        console.log('Intercom: upgrade rejected - invalid session format');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      const userInfo = await this.resolveSession(sessionId);
      if (!userInfo) {
        console.log('Intercom: upgrade rejected - session not recognized as portal user');
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      (req as any)._intercomUser = userInfo;
      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        this.wss!.emit('connection', ws, req);
      });
    } catch (error) {
      console.error('Intercom: upgrade error:', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  }

  private handleMessage(fromPeerId: string, msg: any) {
    const { type, targetId, ...payload } = msg;

    if (type === 'call-request' || type === 'call-accept' || type === 'call-decline' ||
        type === 'offer' || type === 'answer' || type === 'ice-candidate' || type === 'call-end') {
      const target = this.clients.get(targetId);
      const sender = this.clients.get(fromPeerId);
      if (target && sender && target.ws.readyState === WebSocket.OPEN) {
        target.ws.send(JSON.stringify({
          type,
          fromPeerId,
          fromName: sender.displayName,
          fromPortal: sender.portal,
          ...payload,
        }));
      }
    }
  }

  private broadcastPresence() {
    const users = Array.from(this.clients.values()).map(c => ({
      peerId: c.peerId,
      displayName: c.displayName,
      portal: c.portal,
    }));

    const message = JSON.stringify({ type: 'presence', users });
    this.clients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  private async resolveSession(sessionId: string): Promise<{ displayName: string; portal: 'admin' | 'sales' | 'technician' } | null> {
    try {
      if (!this.sql) return null;
      const result = await this.sql`SELECT sess FROM "session" WHERE sid = ${sessionId}`;
      if (result.length === 0) return null;
      const session = result[0].sess as any;

      if (session?.adminId) {
        const admins = await this.sql`SELECT name FROM admin_users WHERE id = ${session.adminId}`;
        return { displayName: admins[0]?.name || 'Admin', portal: 'admin' };
      }

      if (session?.salesUserId) {
        const users = await this.sql`SELECT name FROM sales_users WHERE id = ${session.salesUserId}`;
        return { displayName: users[0]?.name || 'Sales', portal: 'sales' };
      }

      if (session?.technicianId) {
        const techs = await this.sql`SELECT display_name FROM technicians WHERE id = ${session.technicianId}`;
        return { displayName: techs[0]?.display_name || 'Technician', portal: 'technician' };
      }

      return null;
    } catch (error) {
      console.error('Intercom: session resolve error:', error);
      return null;
    }
  }
}

export const intercomService = new IntercomService();
