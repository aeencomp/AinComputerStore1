import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

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

class AdminNotificationService {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws/admin' });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Admin WebSocket client connected');
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

    console.log('Admin WebSocket server initialized on /ws/admin');
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
