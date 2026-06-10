import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface SpeakerTokenPayload {
  sub: string;   // speakerId
  sessionId: string;
  role: 'speaker';
  iat?: number;
  exp?: number;
}

export function signSpeakerToken(speakerId: string, sessionId: string): string {
  return jwt.sign(
    { sub: speakerId, sessionId, role: 'speaker' } as SpeakerTokenPayload,
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
}

export function verifySpeakerToken(token: string): SpeakerTokenPayload {
  const payload = jwt.verify(token, config.JWT_SECRET) as SpeakerTokenPayload;
  if (payload.role !== 'speaker') {
    throw new Error('Invalid token role');
  }
  return payload;
}
