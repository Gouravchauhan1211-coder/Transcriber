const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export async function createSession(opts: {
  language: 'en-US' | 'hi-IN' | 'hi';
  password?: string;
}): Promise<{ sessionId: string; token: string; language: string; hasPassword: boolean }> {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create session');
  }
  return res.json();
}

export async function getSessionInfo(sessionId: string): Promise<{
  sessionId: string;
  status: string;
  language: string;
  hasPassword: boolean;
  analytics: { wordCount: number; currentViewers: number };
}> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}`);
  if (!res.ok) throw new Error('Session not found');
  return res.json();
}

export function buildWsUrl(sessionId: string, role: 'speaker' | 'viewer', opts?: { token?: string; password?: string }): string {
  const params = new URLSearchParams({ sessionId, role });
  if (opts?.token) params.set('token', opts.token);
  if (opts?.password) params.set('password', opts.password);
  return `${WS_URL}/ws?${params}`;
}
