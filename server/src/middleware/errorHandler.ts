import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

import { ApiError } from '../lib/errors';

// Wraps an async route handler so a rejected promise reaches errorHandler below instead
// of crashing the process (Express doesn't do this automatically for async handlers).
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? 'Некорректные данные' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
}
