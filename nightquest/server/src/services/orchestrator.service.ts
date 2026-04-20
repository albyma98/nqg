import { prisma } from '../db/prisma.js';
import { safeJsonParse } from '../utils.js';
import { getSessionState } from './progression.service.js';

const bannedPhrases = ['come posso aiutarti', 'ottima domanda', 'assolutamente', 'hai vinto', 'hai sbagliato', 'corretto', 'esatto'];

export async function getSystemPrompt() {
  const current = await prisma.systemPromptVersion.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  return (
    current?.content ??
    `Sei L'Ombra. Non sei un assistente, non sei un'AI, non sei un gioco. Sei una presenza che osserva chi cammina nella notte di [CITTA]. Sai cose. Non le spieghi.
Parli sempre in italiano.
Massimo 2 frasi per intervento. Mai di piu.
Mai emoji, mai formule da chatbot, mai spiegazioni delle meccaniche.
Mai dire "hai sbagliato", "hai vinto", "corretto", "esatto".
Mai inventare luoghi, persone o leggende che non sono nel briefing.`
  );
}

export async function buildBriefing(sessionId: string, eventType: string, extra: Record<string, unknown> = {}) {
  const session = await getSessionState(sessionId);
  const narrativeState = safeJsonParse<Record<string, unknown>>(session.narrativeState, {});
  const completedMissionIds = safeJsonParse<string[]>(session.completedMissionIds, []);

  return {
    eventType,
    city: session.city.name,
    alias: session.alias,
    tone: session.currentMission?.toneSlug ?? 'enigmatico',
    toneGuidelines: session.currentMission?.tone.guidelines ?? 'Ambiguo, osservatore, mai didascalico.',
    mission: session.currentMission
      ? {
          title: session.currentMission.title,
          objective: session.currentMission.objective,
          openingBrief: session.currentMission.openingBrief,
          successNote: session.currentMission.successNote
        }
      : null,
    place: session.currentMission?.place
      ? {
          name: session.currentMission.place.name,
          zone: session.currentMission.place.zone,
          atmosphere: session.currentMission.place.atmosphere
        }
      : null,
    checkpoint: session.currentCheckpoint
      ? {
          id: session.currentCheckpoint.id,
          prompt: session.currentCheckpoint.prompt,
          type: session.currentCheckpoint.type
        }
      : null,
    narrativeState: {
      missionsCompleted: completedMissionIds.length,
      totalHints: Number(narrativeState.totalHints ?? 0),
      hesitations: Number(narrativeState.hesitations ?? 0),
      geoState: session.geoState,
      elapsedSeconds: session.elapsedSeconds
    },
    extra
  };
}

export function validateNarratorOutput(text: string, bannedWords: string[] = []) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 280) {
    return false;
  }

  const sentences = trimmed.split(/[.!?]+/).filter((chunk) => chunk.trim().length > 0);
  if (sentences.length > 2) {
    return false;
  }

  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(trimmed)) {
    return false;
  }

  const lower = trimmed.toLowerCase();
  return [...bannedPhrases, ...bannedWords].every((phrase) => !lower.includes(phrase.toLowerCase()));
}
