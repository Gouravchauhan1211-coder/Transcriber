import { EventEmitter } from 'events';
import {
  Session,
  TranscriptEntry,
  Language,
  SessionStatus,
} from '../websocket/messages';
import { config } from '../config';
import { logger } from '../utils/logger';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';

// In-memory store
const sessions = new Map<string, Session>();
// Cleanup timers per session
const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const sessionEvents = new EventEmitter();
sessionEvents.setMaxListeners(0); // unlimited listeners (one per viewer WS)

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createSession(opts: {
  language: Language;
  password?: string;
  speakerId: string;
}): Promise<Session> {
  const id = nanoid(12);
  const now = Date.now();
  const expiresAt = now + config.SESSION_TTL_HOURS * 60 * 60 * 1000;

  let passwordHash: string | undefined;
  if (opts.password) {
    passwordHash = await bcrypt.hash(opts.password, 10);
  }

  const session: Session = {
    id,
    speakerId: opts.speakerId,
    language: opts.language,
    status: 'live',
    passwordHash,
    transcript: [],
    createdAt: now,
    expiresAt,
    seqCounter: 0,
    analytics: {
      wordCount: 0,
      peakViewers: 0,
      currentViewers: 0,
      reconnects: 0,
      startedAt: now,
    },
  };

  sessions.set(id, session);
  scheduleExpiry(id, expiresAt - now);
  logger.info(`Session created: ${id}`, { language: opts.language });
  return session;
}

// ─── Read ────────────────────────────────────────────────────────────────────

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function sessionExists(id: string): boolean {
  return sessions.has(id);
}

// ─── Update ──────────────────────────────────────────────────────────────────

export function addTranscriptEntry(
  sessionId: string,
  entry: Omit<TranscriptEntry, 'seqId'>
): TranscriptEntry | null {
  const session = sessions.get(sessionId);
  if (!session || session.status === 'ended') return null;

  const seqId = ++session.seqCounter;
  const fullEntry: TranscriptEntry = { ...entry, seqId };

  // Keep only final entries in long-term storage (cap at 2000)
  if (entry.isFinal) {
    session.transcript.push(fullEntry);
    if (session.transcript.length > 2000) {
      session.transcript.shift();
    }
    // Update word count
    session.analytics.wordCount += entry.text.split(/\s+/).filter(Boolean).length;
  }

  return fullEntry;
}

export function setSessionStatus(sessionId: string, status: SessionStatus): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.status = status;
  if (status === 'ended') {
    session.analytics.endedAt = Date.now();
  }
  sessionEvents.emit(`state:${sessionId}`, status);
  return true;
}

export function updateViewerCount(sessionId: string, delta: 1 | -1): number {
  const session = sessions.get(sessionId);
  if (!session) return 0;
  session.analytics.currentViewers = Math.max(
    0,
    session.analytics.currentViewers + delta
  );
  if (session.analytics.currentViewers > session.analytics.peakViewers) {
    session.analytics.peakViewers = session.analytics.currentViewers;
  }
  return session.analytics.currentViewers;
}

export function incrementReconnects(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) session.analytics.reconnects++;
}

// ─── Password ────────────────────────────────────────────────────────────────

export async function verifyPassword(
  sessionId: string,
  password: string
): Promise<boolean> {
  const session = sessions.get(sessionId);
  if (!session?.passwordHash) return true; // no password set
  return bcrypt.compare(password, session.passwordHash);
}

export function hasPassword(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  return Boolean(session?.passwordHash);
}

// ─── Delete / Expiry ─────────────────────────────────────────────────────────

export function deleteSession(id: string): void {
  sessions.delete(id);
  const timer = expiryTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    expiryTimers.delete(id);
  }
  logger.info(`Session deleted: ${id}`);
}

function scheduleExpiry(id: string, msFromNow: number): void {
  const timer = setTimeout(() => {
    logger.info(`Session expired: ${id}`);
    setSessionStatus(id, 'ended');
    // Give clients 30s to receive the end event, then delete
    setTimeout(() => deleteSession(id), 30_000);
  }, msFromNow);
  // Don't block process exit
  timer.unref();
  expiryTimers.set(id, timer);
}

// ─── List (admin/debug) ──────────────────────────────────────────────────────

export function listSessions(): Pick<Session, 'id' | 'status' | 'createdAt' | 'language'>[] {
  return Array.from(sessions.values()).map(({ id, status, createdAt, language }) => ({
    id,
    status,
    createdAt,
    language,
  }));
}
