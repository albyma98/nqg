import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'validation_error',
      details: error.flatten()
    });
  }

  const message = error instanceof Error ? error.message : 'Errore interno';
  return res.status(500).json({
    error: 'internal_error',
    message
  });
}
