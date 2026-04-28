import { z } from 'zod';

export const checkpointTypeSchema = z.enum([
  'keyword',
  'multiple_choice',
  'observation_confirm',
  'count',
  'sequence',
  'walk_blind'
]);

export const adminRoleSchema = z.enum(['admin', 'editor']);

export const citySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  active: z.boolean(),
  openingLine: z.string()
});

export const createSessionSchema = z.object({
  cityId: z.string(),
  alias: z.string().min(2).max(24)
});

export const answerSchema = z.object({
  checkpointId: z.string(),
  input: z.union([z.string(), z.number(), z.boolean(), z.record(z.any())])
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const checkpointInputSchema = z.object({
  id: z.string().optional(),
  order: z.number().int().min(1),
  type: checkpointTypeSchema,
  prompt: z.string().min(3),
  validationRule: z.record(z.any()).default({}),
  hints: z.array(z.string()).length(3),
  acceptAny: z.boolean().default(false)
});

export const missionInputSchema = z.object({
  id: z.string().optional(),
  cityId: z.string(),
  placeId: z.string(),
  title: z.string().min(2),
  toneSlug: z.string(),
  difficulty: z.number().int().min(1).max(5),
  objective: z.string().min(3),
  openingBrief: z.string().min(3),
  successNote: z.string().min(3),
  order: z.number().int().min(1),
  active: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  checkpoints: z.array(checkpointInputSchema).min(1)
});

export const toneInputSchema = z.object({
  id: z.string().optional(),
  slug: z.string().min(2),
  name: z.string().min(2),
  guidelines: z.string().min(3),
  bannedWords: z.array(z.string()).default([]),
  examples: z.array(z.string()).default([])
});

export const placeInputSchema = z.object({
  id: z.string().optional(),
  cityId: z.string(),
  name: z.string().min(2),
  zone: z.string().min(2),
  latitude: z.number(),
  longitude: z.number(),
  gpsRadius: z.number().int().min(5).default(30),
  gpsUncertaintyRadius: z.number().int().min(5).default(50),
  fallbackAllowed: z.boolean().default(true),
  approachHintRadius: z.number().int().min(10).default(150),
  atmosphere: z.string().min(3),
  hint: z.string().min(3),
  active: z.boolean().default(true)
});

export const geoUpdateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().min(0),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
  timestamp: z.number()
});

export const arriveSchema = z.object({
  reason: z.enum(['manual', 'fallback_uncertain', 'lost_mode'])
});

export const compassPermissionSchema = z.object({
  granted: z.boolean()
});

export const geoPermissionSchema = z.object({
  granted: z.boolean()
});

const EARTH_RADIUS_METERS = 6371000;

export type TransitState = 'in_transit' | 'approaching' | 'uncertain_zone' | 'arrived' | 'deviating';

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type TransitSample = GeoPoint & {
  timestamp: number;
  accuracy: number;
};

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function isWithinRadius(lat1: number, lng1: number, lat2: number, lng2: number, radiusMeters: number) {
  return haversineDistance(lat1, lng1, lat2, lng2) <= radiusMeters;
}

export function getTransitState(
  session: { geoState?: string; lastKnownLatitude?: number | null; lastKnownLongitude?: number | null },
  targetPlace: { latitude: number; longitude: number; gpsRadius: number; gpsUncertaintyRadius: number; approachHintRadius: number }
): TransitState {
  if (session.lastKnownLatitude == null || session.lastKnownLongitude == null) {
    return 'in_transit';
  }

  const distance = haversineDistance(session.lastKnownLatitude, session.lastKnownLongitude, targetPlace.latitude, targetPlace.longitude);
  if (distance <= targetPlace.gpsRadius) {
    return 'arrived';
  }
  if (distance <= targetPlace.gpsUncertaintyRadius) {
    return 'uncertain_zone';
  }
  if (distance <= targetPlace.approachHintRadius) {
    return 'approaching';
  }
  if (session.geoState === 'deviating') {
    return 'deviating';
  }
  return 'in_transit';
}

export function detectDeviation(transitPath: TransitSample[], targetPlace: { latitude: number; longitude: number }, windowSize = 3) {
  if (transitPath.length < windowSize) {
    return false;
  }

  const recent = transitPath.slice(-windowSize);
  const distances = recent.map((sample) => haversineDistance(sample.lat, sample.lng, targetPlace.latitude, targetPlace.longitude));
  let increases = 0;
  for (let index = 1; index < distances.length; index += 1) {
    if (distances[index] - distances[index - 1] > 20) {
      increases += 1;
    }
  }
  return increases >= windowSize - 1;
}

export function detectIdle(transitPath: TransitSample[], thresholdSeconds = 180) {
  if (transitPath.length < 2) {
    return false;
  }

  const latest = transitPath[transitPath.length - 1];
  const thresholdTimestamp = latest.timestamp - thresholdSeconds * 1000;
  const recent = transitPath.filter((sample) => sample.timestamp >= thresholdTimestamp);
  if (recent.length < 2) {
    return false;
  }

  const anchor = recent[0];
  return recent.every((sample) => haversineDistance(anchor.lat, anchor.lng, sample.lat, sample.lng) <= 15);
}

