import { WebSocketServer, WebSocket } from 'ws';
import { Server, IncomingMessage } from 'http';
import { neon } from '@neondatabase/serverless';
import type { Duplex } from 'stream';

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

function parseSessionId(signedCookie: string): string | null {
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
  private salesWss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private salesClients: Set<WebSocket> = new Set();
  private sql: ReturnType<typeof neon> | null = null;

  initialize(_server: Server) {
    if (process.env.DATABASE_URL) {
      this.sql = neon(process.env.DATABASE_URL);
    }

    this.wss = new WebSocketServer({ noServer: true });
    this.salesWss = new WebSocketServer({ noServer: true });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      ws.send(JSON.stringify({ type: 'connected', message: 'Connected to admin notifications' }));
    });

    this.salesWss.on('connection', (ws: WebSocket) => {
      this.salesClients.add(ws);

      ws.on('close', () => {
        this.salesClients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('Sales WebSocket error:', error);
        this.salesClients.delete(ws);
      });

      ws.send(JSON.stringify({ type: 'connected', message: 'Connected to sales notifications' }));
    });

    console.log('Admin/Sales WebSocket servers initialized (noServer mode)');
  }

  async handleAdminUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const sessionCookie = cookies['connect.sid'];
      if (!sessionCookie) {
        socket.destroy();
        return;
      }
      const sessionId = parseSessionId(sessionCookie);
      if (!sessionId) {
        socket.destroy();
        return;
      }
      const isAdmin = await this.verifyAdminSession(sessionId);
      if (!isAdmin) {
        socket.destroy();
        return;
      }
      console.log('WebSocket connection authorized for admin');
      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        this.wss!.emit('connection', ws, req);
      });
    } catch (error) {
      console.error('WebSocket auth error:', error);
      socket.destroy();
    }
  }

  async handleSalesUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const sessionCookie = cookies['connect.sid'];
      if (!sessionCookie) {
        socket.destroy();
        return;
      }
      const sessionId = parseSessionId(sessionCookie);
      if (!sessionId) {
        socket.destroy();
        return;
      }
      const isSales = await this.verifySalesSession(sessionId);
      if (!isSales) {
        socket.destroy();
        return;
      }
      console.log('WebSocket connection authorized for sales');
      this.salesWss!.handleUpgrade(req, socket, head, (ws) => {
        this.salesWss!.emit('connection', ws, req);
      });
    } catch (error) {
      console.error('Sales WebSocket auth error:', error);
      socket.destroy();
    }
  }

  private async verifyAdminSession(sessionId: string): Promise<boolean> {
    try {
      if (!this.sql) return false;
      const result = await this.sql`SELECT sess FROM "session" WHERE sid = ${sessionId}`;
      if (result.length === 0) return false;
      const session = result[0].sess as any;
      return session && typeof session.adminId === 'string' && session.adminId.length > 0;
    } catch (error) {
      console.error('Error verifying admin session:', error);
      return false;
    }
  }

  private async verifySalesSession(sessionId: string): Promise<boolean> {
    try {
      if (!this.sql) return false;
      const result = await this.sql`SELECT sess FROM "session" WHERE sid = ${sessionId}`;
      if (result.length === 0) return false;
      const session = result[0].sess as any;
      return session && typeof session.salesUserId === 'string' && session.salesUserId.length > 0;
    } catch (error) {
      console.error('Error verifying sales session:', error);
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
    
    let sent = 0;
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sent++;
      }
    });

    this.salesClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sent++;
      }
    });

    console.log(`Broadcasted new order notification: ${order.orderNumber} to ${sent} clients (${this.clients.size} admin, ${this.salesClients.size} sales)`);
  }

  getConnectedClientsCount(): number {
    return this.clients.size + this.salesClients.size;
  }
}

export const adminNotifications = new AdminNotificationService();
