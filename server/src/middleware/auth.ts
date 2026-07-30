import type { NextFunction, Request, Response } from 'express';

import { verifyAccessToken } from '../lib/jwt';
import { Unauthorized } from '../lib/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

// Sets req.userId from the Bearer access token — every route below this reads req.userId
// instead of trusting anything the client sends, the same way every RLS policy anchored
// on auth.uid() rather than a client-supplied owner_id.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(Unauthorized());
    return;
  }

  try {
    const { userId } = verifyAccessToken(header.slice('Bearer '.length));
    req.userId = userId;
    next();
  } catch {
    next(Unauthorized('Токен недействителен или истёк'));
  }
}
