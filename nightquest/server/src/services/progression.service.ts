import { prisma } from '../db/prisma.js';
import { getCityContent } from './mission-library.service.js';
import { normalizeText, safeJsonParse } from '../utils.js';

type NarrativeState = {
  hesitations: number;
  totalHints: number;
  userChoices: Array<{ missionId: string; checkpointId: string; input: string }>;
  lostModeUsed?: Record<string, boolean>;
};

export async function initSession(cityId: string, alias: string) {
  const city = await getCityContent(cityId);
  const firstMission = city.missions[0];
  const firstCheckpoint = firstMission?.checkpoints[0];

  const created = await prisma.session.create({
    data: {
      cityId,
      alias,
      currentMissionId: firstMission?.id,
      currentCheckpointId: firstCheckpoint?.id,
      geoState: 'unknown',
      elapsedSeconds: 0,
      pauseEvents: JSON.stringify([]),
      transitPath: JSON.stringify([]),
      geoPermissionGranted: false,
      compassPermissionGranted: false,
      completedMissionIds: JSON.stringify([]),
      narrativeState: JSON.stringify({
        hesitations: 0,
        totalHints: 0,
        userChoices: [],
        lostModeUsed: {}
      })
    }
  });

  return getSessionState(created.id);
}

export async function getSessionState(sessionId: string) {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { city: true }
  });

  const currentMission = session.currentMissionId
    ? await prisma.mission.findUnique({
        where: { id: session.currentMissionId },
        include: {
          place: true,
          tone: true,
          checkpoints: { orderBy: { order: 'asc' } },
          transit: {
            include: {
              ambientLines: {
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      })
    : null;

  const currentCheckpoint = currentMission?.checkpoints.find((checkpoint) => checkpoint.id === session.currentCheckpointId) ?? null;

  return {
    ...session,
    currentMission,
    currentCheckpoint
  };
}

function isValidAnswer(checkpoint: { type: string; acceptAny: boolean; validationRule: unknown }, input: unknown) {
  if (checkpoint.acceptAny) {
    return true;
  }

  const rule = safeJsonParse<Record<string, unknown>>(checkpoint.validationRule, {});
  const normalized = normalizeText(input);

  if (checkpoint.type === 'multiple_choice') {
    return normalized === normalizeText(rule.answer);
  }

  const acceptedAnswers = Array.isArray(rule.acceptedAnswers) ? rule.acceptedAnswers.map((item) => normalizeText(item)) : [];
  if (checkpoint.type === 'keyword' || checkpoint.type === 'count' || checkpoint.type === 'sequence') {
    return acceptedAnswers.some((answer) => normalized === answer || normalized.includes(answer));
  }

  if (checkpoint.type === 'observation_confirm') {
    return ['si', 'sì', 'confermo', 'ok'].includes(normalized);
  }

  if (checkpoint.type === 'walk_blind') {
    const payload =
      typeof input === 'string'
        ? safeJsonParse<Record<string, unknown>>(input, {})
        : typeof input === 'object' && input !== null
          ? (input as Record<string, unknown>)
          : {};
    const durationSeconds = Number(rule.durationSeconds ?? 180);
    const elapsedSeconds = Number(payload.elapsedSeconds ?? 0);
    return Boolean(payload.completed) && elapsedSeconds >= Math.max(30, durationSeconds * 0.85);
  }

  return false;
}

export async function validateAnswer(sessionId: string, checkpointId: string, input: unknown) {
  const session = await getSessionState(sessionId);
  if (session.currentCheckpointId !== checkpointId || !session.currentCheckpoint || !session.currentMission) {
    return { valid: false, reason: 'checkpoint_mismatch', session };
  }

  const valid = isValidAnswer(session.currentCheckpoint, input);
  return { valid, reason: valid ? 'accepted' : 'rejected', session };
}

export async function registerHesitation(sessionId: string) {
  const session = await getSessionState(sessionId);
  const narrativeState = safeJsonParse<NarrativeState>(session.narrativeState, {
    hesitations: 0,
    totalHints: 0,
    userChoices: [],
    lostModeUsed: {}
  });

  return prisma.session.update({
    where: { id: sessionId },
    data: {
      narrativeState: JSON.stringify({
        ...narrativeState,
        hesitations: narrativeState.hesitations + 1
      })
    }
  });
}

export async function advanceSession(sessionId: string, input: unknown) {
  const session = await getSessionState(sessionId);
  const city = await getCityContent(session.cityId);
  const currentMissionIndex = city.missions.findIndex((mission) => mission.id === session.currentMissionId);
  const currentMission = city.missions[currentMissionIndex];
  const currentCheckpointIndex = currentMission.checkpoints.findIndex((checkpoint) => checkpoint.id === session.currentCheckpointId);
  const narrativeState = safeJsonParse<NarrativeState>(session.narrativeState, {
    hesitations: 0,
    totalHints: 0,
    userChoices: [],
    lostModeUsed: {}
  });
  const completedMissionIds = safeJsonParse<string[]>(session.completedMissionIds, []);

  const nextNarrativeState: NarrativeState = {
    ...narrativeState,
    userChoices: [
      ...narrativeState.userChoices,
      {
        missionId: currentMission.id,
        checkpointId: currentMission.checkpoints[currentCheckpointIndex].id,
        input: String(input)
      }
    ]
  };

  const hasNextCheckpoint = currentCheckpointIndex < currentMission.checkpoints.length - 1;
  if (hasNextCheckpoint) {
    return prisma.session.update({
      where: { id: sessionId },
      data: {
        currentCheckpointId: currentMission.checkpoints[currentCheckpointIndex + 1].id,
        narrativeState: JSON.stringify(nextNarrativeState)
      }
    });
  }

  const nextMission = city.missions[currentMissionIndex + 1];
  return prisma.session.update({
    where: { id: sessionId },
    data: {
      currentMissionId: nextMission?.id ?? null,
      currentCheckpointId: nextMission?.checkpoints[0]?.id ?? null,
      completedMissionIds: JSON.stringify([...completedMissionIds, currentMission.id]),
      finishedAt: nextMission ? null : new Date(),
      narrativeState: JSON.stringify(nextNarrativeState)
    }
  });
}

export async function useHint(sessionId: string) {
  const session = await getSessionState(sessionId);
  if (!session.currentCheckpoint) {
    throw new Error('Checkpoint non disponibile');
  }

  const narrativeState = safeJsonParse<NarrativeState & { hintLevels?: Record<string, number> }>(session.narrativeState, {
    hesitations: 0,
    totalHints: 0,
    userChoices: [],
    hintLevels: {}
  });

  const hintLevels = narrativeState.hintLevels ?? {};
  const hints = safeJsonParse<string[]>(session.currentCheckpoint.hints, []);
  const used = hintLevels[session.currentCheckpoint.id] ?? 0;
  const nextIndex = Math.min(used, Math.max(hints.length - 1, 0));
  const updatedState = {
    ...narrativeState,
    totalHints: narrativeState.totalHints + 1,
    hintLevels: {
      ...hintLevels,
      [session.currentCheckpoint.id]: Math.min(used + 1, hints.length)
    }
  };

  await prisma.session.update({
    where: { id: sessionId },
    data: { narrativeState: JSON.stringify(updatedState) }
  });

  return {
    hint: hints[nextIndex] ?? '',
    level: nextIndex + 1
  };
}

export async function updateSessionGeo(sessionId: string, data: {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  geoState: string;
  elapsedSeconds: number;
  ambientTrigger?: string;
  batteryLevelCurrent?: number;
}) {
  const session = await getSessionState(sessionId);
  const transitPath = safeJsonParse<Array<{ lat: number; lng: number; timestamp: number; accuracy: number }>>(session.transitPath, []);
  const nextPath = [...transitPath, { lat: data.latitude, lng: data.longitude, timestamp: data.timestamp, accuracy: data.accuracy }].slice(-200);

  return prisma.session.update({
    where: { id: sessionId },
    data: {
      lastGeoUpdate: new Date(data.timestamp),
      lastKnownLatitude: data.latitude,
      lastKnownLongitude: data.longitude,
      lastKnownAccuracy: data.accuracy,
      geoState: data.geoState,
      elapsedSeconds: data.elapsedSeconds,
      transitPath: JSON.stringify(nextPath),
      lastAmbientLineAt: data.ambientTrigger ? new Date() : undefined,
      lastAmbientTrigger: data.ambientTrigger,
      batteryLevelCurrent: data.batteryLevelCurrent
    }
  });
}

export async function forceArrival(sessionId: string) {
  return prisma.session.update({
    where: { id: sessionId },
    data: {
      geoState: 'at_place',
      lastAmbientTrigger: 'arrival',
      lastAmbientLineAt: new Date()
    }
  });
}

export async function updateSessionPermissions(sessionId: string, data: { compassPermissionGranted?: boolean; geoPermissionGranted?: boolean; batteryLevelAtStart?: number; batteryLevelCurrent?: number }) {
  return prisma.session.update({
    where: { id: sessionId },
    data
  });
}
