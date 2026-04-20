import { Router } from 'express';
import { answerSchema, arriveSchema, compassPermissionSchema, createSessionSchema, geoPermissionSchema, geoUpdateSchema } from '@nightquest/shared';
import { getActiveCities } from '../services/mission-library.service.js';
import { buildBriefing } from '../services/orchestrator.service.js';
import { advanceSession, forceArrival, getSessionState, initSession, registerHesitation, updateSessionGeo, updateSessionPermissions, useHint, validateAnswer } from '../services/progression.service.js';
import { speak } from '../services/narrator.service.js';
import { trackSessionEvent } from '../services/telemetry.service.js';
import { safeJsonParse } from '../utils.js';
import { evaluateTransit } from '../services/transit-orchestrator.service.js';
import { haversineDistance, humanizeDistance } from '../services/geo.service.js';
import { getCurrentElapsed, humanizeElapsed } from '../services/timer.service.js';

export const publicRouter = Router();

publicRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

publicRouter.get('/api/cities', async (_req, res) => {
  const cities = await getActiveCities();
  res.json(cities);
});

publicRouter.post('/api/sessions', async (req, res) => {
  const input = createSessionSchema.parse(req.body);
  const session = await initSession(input.cityId, input.alias);
  await trackSessionEvent(session.id, 'session_started', { alias: input.alias, cityId: input.cityId });
  const ombraLine = await speak(await buildBriefing(session.id, 'session_start'));
  res.status(201).json({ session, ombraLine });
});

publicRouter.get('/api/sessions/:id', async (req, res) => {
  const session = await getSessionState(req.params.id);
  res.json(session);
});

publicRouter.get('/api/sessions/:id/state', async (req, res) => {
  const session = await getSessionState(req.params.id);
  const elapsedSeconds = getCurrentElapsed(session);
  const ombraLine = await speak(await buildBriefing(req.params.id, 'resume', { elapsedSeconds }));
  res.json({
    session: await getSessionState(req.params.id),
    ombraLine,
    timerSnapshot: {
      elapsedSeconds,
      humanElapsed: humanizeElapsed(elapsedSeconds)
    }
  });
});

publicRouter.post('/api/sessions/:id/answer', async (req, res) => {
  const input = answerSchema.parse(req.body);
  const validation = await validateAnswer(req.params.id, input.checkpointId, input.input);

  if (!validation.valid) {
    await registerHesitation(req.params.id);
    await trackSessionEvent(req.params.id, 'answer_invalid', { checkpointId: input.checkpointId, input: input.input });
    const ombraLine = await speak(await buildBriefing(req.params.id, 'answer_invalid', { userInput: input.input }));
    return res.json({ valid: false, ombraLine, nextState: await getSessionState(req.params.id) });
  }

  await advanceSession(req.params.id, input.input);
  await trackSessionEvent(req.params.id, 'answer_valid', { checkpointId: input.checkpointId, input: input.input });
  const nextState = await getSessionState(req.params.id);
  const narrativeState = safeJsonParse<{ totalHints?: number; hesitations?: number }>(nextState.narrativeState, {});
  const walkBlindExtra =
    validation.session.currentCheckpoint?.type === 'walk_blind' && typeof input.input === 'object' && input.input !== null
      ? { challengeOutcome: (input.input as Record<string, unknown>).outcome ?? 'partial' }
      : {};
  const ombraLine = nextState.finishedAt
    ? await speak(await buildBriefing(req.params.id, 'finale', { narrativeState }))
    : await speak(await buildBriefing(req.params.id, 'answer_valid', { userInput: input.input, ...walkBlindExtra }));

  return res.json({
    valid: true,
    nextState,
    ombraLine
  });
});

publicRouter.post('/api/sessions/:id/hint', async (req, res) => {
  const { hint, level } = await useHint(req.params.id);
  await trackSessionEvent(req.params.id, 'hint_requested', { level });
  const ombraLine = await speak(await buildBriefing(req.params.id, 'hint_request', { level }));
  res.json({ hintText: hint, level, ombraLine });
});

publicRouter.post('/api/sessions/:id/narrator', async (req, res) => {
  const eventType = String(req.body?.eventType ?? 'ambient');
  const ombraLine = await speak(await buildBriefing(req.params.id, eventType));
  res.json({ ombraLine });
});

