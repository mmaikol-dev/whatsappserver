import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SessionStatusEvent {
  sessionId: string;
  status: string;
  timestamp: string;
  phone?: string;
  pushName?: string;
  connectedAt?: string;
  lastActiveAt?: string;
}

interface QRCodeEvent {
  sessionId: string;
  qrCode: string;
  timestamp: string;
}

interface MessageEvent {
  sessionId: string;
  message: Record<string, unknown>;
  timestamp: string;
}

interface WebSocketEvents {
  onSessionStatus?: (event: SessionStatusEvent) => void;
  onQRCode?: (event: QRCodeEvent) => void;
  onMessage?: (event: MessageEvent) => void;
}

type ServerMessage =
  | {
      type: 'event';
      payload: {
        event: string;
        sessionId: string;
        data: unknown;
      };
      timestamp: string;
    }
  | {
      type: 'subscribed' | 'unsubscribed' | 'error' | 'pong';
      timestamp?: string;
      [key: string]: unknown;
    };

// Use current origin for WebSocket (goes through nginx proxy in Docker)
// Falls back to env var or localhost for development
const SOCKET_URL = import.meta.env.VITE_WS_URL || window.location.origin;

export function useWebSocket(events: WebSocketEvents = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    // Get API key from sessionStorage (same as api.ts)
    const apiKey = sessionStorage.getItem('openwa_api_key');

    if (!apiKey) {
      console.warn('[WebSocket] No API key found, skipping connection');
      return;
    }

    socketRef.current = io(`${SOCKET_URL}/events`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        apiKey,
      },
      extraHeaders: {
        'X-API-Key': apiKey,
      },
      query: {
        apiKey,
      },
    });

    socketRef.current.on('connect', () => {
      console.log('[WebSocket] Connected');
      setIsConnected(true);
      socketRef.current?.emit('message', {
        type: 'subscribe',
        sessionId: '*',
        events: ['session.status', 'session.qr', 'message.received', 'message.sent', 'message.ack'],
        requestId: `dashboard-${Date.now()}`,
      });
    });

    socketRef.current.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', error => {
      console.warn('[WebSocket] Connection error:', error.message);
    });
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]);

  // Register event handlers
  useEffect(() => {
    if (!socketRef.current) return;

    const socket = socketRef.current;

    const handleServerMessage = (message: ServerMessage) => {
      if (message.type !== 'event') return;

      const { event, sessionId, data } = message.payload;
      const payload = data as Record<string, unknown>;

      if (event === 'session.status') {
        events.onSessionStatus?.({
          sessionId,
          status: String(payload.status || ''),
          timestamp: message.timestamp,
          phone: typeof payload.phone === 'string' ? payload.phone : undefined,
          pushName: typeof payload.pushName === 'string' ? payload.pushName : undefined,
          connectedAt: typeof payload.connectedAt === 'string' ? payload.connectedAt : undefined,
          lastActiveAt: typeof payload.lastActiveAt === 'string' ? payload.lastActiveAt : undefined,
        });
      }

      if (event === 'session.qr') {
        events.onQRCode?.({
          sessionId,
          qrCode: String(payload.qrCode || ''),
          timestamp: message.timestamp,
        });
      }

      if (event === 'message.received' || event === 'message.sent') {
        events.onMessage?.({
          sessionId,
          message: payload,
          timestamp: message.timestamp,
        });
      }
    };

    socket.on('message', handleServerMessage);
    socket.on('session:status', events.onSessionStatus ?? (() => undefined));
    socket.on('session:qr', events.onQRCode ?? (() => undefined));
    socket.on('session:message', events.onMessage ?? (() => undefined));

    return () => {
      socket.off('message', handleServerMessage);
      socket.off('session:status');
      socket.off('session:qr');
      socket.off('session:message');
    };
  }, [events.onSessionStatus, events.onQRCode, events.onMessage]);

  return { isConnected };
}
