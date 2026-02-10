import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '@/utils/logger';

let wss: WebSocketServer | null = null;

const HEARTBEAT_INTERVAL_MS = 30000;

interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
}

export function initWebSocket(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: ExtWebSocket) => {
    ws.isAlive = true;
    logger.info(`WebSocket client connected (total: ${wss!.clients.size})`);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      logger.info(`WebSocket client disconnected (total: ${wss!.clients.size})`);
    });

    ws.on('error', (err) => {
      logger.warn('WebSocket client error', { error: err.message });
    });
  });

  // Heartbeat to detect stale connections
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      const extWs = ws as ExtWebSocket;
      if (!extWs.isAlive) {
        return extWs.terminate();
      }
      extWs.isAlive = false;
      extWs.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(interval);
  });

  logger.info('WebSocket server initialized on /ws');
  return wss;
}

export function broadcast(event: string, data: object): void {
  if (!wss) return;

  const message = JSON.stringify({ event, data, ts: Date.now() });
  let sent = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sent++;
    }
  });

  if (sent > 0) {
    logger.info(`Broadcast "${event}" to ${sent} client(s)`);
  }
}
