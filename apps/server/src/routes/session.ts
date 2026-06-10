import { Router, Request, Response } from 'express';
import { createSession, hasPassword } from '../services/sessionStore';
import { signSpeakerToken } from '../services/jwt';
import { sanitizeLanguage } from '../services/sanitize';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export const sessionRouter = Router();

const createSessionSchema = z.object({
  language: z.enum(['en-US', 'hi-IN', 'hi']).default('en-US'),
  password: z.string().min(4).max(64).optional(),
});

// POST /api/sessions — create a new transcription session
sessionRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { language, password } = parsed.data;
  const speakerId = nanoid(16);

  try {
    const session = await createSession({ language, password, speakerId });
    const token = signSpeakerToken(speakerId, session.id);

    res.status(201).json({
      sessionId: session.id,
      token,
      language: session.language,
      hasPassword: Boolean(password),
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/sessions/:id — get session info (for viewers)
sessionRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { getSession } = require('../services/sessionStore');
  const session = getSession(id);

  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }

  res.json({
    sessionId: session.id,
    status: session.status,
    language: session.language,
    hasPassword: hasPassword(id),
    createdAt: session.createdAt,
    analytics: {
      wordCount: session.analytics.wordCount,
      currentViewers: session.analytics.currentViewers,
    },
  });
});
