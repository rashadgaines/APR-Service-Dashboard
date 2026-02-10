'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface RealtimeCallbacks {
  onPositionsSynced?: () => void;
  onReimbursementsExecuted?: () => void;
}

interface WsMessage {
  event: string;
  data: object;
  ts: number;
}

const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;

function getWsUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003/api';
  const base = apiUrl.replace('/api', '').replace(/^http/, 'ws');
  return `${base}/ws`;
}

export function useRealtimeUpdates(callbacks: RealtimeCallbacks) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef(callbacks);
  const mountedRef = useRef(true);

  // Keep callbacks ref up to date without re-triggering effect
  callbacksRef.current = callbacks;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          if (msg.event === 'positions_synced') {
            callbacksRef.current.onPositionsSynced?.();
          } else if (msg.event === 'reimbursements_executed') {
            callbacksRef.current.onReimbursementsExecuted?.();
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        // onclose will fire after onerror, so reconnect is handled there
      };
    } catch {
      scheduleReconnect();
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

    reconnectTimerRef.current = setTimeout(() => {
      reconnectDelayRef.current = Math.min(
        reconnectDelayRef.current * 2,
        MAX_RECONNECT_DELAY
      );
      connect();
    }, reconnectDelayRef.current);
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on unmount
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { isConnected };
}
