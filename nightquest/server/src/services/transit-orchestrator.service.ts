import type { AmbientLine, Transit } from '@prisma/client';
import { bearing, detectDeviation, detectIdle, getTransitState, haversineDistance, humanizeDistance, humanizeTime, type TransitSample } from './geo.service.js';

export type TransitInstruction = {
  newGeoState: string;
  shouldTriggerAmbient: boolean;
  ambientTrigger?: string;
  useScriptedLine: boolean;
  ombraLine?: string;
  arrivalDetected: boolean;
  compassHint?: { bearingDegrees: number; distanceMeters: number };
  distanceToTarget: number;
  humanDistance: string;
  uncertainZone: boolean;
};

const GLOBAL_COOLDOWN_SECONDS = 90;

function pickAmbientLine(lines: AmbientLine[], trigger: string, elapsedSincePrevious: number) {
  return lines.find((line) => line.trigger === trigger && elapsedSincePrevious >= line.minSecondsFromPrevious) ?? null;
}

export function evaluateTransit(params: {
  session: {
    geoState: string;
    lastKnownLatitude: number | null;
    lastKnownLongitude: number | null;
    lastAmbientLineAt: Date | null;
    lastAmbientTrigger: string | null;
    transitPath: string;
  };
  targetPlace: {
    latitude: number;
    longitude: number;
    gpsRadius: number;
    gpsUncertaintyRadius: number;
    approachHintRadius: number;
  };
  transit: (Transit & { ambientLines: AmbientLine[] }) | null;
  currentSample: TransitSample;
  elapsedSeconds: number;
  initialDistance?: number | null;
}) : TransitInstruction {
  const distanceToTarget = haversineDistance(params.currentSample.lat, params.currentSample.lng, params.targetPlace.latitude, params.targetPlace.longitude);
  const path = JSON.parse(params.session.transitPath || '[]') as TransitSample[];
  const lastAmbientSecondsAgo = params.session.lastAmbientLineAt ? Math.floor((Date.now() - params.session.lastAmbientLineAt.getTime()) / 1000) : Number.MAX_SAFE_INTEGER;
  const state = getTransitState(
    {
      geoState: params.session.geoState,
      lastKnownLatitude: params.currentSample.lat,
      lastKnownLongitude: params.currentSample.lng
    },
    params.targetPlace
  );

  let trigger: string | undefined;

  if (distanceToTarget <= params.targetPlace.gpsRadius) {
    trigger = 'arrival';
  } else if (detectDeviation([...path, params.currentSample], params.targetPlace, 3)) {
    trigger = 'deviation';
  } else if (detectIdle([...path, params.currentSample], 180)) {
    trigger = 'idle';
  } else if (distanceToTarget <= params.targetPlace.approachHintRadius) {
    trigger = 'approaching';
  } else if (params.initialDistance && distanceToTarget <= params.initialDistance / 2) {
    trigger = 'halfway';
  } else if (!params.session.lastAmbientTrigger && params.elapsedSeconds <= 20) {
    trigger = 'start';
  }

  const shouldTriggerAmbient = Boolean(trigger) && (trigger === 'arrival' || lastAmbientSecondsAgo >= GLOBAL_COOLDOWN_SECONDS);
  const scriptedLine = trigger && shouldTriggerAmbient && params.transit ? pickAmbientLine(params.transit.ambientLines, trigger, lastAmbientSecondsAgo) : null;

  return {
    newGeoState: trigger === 'deviation' ? 'deviating' : trigger === 'idle' ? 'idle' : state === 'arrived' ? 'at_place' : state,
    shouldTriggerAmbient,
    ambientTrigger: shouldTriggerAmbient ? trigger : undefined,
    useScriptedLine: Boolean(scriptedLine),
    ombraLine: scriptedLine?.text,
    arrivalDetected: trigger === 'arrival',
    compassHint: {
      bearingDegrees: bearing(params.currentSample.lat, params.currentSample.lng, params.targetPlace.latitude, params.targetPlace.longitude),
      distanceMeters: distanceToTarget
    },
    distanceToTarget,
    humanDistance: humanizeDistance(distanceToTarget),
    uncertainZone: distanceToTarget > params.targetPlace.gpsRadius && distanceToTarget <= params.targetPlace.gpsUncertaintyRadius
  };
}

export function buildGeoNarrativeFacts(distanceMeters: number, elapsedSeconds: number) {
  return {
    humanDistance: humanizeDistance(distanceMeters),
    humanElapsed: humanizeTime(elapsedSeconds)
  };
}
