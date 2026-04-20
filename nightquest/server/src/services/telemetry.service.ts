import { prisma } from '../db/prisma.js';

export async function trackSessionEvent(sessionId: string, type: string, payload: Record<string, unknown>) {
  await prisma.sessionEvent.create({
    data: {
      sessionId,
      type,
      payload: JSON.stringify(payload)
    }
  });
}
