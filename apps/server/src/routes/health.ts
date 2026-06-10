import { Router, Request, Response } from 'express';
import { getSession } from '../services/sessionStore';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', ts: Date.now(), uptime: process.uptime() });
});

export const analyticsRouter = Router();

analyticsRouter.get('/:id', (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({
    sessionId: session.id,
    status: session.status,
    language: session.language,
    analytics: session.analytics,
    transcriptLength: session.transcript.length,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  });
});
