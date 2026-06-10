import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

function getIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getIp(req);
  const now = Date.now();
  let entry = store.get(ip);

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + config.RATE_LIMIT_WINDOW_MS };
    store.set(ip, entry);
  }

  entry.count++;

  res.setHeader('X-RateLimit-Limit', config.RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, config.RATE_LIMIT_MAX - entry.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

  if (entry.count > config.RATE_LIMIT_MAX) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return;
  }

  next();
}

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(ip);
  }
}, 60_000).unref();
