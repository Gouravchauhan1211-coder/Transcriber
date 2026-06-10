import WebSocket from 'ws';
import { Session, TranscriptDeltaMsg, SessionControlMsg, HeartbeatMsg, ViewerCountMsg, SessionStateMsg } from './messages';
import { addTranscriptEntry, setSessionStatus, updateViewerCount, sessionEvents } from '../services/sessionStore';
import { sanitizeText, sanitizeLanguage } from '../services/sanitize';
import { logger } from '../utils/logger';
import { SpeakerTokenPayload } from '../services/jwt';

const HEARTBEAT_INTERVAL = 25_000;
const HEARTBEAT_TIMEOUT = 10_000;

export function handleSpeaker(
  ws: WebSocket,
  session: Session,
  payload: SpeakerTokenPayload
): void {
  const { id: sessionId } = session;
  let isAlive = true;
  let heartbeatTimer: ReturnType<typeof setInterval>;
  let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;

  // ── Heartbeat ────────────────────────────────────────────────────────────
  ws.on('pong', () => {
    isAlive = true;
    if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
  });

  heartbeatTimer = setInterval(() => {
    if (!isAlive) {
      ws.terminate();
      return;
    }
    isAlive = false;
    ws.ping();
    heartbeatTimeout = setTimeout(() => {
      if (!isAlive) ws.terminate();
    }, HEARTBEAT_TIMEOUT);
  }, HEARTBEAT_INTERVAL);

  // ── Message Handling ─────────────────────────────────────────────────────
  ws.on('message', (raw) => {
    let msg: unknown;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const data = msg as Record<string, unknown>;

    switch (data.type) {
      case 'TRANSCRIPT_DELTA': {
        const delta = data as unknown as TranscriptDeltaMsg;
        const text = sanitizeText(delta.text);
        if (!text) return;

        const entry = addTranscriptEntry(sessionId, {
          text,
          isFinal: Boolean(delta.isFinal),
          timestamp: Date.now(),
          speakerLabel: 'Speaker',
          language: sanitizeLanguage(delta.language),
        });

        if (entry) {
          // Broadcast to all viewers via EventEmitter
          sessionEvents.emit(`transcript:${sessionId}`, entry);
        }
        break;
      }

      case 'SESSION_CONTROL': {
        const ctrl = data as unknown as SessionControlMsg;
        if (ctrl.action === 'pause' || ctrl.action === 'resume' || ctrl.action === 'end') {
          const newStatus = ctrl.action === 'end' ? 'ended' : ctrl.action === 'pause' ? 'paused' : 'live';
          setSessionStatus(sessionId, newStatus);
          const stateMsg: SessionStateMsg = {
            type: 'SESSION_STATE',
            status: newStatus,
            sessionId,
            language: session.language,
          };
          sessionEvents.emit(`broadcast:${sessionId}`, stateMsg);
          logger.info(`Session ${sessionId} → ${newStatus}`);
          if (newStatus === 'ended') {
            ws.close(1000, 'Session ended');
          }
        }
        break;
      }

      case 'HEARTBEAT': {
        ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK', ts: Date.now() }));
        break;
      }
    }
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  ws.on('close', () => {
    clearInterval(heartbeatTimer);
    if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
    logger.info(`Speaker disconnected: ${sessionId}`);
    // Broadcast viewer count update
    const count = updateViewerCount(sessionId, -1);
    broadcastViewerCount(sessionId, count);
  });

  ws.on('error', (err) => {
    logger.error(`Speaker WS error [${sessionId}]`, err.message);
  });

  // Send initial state to speaker
  ws.send(JSON.stringify({ type: 'SESSION_STATE', status: session.status, sessionId, language: session.language }));
}

function broadcastViewerCount(sessionId: string, count: number): void {
  const msg: ViewerCountMsg = { type: 'VIEWER_COUNT', count };
  sessionEvents.emit(`viewer_count:${sessionId}`, msg);
}
