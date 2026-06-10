// ─── WebSocket Message Types ────────────────────────────────────────────────

export type Language = 'en-US' | 'hi-IN' | 'hi';

export type SessionStatus = 'live' | 'paused' | 'ended';

export type WsRole = 'speaker' | 'viewer';

// Speaker → Server
export interface TranscriptDeltaMsg {
  type: 'TRANSCRIPT_DELTA';
  text: string;
  isFinal: boolean;
  timestamp: number;
  language: Language;
  speakerLabel?: string;
}

export interface SessionControlMsg {
  type: 'SESSION_CONTROL';
  action: 'pause' | 'resume' | 'end';
}

export interface HeartbeatMsg {
  type: 'HEARTBEAT';
  ts: number;
}

// Server → Viewer
export interface TranscriptUpdateMsg {
  type: 'TRANSCRIPT_UPDATE';
  text: string;
  isFinal: boolean;
  timestamp: number;
  seqId: number;
  speakerLabel: string;
}

export interface SessionStateMsg {
  type: 'SESSION_STATE';
  status: SessionStatus;
  sessionId: string;
  language: Language;
}

export interface SessionHistoryMsg {
  type: 'SESSION_HISTORY';
  entries: TranscriptEntry[];
  status: SessionStatus;
  language: Language;
}

export interface ViewerCountMsg {
  type: 'VIEWER_COUNT';
  count: number;
}

export interface ErrorMsg {
  type: 'ERROR';
  code: string;
  message: string;
}

export interface HeartbeatAckMsg {
  type: 'HEARTBEAT_ACK';
  ts: number;
}

// Internal session types
export interface TranscriptEntry {
  text: string;
  isFinal: boolean;
  timestamp: number;
  seqId: number;
  speakerLabel: string;
  language: Language;
}

export interface Session {
  id: string;
  speakerId: string;
  language: Language;
  status: SessionStatus;
  passwordHash?: string;
  transcript: TranscriptEntry[];
  createdAt: number;
  expiresAt: number;
  analytics: SessionAnalytics;
  seqCounter: number;
}

export interface SessionAnalytics {
  wordCount: number;
  peakViewers: number;
  currentViewers: number;
  reconnects: number;
  startedAt: number;
  endedAt?: number;
}

export type AnyClientMsg = TranscriptDeltaMsg | SessionControlMsg | HeartbeatMsg;
export type AnyServerMsg =
  | TranscriptUpdateMsg
  | SessionStateMsg
  | SessionHistoryMsg
  | ViewerCountMsg
  | ErrorMsg
  | HeartbeatAckMsg;
