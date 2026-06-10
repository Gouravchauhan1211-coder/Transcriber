import 'dotenv/config';
import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './utils/logger';
import { sessionRouter } from './routes/session';
import { healthRouter, analyticsRouter } from './routes/health';
import { rateLimit } from './services/rateLimit';
import { handleUpgrade } from './websocket/server';

// ── Express App ──────────────────────────────────────────────────────────────
const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: [config.FRONTEND_URL, 'http://localhost:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json({ limit: '16kb' }));
app.use(rateLimit);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/health', healthRouter);
app.use('/api/sessions', sessionRouter);
app.use('/api/analytics', analyticsRouter);

// Catch-all 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── HTTP + WebSocket Server ───────────────────────────────────────────────────
const server = http.createServer(app);

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';

  // Only handle /ws path
  if (!url.startsWith('/ws')) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    handleUpgrade(wss, ws, req);
  });
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    wss.close(() => {
      logger.info('WebSocket server closed');
      process.exit(0);
    });
  });
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', String(reason));
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(config.PORT, () => {
  logger.info(`🚀 LiveLink server running on port ${config.PORT}`);
  logger.info(`   Frontend: ${config.FRONTEND_URL}`);
  logger.info(`   ENV: ${config.NODE_ENV}`);
});
