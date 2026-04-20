import { safeJsonParse } from '../utils.js';

type PauseEvent = {
  pausedAt: string;
  resumedAt?: string;
  durationSeconds?: number;
};

export function getCurrentElapsed(session: { startedAt: Date; pauseEvents: string }) {
  const pauseEvents = safeJsonParse<PauseEvent[]>(session.pauseEvents, []);
  const totalPauseSeconds = pauseEvents.reduce((sum, event) => sum + Number(event.durationSeconds ?? 0), 0);
  return Math.max(0, Math.floor((Date.now() - session.startedAt.getTime()) / 1000) - totalPauseSeconds);
}

export function getRemainingNarrative(session: { startedAt: Date; pauseEvents: string }, maxSessionMinutes = 90) {
  const elapsed = getCurrentElapsed(session);
  if (elapsed < 1200) return 'la notte e giovane';
  if (elapsed < 3600) return 'e passata un ora leggera';
  if (elapsed < maxSessionMinutes * 60) return 'e tardi, lo sai';
  return 'la notte ha gia chiesto molto';
}

export function humanizeElapsed(seconds: number) {
  if (seconds < 120) return 'siamo qui da poco';
  if (seconds < 3600) return `siamo qui da ${Math.round(seconds / 60)} minuti`;
  if (seconds < 5400) return 'siamo qui da quasi un ora';
  return 'siamo qui da piu di un ora';
}
