import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { verifySpeakerToken } from '../services/jwt';
import { sessionExists, getSession } from '../services/sessionStore';
import { handleSpeaker } from './speakerHandler';
import { handleViewer } from './viewerHandler';
import { logger } from '../utils/logger';
import { ErrorMsg } from './messages';

export function handleUpgrade(
  wss: WebSocket.Server,
  ws: WebSocket,
  req: IncomingMessage
): void {
  const rawUrl = req.url || '/';
  const baseUrl = `ws://localhost`;
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl, baseUrl);
  } catch {
    ws.close(1008, 'Invalid URL');
    return;
  }

  const role = parsedUrl.searchParams.get('role');
  const sessionId = parsedUrl.searchParams.get('sessionId');
  const token = parsedUrl.searchParams.get('token');

  if (!sessionId) {
    sendError(ws, 'MISSING_SESSION', 'sessionId is required');
    ws.close(1008, 'Missing sessionId');
    return;
  }

  if (!sessionExists(sessionId)) {
    sendError(ws, 'SESSION_NOT_FOUND', 'Session not found or expired');
    ws.close(1008, 'Session not found');
    return;
  }

  const session = getSession(sessionId)!;

  if (role === 'speaker') {
    if (!token) {
      sendError(ws, 'MISSING_TOKEN', 'Speaker token required');
      ws.close(1008, 'Missing token');
      return;
    }
    try {
      const payload = verifySpeakerToken(token);
      if (payload.sessionId !== sessionId) throw new Error('Token/session mismatch');
      logger.info(`Speaker connected: ${sessionId}`);
      handleSpeaker(ws, session, payload);
    } catch (err) {
      sendError(ws, 'INVALID_TOKEN', 'Invalid or expired speaker token');
      ws.close(1008, 'Invalid token');
    }
  } else {
    // Viewer — open access (password check happens after connect via message)
    const password = parsedUrl.searchParams.get('password') || undefined;
    logger.info(`Viewer connected: ${sessionId}`);
    handleViewer(ws, session, password);
  }
}

function sendError(ws: WebSocket, code: string, message: string): void {
  try {
    const msg: ErrorMsg = { type: 'ERROR', code, message };
    ws.send(JSON.stringify(msg));
  } catch {}
}
