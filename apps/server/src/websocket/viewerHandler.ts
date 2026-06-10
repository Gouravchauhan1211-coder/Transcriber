import WebSocket from 'ws';
import {
  Session,
  TranscriptEntry,
  TranscriptUpdateMsg,
  SessionHistoryMsg,
  SessionStateMsg,
  ViewerCountMsg,
  AnyServerMsg,
} from './messages';
import {
  sessionEvents,
  updateViewerCount,
  getSession,
  verifyPassword,
  hasPassword,
} from '../services/sessionStore';
import { logger } from '../utils/logger';

function send(ws: WebSocket, msg: AnyServerMsg): void {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {}
  }
}

export function handleViewer(
  ws: WebSocket,
  session: Session,
  password?: string
): void {
  const { id: sessionId } = session;

  // ── Password check ───────────────────────────────────────────────────────
  (async () => {
    if (hasPassword(sessionId)) {
      if (!password) {
        send(ws, { type: 'ERROR', code: 'PASSWORD_REQUIRED', message: 'This session requires a password' });
        ws.close(1008, 'Password required');
        return;
      }
      const ok = await verifyPassword(sessionId, password);
      if (!ok) {
        send(ws, { type: 'ERROR', code: 'WRONG_PASSWORD', message: 'Incorrect password' });
        ws.close(1008, 'Wrong password');
        return;
      }
    }

    setupViewer();
  })();

  function setupViewer() {
    // ── Send history ───────────────────────────────────────────────────────
    const currentSession = getSession(sessionId);
    if (!currentSession) {
      ws.close(1008, 'Session expired');
      return;
    }

    const historyMsg: SessionHistoryMsg = {
      type: 'SESSION_HISTORY',
      entries: currentSession.transcript,
      status: currentSession.status,
      language: currentSession.language,
    };
    send(ws, historyMsg);

    // ── Update viewer count ────────────────────────────────────────────────
    const count = updateViewerCount(sessionId, 1);
    sessionEvents.emit(`viewer_count:${sessionId}`, { type: 'VIEWER_COUNT', count });

    // ── Subscribe to live events ───────────────────────────────────────────
    const onTranscript = (entry: TranscriptEntry) => {
      const msg: TranscriptUpdateMsg = {
        type: 'TRANSCRIPT_UPDATE',
        text: entry.text,
        isFinal: entry.isFinal,
        timestamp: entry.timestamp,
        seqId: entry.seqId,
        speakerLabel: entry.speakerLabel,
      };
      send(ws, msg);
    };

    const onBroadcast = (msg: AnyServerMsg) => {
      send(ws, msg);
    };

    const onViewerCount = (msg: ViewerCountMsg) => {
      // Only speaker needs viewer count, but we can ignore it for viewers
    };

    const onState = (status: Session['status']) => {
      const msg: SessionStateMsg = {
        type: 'SESSION_STATE',
        status,
        sessionId,
        language: currentSession.language,
      };
      send(ws, msg);
      if (status === 'ended') {
        setTimeout(() => ws.close(1000, 'Session ended'), 2000);
      }
    };

    sessionEvents.on(`transcript:${sessionId}`, onTranscript);
    sessionEvents.on(`broadcast:${sessionId}`, onBroadcast);
    sessionEvents.on(`state:${sessionId}`, onState);

    // ── Heartbeat ──────────────────────────────────────────────────────────
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'HEARTBEAT') {
          send(ws, { type: 'HEARTBEAT_ACK', ts: Date.now() });
        }
      } catch {}
    });

    // ── Cleanup on disconnect ──────────────────────────────────────────────
    const cleanup = () => {
      sessionEvents.off(`transcript:${sessionId}`, onTranscript);
      sessionEvents.off(`broadcast:${sessionId}`, onBroadcast);
      sessionEvents.off(`state:${sessionId}`, onState);
      const newCount = updateViewerCount(sessionId, -1);
      sessionEvents.emit(`viewer_count:${sessionId}`, { type: 'VIEWER_COUNT', count: newCount });
      logger.debug(`Viewer left session: ${sessionId} (viewers: ${newCount})`);
    };

    ws.on('close', cleanup);
    ws.on('error', (err) => {
      logger.error(`Viewer WS error [${sessionId}]`, err.message);
      cleanup();
    });
  }
}