export function humanizeDistance(meters: number) {
  const safe = clamp(meters, 0, Number.MAX_SAFE_INTEGER);
  if (safe > 800) return 'cammina ancora parecchio';
  if (safe > 500) return 'sette minuti buoni';
  if (safe > 300) return `circa ${Math.max(100, Math.round((safe / 1.3) / 100) * 100)} passi`;
  if (safe > 150) return `poco piu di ${Math.max(2, Math.round(safe / 80))} minuti`;
  if (safe > 80) return 'una piazza lontana';
  if (safe > 50) return 'un soffio';
  if (safe > 30) return 'sei vicino';
  return 'sei arrivato - guardati intorno';
}

export function humanizeTime(seconds: number) {
  if (seconds < 120) return 'da poco';
  if (seconds < 1800) return `${Math.round(seconds / 60)} minuti`;
  if (seconds < 3600) return seconds < 2400 ? 'e passata mezz ora' : 'quasi un ora';
  if (seconds < 5400) return 'un ora';
  if (seconds < 7200) return 'piu di un ora';
  return 'la notte e larga, ma non infinita';
}

export const systemPromptInputSchema = z.object({
  content: z.string().min(10)
});

export const placeFactsItemSchema = z.object({
  category: z.string().optional(),
  description: z.string().optional(),
  countable: z.boolean().optional(),
  exactCount: z.number().optional(),
  sense: z.enum(['sight', 'sound', 'smell', 'touch']).optional(),
  fact: z.string().optional(),
  source: z.string().optional(),
  detail: z.string().optional(),
  verifiableByUser: z.boolean().optional()
});

export const placeFactsInputSchema = z.object({
  placeId: z.string(),
  visualElements: z.array(placeFactsItemSchema).default([]),
  sensoryElements: z.array(placeFactsItemSchema).default([]),
  historicalFacts: z.array(placeFactsItemSchema).default([]),
  notableDetails: z.array(placeFactsItemSchema).default([]),
  adminNotes: z.string().optional(),
  confirmedBy: z.string().optional()
});

export const generationRequestSchema = z.object({
  cityId: z.string(),
  placeIds: z.array(z.string()).min(1).max(5),
  missionCount: z.number().int().min(1).max(5),
  style: z.enum(['misterioso', 'provocatorio', 'contemplativo', 'giocoso', 'misto']),
  targetDurationMinutes: z.union([z.literal(60), z.literal(90), z.literal(120)]),
  customConstraints: z.string().optional(),
  excludeTones: z.array(z.string()).optional(),
  requireDifficultyProgression: z.boolean().optional(),
  forceRefresh: z.boolean().optional(),
  confirmHighCost: z.boolean().optional()
});

export const generatedCheckpointSchema = z.object({
  order: z.number().int().min(1),
  type: z.enum(['keyword', 'multiple_choice', 'observation_confirm', 'count']),
  prompt: z.string().min(3),
  validationRule: z.record(z.any()),
  hints: z.tuple([z.string(), z.string(), z.string()]),
  acceptAny: z.boolean().optional(),
  options: z.array(z.string()).optional()
});

export const generatedMissionSchema = z.object({
  title: z.string().min(2),
  placeId: z.string(),
  toneSlug: z.string(),
  difficulty: z.number().int().min(1).max(3),
  objective: z.string().min(3),
  openingBrief: z.string().min(3),
  successNote: z.string().min(3),
  tags: z.array(z.string()).default([])
});

export const generatedTransitSchema = z.object({
  estimatedMinutes: z.number().int().min(1).max(25),
  recommendedPath: z.array(z.any()).optional(),
  ambientLines: z.array(
    z.object({
      trigger: z.enum(['start', 'halfway', 'approaching', 'arrival', 'idle', 'deviation']),
      text: z.string().min(3),
      order: z.number().int().min(1)
    })
  ).min(4).max(6)
}).nullable();

export const generatedBundleSchema = z.object({
  order: z.number().int().min(1),
  mission: generatedMissionSchema,
  checkpoints: z.array(generatedCheckpointSchema).length(2),
  transit: generatedTransitSchema
});

export const generatedPreviewSchema = z.object({
  missions: z.array(generatedBundleSchema).min(1).max(5),
  narrativeArc: z.string().min(3)
});

export const proposalReviewSchema = z.object({
  proposedMission: z.record(z.any()).optional(),
  proposedCheckpoints: z.array(z.record(z.any())).optional(),
  proposedTransit: z.record(z.any()).nullable().optional(),
  modifications: z.array(z.record(z.any())).optional()
});

export const proposalRejectSchema = z.object({
  reason: z.string().min(3)
});

export const cityInputSchema = z.object({
  id: z.string().optional(),
  slug: z.string().min(2),
  name: z.string().min(2),
  active: z.boolean().default(true),
  openingLine: z.string().min(3)
});

export type CheckpointType = z.infer<typeof checkpointTypeSchema>;
export type AdminRole = z.infer<typeof adminRoleSchema>;
export type CityInput = z.infer<typeof cityInputSchema>;
export type PlaceInput = z.infer<typeof placeInputSchema>;
export type ToneInput = z.infer<typeof toneInputSchema>;
export type MissionInput = z.infer<typeof missionInputSchema>;
