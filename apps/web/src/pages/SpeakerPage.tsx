import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { buildWsUrl } from '../api';
import type { AnyServerMsg, AnyClientMsg, SessionStatus, Language } from '../types';
import QRModal from '../components/QRModal';
import './SpeakerPage.css';

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

const VIEWER_URL = (id: string) => `${window.location.origin}/view/${id}`;

interface FinalLine {
  id: string;
  text: string;
}

export default function SpeakerPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const token = sessionId ? sessionStorage.getItem(`token:${sessionId}`) : null;

  const [status, setStatus] = useState<SessionStatus>('live');
  const [language, setLanguage] = useState<Language>('en-US');
  const [isRecording, setIsRecording] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);

  // ── Transcript: finals never disappear, interim is ephemeral ─────────────
  const [finalLines, setFinalLines] = useState<FinalLine[]>([]);
  const [interimText, setInterimText] = useState('');

  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [micError, setMicError] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  // ── CRITICAL: use ref for the recording flag so closures always see current value ──
  const isRecordingRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const languageRef = useRef<Language>('en-US');

  // Keep languageRef in sync
  useEffect(() => { languageRef.current = language; }, [language]);

  // Redirect if no token
  useEffect(() => {
    if (!sessionId || !token) navigate('/');
  }, [sessionId, token, navigate]);

  // WebSocket connection
  useEffect(() => {
    if (!sessionId || !token) return;
    const url = buildWsUrl(sessionId, 'speaker', { token });
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'HEARTBEAT', ts: Date.now() } satisfies AnyClientMsg));
        }
      }, 20000);
    };

    ws.onmessage = (event) => {
      try {
        const msg: AnyServerMsg = JSON.parse(event.data);
        if (msg.type === 'SESSION_STATE') {
          setStatus(msg.status);
          setLanguage(msg.language);
        } else if (msg.type === 'VIEWER_COUNT') {
          setViewerCount(msg.count);
        }
      } catch {}
    };

    ws.onclose = () => {
      setWsConnected(false);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
    ws.onerror = () => setWsConnected(false);

    return () => {
      ws.close();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [sessionId, token]);

  // Auto-scroll whenever finals or interim changes
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [finalLines, interimText]);

  const sendControl = useCallback((action: 'pause' | 'resume' | 'end') => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'SESSION_CONTROL', action } satisfies AnyClientMsg));
    if (action === 'end') {
      stopRecording();
      navigate('/');
    }
  }, [navigate]);

  // ── Speech recognition ───────────────────────────────────────────────────
  function createAndStartRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setMicError('Your browser does not support the Web Speech API. Please use Chrome or Edge.');
      return;
    }

    const rec = new SpeechRec();
    rec.lang = languageRef.current;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onresult = (event) => {
      const ws = wsRef.current;
      // Accumulate all results in this event batch
      let interimAccum = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;

        if (result.isFinal) {
          // Send to server
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'TRANSCRIPT_DELTA',
              text,
              isFinal: true,
              timestamp: Date.now(),
              language: languageRef.current,
            } satisfies AnyClientMsg));
          }
          // Append to permanent transcript — never remove
          setFinalLines((prev) => [...prev, { id: crypto.randomUUID(), text }]);
          setWordCount((w) => w + text.split(/\s+/).filter(Boolean).length);
        } else {
          // Collect all interim chunks
          interimAccum += (interimAccum ? ' ' : '') + text;
        }
      }

      // Send interim to server for viewers
      if (interimAccum && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'TRANSCRIPT_DELTA',
          text: interimAccum,
          isFinal: false,
          timestamp: Date.now(),
          language: languageRef.current,
        } satisfies AnyClientMsg));
      }

      // Update interim display (always replaces, never accumulates)
      setInterimText(interimAccum);
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed') {
        setMicError('Microphone access denied. Please grant permission and try again.');
        isRecordingRef.current = false;
        setIsRecording(false);
      } else if (e.error === 'no-speech') {
        // Silence — don't stop, just continue
      } else if (e.error === 'aborted') {
        // We stopped it intentionally — ignore
      } else {
        // Network or other error — log but try to recover
        console.warn('Speech recognition error:', e.error);
      }
    };

    rec.onend = () => {
      // Chrome fires onend periodically (every ~60s or on silence).
      // Only restart if the user hasn't clicked stop.
      // We MUST read from the ref, not state (state is stale in this closure).
      if (isRecordingRef.current) {
        try {
          rec.start();
        } catch {
          // If start fails (e.g. already running), wait a tick
          setTimeout(() => {
            if (isRecordingRef.current) {
              try { rec.start(); } catch {}
            }
          }, 200);
        }
      } else {
        // User stopped — clear interim
        setInterimText('');
      }
    };

    try {
      rec.start();
      setMicError('');
    } catch (err) {
      setMicError('Failed to start microphone. Please try again.');
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  }

  function startRecording() {
    isRecordingRef.current = true;
    setIsRecording(true);
    createAndStartRecognition();
  }

  function stopRecording() {
    isRecordingRef.current = false;
    setIsRecording(false);
    setInterimText(''); // clear interim immediately
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(VIEWER_URL(sessionId!)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function exportTranscript() {
    const text = finalLines.map((l) => l.text).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${sessionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearTranscript() {
    setFinalLines([]);
    setInterimText('');
    setWordCount(0);
  }

  if (!sessionId || !token) return null;

  return (
    <div className="speaker-page">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      {/* Header */}
      <header className="speaker-header">
        <Link to="/" className="back-link">← Back</Link>
        <div className="header-center">
          <div className={`badge badge-${status}`}>
            {status === 'live' && <span className="live-dot" />}
            {status === 'live' ? 'LIVE' : status === 'paused' ? 'PAUSED' : 'ENDED'}
          </div>
          <span className="session-id-label">Session: <code>{sessionId.slice(0, 8)}…</code></span>
        </div>
        <div className="header-right">
          {!wsConnected && <span className="ws-badge disconnected">⚠ Disconnected</span>}
          {wsConnected && <span className="ws-badge connected">● Connected</span>}
        </div>
      </header>

      <div className="speaker-layout">
        {/* Left / Main panel */}
        <div className="speaker-main">
          {/* Stats bar */}
          <div className="stats-bar">
            <div className="stat">
              <span className="stat-icon">👥</span>
              <span className="stat-value">{viewerCount}</span>
              <span className="stat-label">Viewers</span>
            </div>
            <div className="stat">
              <span className="stat-icon">📝</span>
              <span className="stat-value">{wordCount}</span>
              <span className="stat-label">Words</span>
            </div>
            <div className="stat">
              <span className="stat-icon">🌐</span>
              <span className="stat-value">{language}</span>
              <span className="stat-label">Language</span>
            </div>
          </div>

          {/* Transcript box */}
          <div className="transcript-box">
            <div className="transcript-header">
              <span className="transcript-title">Live Transcript</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {finalLines.length > 0 && (
                  <>
                    <button className="btn btn-ghost btn-sm" id="export-btn" onClick={exportTranscript}>
                      ↓ Export
                    </button>
                    <button className="btn btn-ghost btn-sm" id="clear-btn" onClick={clearTranscript}
                      style={{ color: 'var(--red)' }}>
                      ✕ Clear
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="transcript-content" id="transcript-content">
              {finalLines.length === 0 && !interimText && (
                <div className="transcript-placeholder">
                  {isRecording
                    ? '🎙️ Listening… start speaking'
                    : 'Click "Start Recording" to begin broadcasting'}
                </div>
              )}

              {/* Final lines — permanent, never removed */}
              <span className="transcript-finals">
                {finalLines.map((line) => (
                  <span key={line.id} className="transcript-final-word">
                    {line.text}{' '}
                  </span>
                ))}
              </span>

              {/* Interim — live preview, shown as faded text inline */}
              {interimText && (
                <span className="transcript-interim">{interimText}</span>
              )}

              <div ref={transcriptEndRef} />
            </div>
          </div>

          {/* Mic error */}
          {micError && <div className="mic-error">⚠️ {micError}</div>}

          {/* Controls */}
          <div className="controls">
            {!isRecording ? (
              <button
                id="start-recording-btn"
                className="btn btn-primary btn-lg mic-btn"
                onClick={startRecording}
                disabled={!wsConnected || status === 'ended'}
              >
                <span className="mic-icon">🎙️</span>
                Start Recording
              </button>
            ) : (
              <button
                id="stop-recording-btn"
                className="btn btn-danger btn-lg mic-btn recording-active"
                onClick={stopRecording}
              >
                <span className="rec-dot" />
                Stop Recording
              </button>
            )}

            <div className="session-controls">
              {status === 'live' && (
                <button
                  id="pause-btn"
                  className="btn btn-ghost"
                  onClick={() => sendControl('pause')}
                  disabled={!wsConnected}
                >
                  ⏸ Pause
                </button>
              )}
              {status === 'paused' && (
                <button
                  id="resume-btn"
                  className="btn btn-success"
                  onClick={() => sendControl('resume')}
                  disabled={!wsConnected}
                >
                  ▶ Resume
                </button>
              )}
              <button
                id="end-session-btn"
                className="btn btn-ghost end-btn"
                onClick={() => { if (confirm('End session? This cannot be undone.')) sendControl('end'); }}
                disabled={!wsConnected}
              >
                ■ End Session
              </button>
            </div>
          </div>
        </div>

        {/* Right / Share panel */}
        <div className="share-panel">
          <div className="card share-card">
            <h3 className="share-title">Share with viewers</h3>
            <div className="share-url-row">
              <input
                type="text"
                readOnly
                value={VIEWER_URL(sessionId)}
                className="input share-input"
                id="viewer-url-input"
                onFocus={(e) => e.target.select()}
              />
              <button
                id="copy-link-btn"
                className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
                onClick={copyLink}
              >
                {copied ? '✓' : '📋'}
              </button>
            </div>
            <button
              id="show-qr-btn"
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
              onClick={() => setShowQR(true)}
            >
              📱 Show QR Code
            </button>
          </div>

          <div className="card tips-card">
            <h4 className="tips-title">Tips for Accuracy</h4>
            <ul className="tips-list">
              <li>Use <strong>Chrome</strong> or <strong>Edge</strong> for best results</li>
              <li>Speak clearly at a steady pace</li>
              <li>Reduce background noise</li>
              <li>Wait for the cursor to stop blinking before the next sentence</li>
              <li>Short pauses between sentences help accuracy</li>
            </ul>
          </div>
        </div>
      </div>

      {showQR && (
        <QRModal url={VIEWER_URL(sessionId)} onClose={() => setShowQR(false)} />
      )}
    </div>
  );
}