publicRouter.post('/api/sessions/:id/geo', async (req, res) => {
  const input = geoUpdateSchema.parse(req.body);
  const session = await getSessionState(req.params.id);
  const elapsedSeconds = getCurrentElapsed(session);

  if (session.lastGeoUpdate && Date.now() - session.lastGeoUpdate.getTime() < 2000) {
    const distanceToTarget =
      session.currentMission?.place && session.lastKnownLatitude != null && session.lastKnownLongitude != null
        ? Math.round(
            haversineDistance(
              session.lastKnownLatitude,
              session.lastKnownLongitude,
              session.currentMission.place.latitude,
              session.currentMission.place.longitude
            )
          )
        : 0;

    return res.json({
      geoState: session.geoState,
      distanceToTarget,
      humanDistance: humanizeDistance(distanceToTarget),
      bearingToTarget: 0,
      arrivalDetected: session.geoState === 'at_place',
      uncertainZone: session.geoState === 'uncertain_zone',
      timerSnapshot: {
        elapsedSeconds,
        humanElapsed: humanizeElapsed(elapsedSeconds)
      }
    });
  }

  if (!session.currentMission?.place) {
    return res.status(400).json({ error: 'no_target_place' });
  }

  const transitInstruction = evaluateTransit({
    session,
    targetPlace: session.currentMission.place,
    transit: session.currentMission.transit ?? null,
    currentSample: {
      lat: input.latitude,
      lng: input.longitude,
      accuracy: input.accuracy,
      timestamp: input.timestamp
    },
    elapsedSeconds,
    initialDistance: null
  });

  let ombraLine: string | undefined;
  if (transitInstruction.shouldTriggerAmbient) {
    ombraLine = transitInstruction.ombraLine;
    if (!ombraLine) {
      ombraLine = await speak(
        await buildBriefing(req.params.id, 'ambient', {
          geoTrigger: transitInstruction.ambientTrigger,
          humanDistance: transitInstruction.humanDistance,
          distanceToTarget: transitInstruction.distanceToTarget
        })
      );
    }
  }

  await updateSessionGeo(req.params.id, {
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
    timestamp: input.timestamp,
    geoState: transitInstruction.newGeoState,
    elapsedSeconds,
    ambientTrigger: transitInstruction.shouldTriggerAmbient ? transitInstruction.ambientTrigger : undefined
  });

  await trackSessionEvent(req.params.id, 'geo_update', {
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
    geoState: transitInstruction.newGeoState
  });

  if (transitInstruction.arrivalDetected) {
    await trackSessionEvent(req.params.id, 'arrival', {
      latitude: input.latitude,
      longitude: input.longitude
    });
  } else if (transitInstruction.ambientTrigger === 'deviation') {
    await trackSessionEvent(req.params.id, 'deviation_detected', {});
  } else if (transitInstruction.ambientTrigger === 'idle') {
    await trackSessionEvent(req.params.id, 'idle_detected', {});
  }

  res.json({
    geoState: transitInstruction.newGeoState,
    distanceToTarget: transitInstruction.distanceToTarget,
    humanDistance: transitInstruction.humanDistance,
    bearingToTarget: transitInstruction.compassHint?.bearingDegrees ?? 0,
    arrivalDetected: transitInstruction.arrivalDetected,
    uncertainZone: transitInstruction.uncertainZone,
    ombraLine,
    ambientTrigger: transitInstruction.ambientTrigger,
    timerSnapshot: {
      elapsedSeconds,
      humanElapsed: humanizeElapsed(elapsedSeconds)
    }
  });
});

publicRouter.post('/api/sessions/:id/arrive', async (req, res) => {
  const input = arriveSchema.parse(req.body);
  await forceArrival(req.params.id);
  await trackSessionEvent(req.params.id, 'fallback_used', { reason: input.reason });
  const session = await getSessionState(req.params.id);
  const elapsedSeconds = getCurrentElapsed(session);
  const ombraLine = await speak(await buildBriefing(req.params.id, 'ambient', { manualArrival: true, reason: input.reason }));
  res.json({
    geoState: 'at_place',
    distanceToTarget: 0,
    humanDistance: 'sei arrivato — guardati intorno',
    bearingToTarget: 0,
    arrivalDetected: true,
    uncertainZone: false,
    ombraLine,
    ambientTrigger: 'arrival',
    timerSnapshot: {
      elapsedSeconds,
      humanElapsed: humanizeElapsed(elapsedSeconds)
    }
  });
});

publicRouter.post('/api/sessions/:id/compass-permission', async (req, res) => {
  const input = compassPermissionSchema.parse(req.body);
  await updateSessionPermissions(req.params.id, { compassPermissionGranted: input.granted });
  await trackSessionEvent(req.params.id, input.granted ? 'compass_permission_granted' : 'compass_unavailable', {});
  res.json({ ok: true });
});

publicRouter.post('/api/sessions/:id/geo-permission', async (req, res) => {
  const input = geoPermissionSchema.parse(req.body);
  await updateSessionPermissions(req.params.id, { geoPermissionGranted: input.granted });
  await trackSessionEvent(req.params.id, input.granted ? 'session_geo_enabled' : 'session_geo_disabled', {});
  res.json({ ok: true });
});
