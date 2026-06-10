export type Language = 'en-US' | 'hi-IN' | 'hi';
export type SessionStatus = 'live' | 'paused' | 'ended';

export interface SessionInfo {
  sessionId: string;
  token: string;
  language: Language;
  hasPassword: boolean;
  createdAt: number;
  expiresAt: number;
}

export interface TranscriptEntry {
  text: string;
  isFinal: boolean;
  timestamp: number;
  seqId: number;
  speakerLabel: string;
  language: Language;
}

// WebSocket messages (Server → Client)
export type AnyServerMsg =
  | { type: 'TRANSCRIPT_UPDATE'; text: string; isFinal: boolean; timestamp: number; seqId: number; speakerLabel: string }
  | { type: 'SESSION_STATE'; status: SessionStatus; sessionId: string; language: Language }
  | { type: 'SESSION_HISTORY'; entries: TranscriptEntry[]; status: SessionStatus; language: Language }
  | { type: 'VIEWER_COUNT'; count: number }
  | { type: 'ERROR'; code: string; message: string }
  | { type: 'HEARTBEAT_ACK'; ts: number };

// WebSocket messages (Client → Server)
export type AnyClientMsg =
  | { type: 'TRANSCRIPT_DELTA'; text: string; isFinal: boolean; timestamp: number; language: Language }
  | { type: 'SESSION_CONTROL'; action: 'pause' | 'resume' | 'end' }
  | { type: 'HEARTBEAT'; ts: number };

export interface Toast {
  id: string;
  message: string;
  kind: 'success' | 'error' | 'info';
}
