import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../api';
import type { Language } from '../types';
import './HomePage.css';

const LANGUAGES: { value: Language; label: string; flag: string }[] = [
  { value: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { value: 'hi-IN', label: 'Hindi', flag: '🇮🇳' },
  { value: 'hi',    label: 'Hinglish', flag: '🌐' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState<Language>('en-US');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await createSession({ language, password: usePassword ? password : undefined });
      sessionStorage.setItem(`token:${session.sessionId}`, session.token);
      navigate(`/speak/${session.sessionId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="home-page">
      {/* Background orbs */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <div className="home-content">
        {/* Hero */}
        <header className="hero">
          <div className="hero-badge">
            <span className="live-dot" />
            Free &amp; Open Source
          </div>
          <h1 className="hero-title">
            <span className="hero-title-line1">Real-time Speech</span>
            <span className="hero-title-line2">Transcription</span>
          </h1>
          <p className="hero-subtitle">
            Speak into your browser — unlimited viewers read your transcript live, instantly, from anywhere in the world.
          </p>
        </header>

        {/* Feature pills */}
        <div className="feature-pills">
          {[
            { icon: '🎙️', text: 'Web Speech API' },
            { icon: '⚡', text: 'Ultra-low latency' },
            { icon: '🔒', text: 'No audio leaves device' },
            { icon: '🌍', text: 'Multi-language' },
            { icon: '♾️', text: 'Unlimited viewers' },
          ].map((f) => (
            <div key={f.text} className="feature-pill">
              <span>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>

        {/* Create session card */}
        <div className="card create-card">
          <h2 className="create-title">Start a Live Session</h2>
          <p className="create-subtitle">You'll be the speaker. Share the viewer link with your audience.</p>

          <form onSubmit={handleStart} className="create-form">
            {/* Language */}
            <div className="form-group">
              <label className="form-label">Language</label>
              <div className="lang-options">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    id={`lang-${l.value}`}
                    className={`lang-btn ${language === l.value ? 'active' : ''}`}
                    onClick={() => setLanguage(l.value)}
                  >
                    <span className="lang-flag">{l.flag}</span>
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Password toggle */}
            <div className="form-group">
              <label className="toggle-row" htmlFor="use-password-toggle">
                <span className="form-label" style={{ margin: 0 }}>Password protect session</span>
                <div className="toggle-wrapper">
                  <input
                    type="checkbox"
                    id="use-password-toggle"
                    checked={usePassword}
                    onChange={(e) => setUsePassword(e.target.checked)}
                    className="visually-hidden"
                  />
                  <div className={`toggle ${usePassword ? 'on' : ''}`} />
                </div>
              </label>
              {usePassword && (
                <input
                  type="password"
                  id="session-password"
                  className="input"
                  placeholder="Enter a password (min. 4 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={4}
                  maxLength={64}
                  autoComplete="new-password"
                  style={{ marginTop: 12 }}
                />
              )}
            </div>

            {error && <div className="form-error">{error}</div>}

            <button
              type="submit"
              id="start-session-btn"
              className="btn btn-primary btn-lg"
              disabled={loading || (usePassword && password.length < 4)}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : '🎙️'}
              {loading ? 'Creating session…' : 'Start Broadcasting'}
            </button>
          </form>
        </div>

        {/* How it works */}
        <div className="how-it-works">
          <h3 className="section-title">How it works</h3>
          <div className="steps">
            {[
              { n: '1', title: 'Create a session', desc: 'Click "Start Broadcasting" to open a live session.' },
              { n: '2', title: 'Share the link', desc: 'Copy the viewer URL or QR code and share with your audience.' },
              { n: '3', title: 'Start speaking', desc: 'Grant mic permission — your words appear live on every viewer\'s screen.' },
            ].map((s) => (
              <div key={s.n} className="step">
                <div className="step-num">{s.n}</div>
                <div>
                  <div className="step-title">{s.title}</div>
                  <div className="step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <footer className="home-footer">
          <p>Built with Web Speech API · No audio leaves your device · 100% free</p>
        </footer>
      </div>
    </div>
  );
}
