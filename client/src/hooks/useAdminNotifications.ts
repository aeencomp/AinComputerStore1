import { useState, useEffect, useCallback, useRef } from 'react';

export interface OrderNotification {
  type: 'new_order' | 'order_update';
  data: {
    orderId: string;
    orderNumber: string;
    customerName: string;
    total: string;
    createdAt: string;
  };
  timestamp: string;
  read: boolean;
}

export function useAdminNotifications(wsPath: string = '/ws/admin') {
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${wsPath}`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log(`Notifications connected (${wsPath})`);
        setIsConnected(true);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'new_order') {
            const notification: OrderNotification = {
              ...data,
              read: false,
            };
            setNotifications((prev) => [notification, ...prev].slice(0, 50));
          }
        } catch (error) {
          console.error('Failed to parse notification:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log(`Notifications disconnected (${wsPath})`);
        setIsConnected(false);
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 5000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [wsPath]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const markAsRead = useCallback((timestamp: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.timestamp === timestamp ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  };
}
