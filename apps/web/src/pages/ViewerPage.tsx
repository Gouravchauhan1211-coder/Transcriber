import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { buildWsUrl, getSessionInfo } from '../api';
import type { AnyServerMsg, TranscriptEntry, SessionStatus, Language } from '../types';
import './ViewerPage.css';

const BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'damn'];
function censorText(text: string): string {
  return text.replace(new RegExp(`\\b(${BAD_WORDS.join('|')})\\b`, 'gi'), (w) => w[0] + '*'.repeat(w.length - 1));
}

function highlightSearch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="search-highlight">{part}</mark> : part
  );
}

export default function ViewerPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [status, setStatus] = useState<SessionStatus>('live');
  const [language, setLanguage] = useState<Language>('en-US');
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [sessionNotFound, setSessionNotFound] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [censorEnabled, setCensorEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPiP, setIsPiP] = useState(false);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const transcriptBoxRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);

  // Check session info first
  useEffect(() => {
    if (!sessionId) return;
    getSessionInfo(sessionId)
      .then((info) => {
        if (info.hasPassword) setNeedsPassword(true);
        setWordCount(info.analytics.wordCount);
        setViewerCount(info.analytics.currentViewers);
      })
      .catch(() => setSessionNotFound(true));
  }, [sessionId]);

  const connect = useCallback((pwd?: string) => {
    if (!sessionId) return;
    const url = buildWsUrl(sessionId, 'viewer', { password: pwd });
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectDelay.current = 1000;
    };

    ws.onmessage = (event) => {
      try {
        const msg: AnyServerMsg = JSON.parse(event.data);
        switch (msg.type) {
          case 'SESSION_HISTORY':
            setEntries(msg.entries.filter((e) => e.isFinal));
            setStatus(msg.status);
            setLanguage(msg.language);
            setWordCount(msg.entries.filter((e) => e.isFinal).reduce((a, e) => a + e.text.split(/\s+/).length, 0));
            break;
          case 'TRANSCRIPT_UPDATE':
            if (msg.isFinal) {
              setEntries((prev) => [...prev, {
                text: msg.text,
                isFinal: true,
                timestamp: msg.timestamp,
                seqId: msg.seqId,
                speakerLabel: msg.speakerLabel,
                language,
              }]);
              setInterimText('');
              setWordCount((w) => w + msg.text.split(/\s+/).filter(Boolean).length);
            } else {
              setInterimText(msg.text);
            }
            break;
          case 'SESSION_STATE':
            setStatus(msg.status);
            break;
          case 'VIEWER_COUNT':
            setViewerCount(msg.count);
            break;
          case 'ERROR':
            if (msg.code === 'INVALID_PASSWORD' || msg.code === 'MISSING_PASSWORD') {
              setPasswordError('Incorrect password. Please try again.');
              setNeedsPassword(true);
            }
            break;
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect (unless session ended)
      if (status !== 'ended') {
        reconnectRef.current = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 1.5, 10000);
          connect(pwd);
        }, reconnectDelay.current);
      }
    };

    ws.onerror = () => setConnected(false);
  }, [sessionId, language, status]);

  // Connect once we have password (or none needed)
  useEffect(() => {
    if (sessionNotFound) return;
    if (needsPassword && !password) return;
    connect(password || undefined);
    return () => {
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [sessionNotFound, needsPassword, password]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, interimText, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  function handleScroll() {
    const el = transcriptBoxRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(atBottom);
  }

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPassword(pendingPassword);
    setNeedsPassword(false);
  }

  function exportTranscript() {
    const text = entries.map((e) => e.text).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transcript-${sessionId}.txt`;
    a.click();
  }

  const fontSizeMap = { sm: '0.9rem', md: '1.05rem', lg: '1.25rem', xl: '1.5rem' };

  const filteredEntries = entries.filter((e) =>
    !searchQuery || e.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (sessionNotFound) {
    return (
      <div className="viewer-page viewer-center">
        <div className="card not-found-card">
          <div className="not-found-icon">🔍</div>
          <h2>Session not found</h2>
          <p>This session may have expired or the link is invalid.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>Go Home</Link>
        </div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="viewer-page viewer-center">
        <div className="bg-orb bg-orb-1" />
        <div className="card password-card">
          <div className="password-icon">🔒</div>
          <h2>Password Protected</h2>
          <p>This session requires a password to join.</p>
          <form onSubmit={submitPassword} className="password-form">
            <input
              type="password"
              id="viewer-password-input"
              className="input"
              placeholder="Enter session password"
              value={pendingPassword}
              onChange={(e) => setPendingPassword(e.target.value)}
              autoFocus
            />
            {passwordError && <div className="form-error">{passwordError}</div>}
            <button type="submit" id="join-btn" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Join Session
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`viewer-page ${isPiP ? 'pip-mode' : ''}`}>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      {/* Header */}
      <header className="viewer-header">
        <Link to="/" className="back-link">← LiveLink</Link>
        <div className="header-center">
          <div className={`badge badge-${status}`}>
            {status === 'live' && <span className="live-dot" />}
            {status === 'live' ? 'LIVE' : status === 'paused' ? 'PAUSED' : 'ENDED'}
          </div>
          <span className="viewer-count-label">👥 {viewerCount} watching</span>
        </div>
        <div className="header-right">
          {!connected && <span className="ws-badge disconnected">↻ Reconnecting…</span>}
          {connected && <span className="ws-badge connected">● Live</span>}
        </div>
      </header>

      {/* Toolbar */}
      <div className="viewer-toolbar">
        <div className="toolbar-left">
          <input
            type="search"
            id="search-input"
            className="input search-input"
            placeholder="Search transcript…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <label className="toolbar-toggle" htmlFor="censor-toggle">
            <input
              type="checkbox"
              id="censor-toggle"
              checked={censorEnabled}
              onChange={(e) => setCensorEnabled(e.target.checked)}
              className="visually-hidden"
            />
            <div className={`toggle ${censorEnabled ? 'on' : ''}`} style={{ transform: 'scale(0.85)' }} />
            <span className="toolbar-label">Filter profanity</span>
          </label>
        </div>
        <div className="toolbar-right">
          <div className="font-size-group">
            {(['sm', 'md', 'lg', 'xl'] as const).map((s) => (
              <button
                key={s}
                id={`font-${s}`}
                className={`font-btn ${fontSize === s ? 'active' : ''}`}
                onClick={() => setFontSize(s)}
              >
                A{s === 'sm' ? '' : s === 'md' ? '+' : s === 'lg' ? '++' : '+++'}
              </button>
            ))}
          </div>
          <button
            id="pip-btn"
            className={`btn btn-ghost btn-sm ${isPiP ? 'active' : ''}`}
            onClick={() => setIsPiP((v) => !v)}
            title="Picture-in-Picture"
          >
            {isPiP ? '✕ Exit PiP' : '⊡ PiP'}
          </button>
          <button id="export-viewer-btn" className="btn btn-ghost btn-sm" onClick={exportTranscript}>
            ↓ Export
          </button>
        </div>
      </div>

      {/* Transcript */}
      <div className="viewer-transcript-wrap">
        <div
          ref={transcriptBoxRef}
          className="viewer-transcript"
          onScroll={handleScroll}
          style={{ fontSize: fontSizeMap[fontSize] }}
        >
          {filteredEntries.length === 0 && !interimText && (
            <div className="transcript-placeholder">
              {status === 'paused'
                ? '⏸ Session is paused'
                : status === 'ended'
                ? '■ Session has ended'
                : connected
                ? 'Waiting for speaker to start…'
                : '↻ Connecting…'}
            </div>
          )}
          {filteredEntries.map((e, i) => {
            const text = censorEnabled ? censorText(e.text) : e.text;
            return (
              <span key={e.seqId ?? i} className="viewer-entry">
                {highlightSearch(text, searchQuery)}{' '}
              </span>
            );
          })}
          {interimText && status === 'live' && !searchQuery && (
            <span className="viewer-interim">{censorEnabled ? censorText(interimText) : interimText}</span>
          )}
          <div ref={transcriptEndRef} />
        </div>

        {!autoScroll && (
          <button
            className="scroll-to-bottom"
            id="scroll-bottom-btn"
            onClick={() => { setAutoScroll(true); transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
          >
            ↓ Jump to latest
          </button>
        )}
      </div>

      {/* Footer stats */}
      <div className="viewer-footer">
        <span>📝 {wordCount} words</span>
        <span>🌐 {language}</span>
        <span className="session-id-hint">Session: {sessionId?.slice(0, 8)}…</span>
      </div>
    </div>
  );
}
