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
