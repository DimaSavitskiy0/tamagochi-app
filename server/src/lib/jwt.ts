import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env } from './env';

const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtAccessSecret, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): { userId: string } {
  const payload = jwt.verify(token, env.jwtAccessSecret) as jwt.JwtPayload;
  if (typeof payload.sub !== 'string') throw new Error('Invalid token payload');
  return { userId: payload.sub };
}

// Refresh tokens are opaque random strings (not JWTs) so a specific session can be
// revoked by deleting its row — see RefreshToken model. Only the sha256 hash is
// persisted, mirroring how passwords are never stored in plaintext.
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const RESET_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// A 6-digit code (not a random token) since the user has to type it in by hand — sent
// by email in POST /auth/forgot-password, verified in POST /auth/reset-password. Only
// the hash is ever persisted, same as refresh tokens and passwords.
export function generateResetCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashResetCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}
