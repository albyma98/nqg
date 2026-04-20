import { Prisma } from '@prisma/client';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import {
  cityInputSchema,
  generationRequestSchema,
  loginSchema,
  missionInputSchema,
  placeFactsInputSchema,
  placeInputSchema,
  proposalRejectSchema,
  proposalReviewSchema,
  systemPromptInputSchema,
  toneInputSchema
} from '@nightquest/shared';
import { prisma } from '../db/prisma.js';
import { requireAdminAuth, requireRole } from '../middleware/auth.middleware.js';
import { loginAdmin } from '../services/auth.service.js';
import {
  approveProposal,
  commitPreviewAsProposals,
  estimateGenerationCostUsd,
  generateMissionPreview,
  patchProposal,
  rejectProposal,
  validateProposal
} from '../services/mission-generation.service.js';

export const adminRouter = Router();

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toPrismaExistingJson(value: Prisma.JsonValue): Prisma.InputJsonValue | Prisma.JsonNullValueInput {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

adminRouter.post('/login', async (req, res) => {
  const input = loginSchema.parse(req.body);
  const token = await loginAdmin(input.email, input.password);
  if (!token) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  return res.json({ token });
});

adminRouter.use(requireAdminAuth);

adminRouter.get('/dashboard', async (_req, res) => {
  const [activeSessions, sessionsToday, missionsCompleted, activeCities, topFailures] = await Promise.all([
    prisma.session.count({ where: { finishedAt: null } }),
    prisma.session.count({ where: { startedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.session.count({ where: { finishedAt: { not: null } } }),
    prisma.city.count({ where: { active: true } }),
    prisma.sessionEvent.groupBy({
      by: ['type'],
      _count: true
    })
  ]);

  res.json({
    activeSessions,
    sessionsToday,
    missionsCompleted,
    completionRate: sessionsToday === 0 ? 0 : Number(((missionsCompleted / sessionsToday) * 100).toFixed(1)),
    activeCities,
    topFailures
  });
});

adminRouter.get('/cities', async (_req, res) => {
  res.json(
    await prisma.city.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            missions: true,
            places: true,
            generatedProposals: true
          }
        }
      }
    })
  );
});

adminRouter.post('/cities', async (req, res) => {
  const input = cityInputSchema.parse(req.body);
  res.status(201).json(await prisma.city.create({ data: input }));
});

adminRouter.patch('/cities/:id', async (req, res) => {
  const input = cityInputSchema.partial().parse(req.body);
  res.json(await prisma.city.update({ where: { id: req.params.id }, data: input }));
});

adminRouter.delete('/cities/:id', async (req, res) => {
  await prisma.city.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

adminRouter.get('/places', async (req, res) => {
  const cityId = String(req.query.cityId ?? '');
  res.json(
    await prisma.place.findMany({
      where: cityId ? { cityId } : undefined,
      include: { facts: true },
      orderBy: { name: 'asc' }
    })
  );
});

adminRouter.post('/places', async (req, res) => {
  const input = placeInputSchema.parse(req.body);
  res.status(201).json(await prisma.place.create({ data: input }));
});

adminRouter.patch('/places/:id', async (req, res) => {
  const input = placeInputSchema.partial().parse(req.body);
  res.json(await prisma.place.update({ where: { id: req.params.id }, data: input }));
});

adminRouter.delete('/places/:id', async (req, res) => {
  await prisma.place.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

adminRouter.get('/place-facts/:placeId', async (req, res) => {
  res.json(
    await prisma.placeFacts.findUnique({
      where: { placeId: req.params.placeId }
    })
  );
});

adminRouter.post('/place-facts', async (req, res) => {
  const input = placeFactsInputSchema.parse(req.body);
  const data = {
    placeId: input.placeId,
    visualElements: input.visualElements as object,
    sensoryElements: input.sensoryElements as object,
    historicalFacts: input.historicalFacts as object,
    notableDetails: input.notableDetails as object,
    adminNotes: input.adminNotes,
    confirmedBy: req.admin?.sub ?? input.confirmedBy ?? 'unknown-admin'
  };

  const existing = await prisma.placeFacts.findUnique({ where: { placeId: input.placeId } });
  const result = existing
    ? await prisma.placeFacts.update({
        where: { placeId: input.placeId },
        data
      })
    : await prisma.placeFacts.create({ data });

  res.status(existing ? 200 : 201).json(result);
});

adminRouter.patch('/place-facts/:placeId', async (req, res) => {
  const input = placeFactsInputSchema.partial().parse(req.body);
  const existing = await prisma.placeFacts.findUnique({ where: { placeId: req.params.placeId } });
  if (!existing) {
    return res.status(404).json({ error: 'place_facts_not_found' });
  }

  res.json(
    await prisma.placeFacts.update({
      where: { placeId: req.params.placeId },
      data: {
        visualElements: input.visualElements ? toPrismaJson(input.visualElements) : toPrismaExistingJson(existing.visualElements),
        sensoryElements: input.sensoryElements ? toPrismaJson(input.sensoryElements) : toPrismaExistingJson(existing.sensoryElements),
        historicalFacts: input.historicalFacts ? toPrismaJson(input.historicalFacts) : toPrismaExistingJson(existing.historicalFacts),
        notableDetails: input.notableDetails ? toPrismaJson(input.notableDetails) : toPrismaExistingJson(existing.notableDetails),
        adminNotes: input.adminNotes ?? existing.adminNotes,
        confirmedBy: req.admin?.sub ?? existing.confirmedBy
      }
    })
  );
});

adminRouter.get('/tones', async (_req, res) => {
  res.json(await prisma.tone.findMany({ orderBy: { slug: 'asc' } }));
});

adminRouter.post('/tones', async (req, res) => {
  const input = toneInputSchema.parse(req.body);
  res.status(201).json(
    await prisma.tone.create({
      data: {
        ...input,
        bannedWords: JSON.stringify(input.bannedWords),
        examples: JSON.stringify(input.examples)
      }
    })
  );
});

adminRouter.patch('/tones/:id', async (req, res) => {
  const input = toneInputSchema.partial().parse(req.body);
  res.json(
    await prisma.tone.update({
      where: { id: req.params.id },
      data: {
        ...input,
        bannedWords: input.bannedWords ? JSON.stringify(input.bannedWords) : undefined,
        examples: input.examples ? JSON.stringify(input.examples) : undefined
      }
    })
  );
});

adminRouter.get('/missions', async (req, res) => {
  const cityId = String(req.query.cityId ?? '');
  res.json(
    await prisma.mission.findMany({
      where: cityId ? { cityId } : undefined,
      include: {
        place: true,
        tone: true,
        checkpoints: { orderBy: { order: 'asc' } },
        transit: {
          include: {
            ambientLines: { orderBy: { order: 'asc' } }
          }
        }
      },
      orderBy: { order: 'asc' }
    })
  );
});

adminRouter.post('/missions', async (req, res) => {
  const input = missionInputSchema.parse(req.body);
  const { checkpoints, ...missionData } = input;
  const mission = await prisma.mission.create({
    data: {
      ...missionData,
      tags: JSON.stringify(missionData.tags),
      checkpoints: {
        create: checkpoints.map((checkpoint) => ({
          ...checkpoint,
          validationRule: JSON.stringify(checkpoint.validationRule),
          hints: JSON.stringify(checkpoint.hints)
        }))
      }
    },
    include: { checkpoints: { orderBy: { order: 'asc' } } }
  });
  res.status(201).json(mission);
});

adminRouter.patch('/missions/:id', async (req, res) => {
  const input = missionInputSchema.partial().parse(req.body);
  const checkpoints = input.checkpoints;

  if (checkpoints) {
    await prisma.checkpoint.deleteMany({ where: { missionId: req.params.id } });
  }

  res.json(
    await prisma.mission.update({
      where: { id: req.params.id },
      data: {
        ...input,
        tags: input.tags ? JSON.stringify(input.tags) : undefined,
        checkpoints: checkpoints
          ? {
              create: checkpoints.map((checkpoint) => ({
                ...checkpoint,
                validationRule: JSON.stringify(checkpoint.validationRule),
                hints: JSON.stringify(checkpoint.hints)
              }))
            }
          : undefined
      },
      include: {
        checkpoints: { orderBy: { order: 'asc' } },
        transit: {
          include: {
            ambientLines: { orderBy: { order: 'asc' } }
          }
        }
      }
    })
  );
});

adminRouter.delete('/missions/:id', async (req, res) => {
  await prisma.mission.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

adminRouter.get('/transits/:missionId', async (req, res) => {
  res.json(
    await prisma.transit.findUnique({
      where: { missionId: req.params.missionId },
      include: {
        ambientLines: { orderBy: { order: 'asc' } }
      }
    })
  );
});

adminRouter.post('/transits/:missionId', async (req, res) => {
  const transit = await prisma.transit.create({
    data: {
      missionId: req.params.missionId,
      estimatedMinutes: Number(req.body.estimatedMinutes ?? 3),
      recommendedPath: req.body.recommendedPath ? JSON.stringify(req.body.recommendedPath) : null
    }
  });
  res.status(201).json(transit);
});

adminRouter.patch('/transits/:missionId', async (req, res) => {
  const existing = await prisma.transit.findUnique({ where: { missionId: req.params.missionId } });
  if (!existing) {
    return res.status(404).json({ error: 'transit_not_found' });
  }

  res.json(
    await prisma.transit.update({
      where: { missionId: req.params.missionId },
      data: {
        estimatedMinutes: req.body.estimatedMinutes,
        recommendedPath: req.body.recommendedPath ? JSON.stringify(req.body.recommendedPath) : existing.recommendedPath
      }
    })
  );
});

adminRouter.delete('/transits/:missionId', async (req, res) => {
  await prisma.transit.delete({ where: { missionId: req.params.missionId } });
  res.status(204).send();
});

adminRouter.get('/ambient-lines', async (req, res) => {
  const transitId = String(req.query.transitId ?? '');
  res.json(
    await prisma.ambientLine.findMany({
      where: transitId ? { transitId } : undefined,
      orderBy: { order: 'asc' }
    })
  );
});

adminRouter.post('/ambient-lines', async (req, res) => {
  res.status(201).json(
    await prisma.ambientLine.create({
      data: {
        transitId: String(req.body.transitId),
        trigger: req.body.trigger,
        text: String(req.body.text),
        tone: req.body.tone ? String(req.body.tone) : null,
        order: Number(req.body.order ?? 1),
        minSecondsFromPrevious: Number(req.body.minSecondsFromPrevious ?? 60)
      }
    })
  );
});

adminRouter.patch('/ambient-lines/:id', async (req, res) => {
  res.json(
    await prisma.ambientLine.update({
      where: { id: req.params.id },
      data: {
        trigger: req.body.trigger,
        text: req.body.text,
        tone: req.body.tone,
        order: req.body.order,
        minSecondsFromPrevious: req.body.minSecondsFromPrevious
      }
    })
  );
});

adminRouter.delete('/ambient-lines/:id', async (req, res) => {
  await prisma.ambientLine.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

adminRouter.post('/ambient-lines/generate', async (req, res) => {
  const missionTitle = String(req.body.missionTitle ?? 'Missione');
  res.json({
    items: [
      { trigger: 'start', text: `${missionTitle}: il tragitto e gia parte della prova.` },
      { trigger: 'halfway', text: 'Sei a meta, o abbastanza vicino da crederlo.' },
      { trigger: 'approaching', text: 'La distanza si e fatta piu breve del dubbio.' }
    ]
  });
});

adminRouter.get('/checkpoints', async (req, res) => {
  res.json(await prisma.checkpoint.findMany({ where: { missionId: String(req.query.missionId ?? '') }, orderBy: { order: 'asc' } }));
});

adminRouter.get('/system-prompt', async (_req, res) => {
  const versions = await prisma.systemPromptVersion.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ current: versions[0] ?? null, versions });
});

adminRouter.patch('/system-prompt', async (req, res) => {
  const input = systemPromptInputSchema.parse(req.body);
  const version = await prisma.systemPromptVersion.create({ data: input });
  res.json(version);
});

adminRouter.post('/system-prompt/sandbox', async (req, res) => {
  const input = systemPromptInputSchema.parse(req.body);
  res.json({
    prompt: input.content,
    briefing: req.body?.briefing ?? null
  });
});

adminRouter.post('/generation/missions/preview', async (req, res) => {
  const input = generationRequestSchema.parse(req.body);
  const estimatedCostUsd = estimateGenerationCostUsd(input);

  try {
    const result = await generateMissionPreview(input);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'generation_failed';
    if (message === 'daily_limit_exceeded' || message === 'concurrency_limit_exceeded') {
      return res.status(429).json({ error: message });
    }
    if (message === 'high_cost_confirmation_required') {
      return res.status(412).json({ error: message, estimatedCostUsd });
    }
    if (message.startsWith('missing_place_facts')) {
      return res.status(400).json({ error: message });
    }
    return res.status(400).json({ error: message, estimatedCostUsd });
  }
});

adminRouter.post('/generation/missions/commit', async (req, res) => {
  const requestInput = generationRequestSchema.parse(req.body.request);
  const preview = req.body.preview as { missions: Array<Record<string, unknown>>; narrativeArc: string };
  const validationResult = await validateProposal(preview, requestInput.cityId);
  const generationModel = String(req.body.generationModel ?? 'gpt-4o-mini');
  const generationCost = Number(req.body.generationCost ?? estimateGenerationCostUsd(requestInput));

  const created = await commitPreviewAsProposals({
    request: requestInput,
    preview,
    generationModel,
    generationCost
  });

  res.status(201).json({
    ...created,
    validationResult
  });
});

adminRouter.get('/generation/proposals', async (req, res) => {
  const cityId = String(req.query.cityId ?? '');
  const status = String(req.query.status ?? '');
  res.json(
    await prisma.generatedMissionProposal.findMany({
      where: {
        ...(cityId ? { cityId } : {}),
        ...(status ? { status } : {})
      },
      include: {
        city: true,
        approvedAsMission: true
      },
      orderBy: { generatedAt: 'desc' }
    })
  );
});

adminRouter.get('/generation/proposals/:id', async (req, res) => {
  res.json(
    await prisma.generatedMissionProposal.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        city: true,
        approvedAsMission: {
          include: {
            place: true,
            checkpoints: true,
            transit: { include: { ambientLines: true } }
          }
        }
      }
    })
  );
});

adminRouter.patch('/generation/proposals/:id', async (req, res) => {
  const input = proposalReviewSchema.parse(req.body);
  res.json(
    await patchProposal({
      proposalId: req.params.id,
      changes: input
    })
  );
});

adminRouter.post('/generation/proposals/:id/approve', async (req, res) => {
  const input = proposalReviewSchema.partial().parse(req.body ?? {});
  const mission = await approveProposal({
    proposalId: req.params.id,
    reviewerId: req.admin?.sub ?? 'unknown-admin',
    overrides: input
  });
  res.json(mission);
});

adminRouter.post('/generation/proposals/:id/reject', async (req, res) => {
  const input = proposalRejectSchema.parse(req.body);
  res.json(await rejectProposal(req.params.id, req.admin?.sub ?? 'unknown-admin', input.reason));
});

adminRouter.get('/generation-rules', async (_req, res) => {
  res.json(await prisma.generationRule.findMany());
});

adminRouter.post('/generation-rules', async (req, res) => {
  res.status(201).json(
    await prisma.generationRule.create({
      data: {
        targetType: String(req.body.targetType),
        vincoli: JSON.stringify(req.body.vincoli ?? {}),
        examplesPositive: JSON.stringify(req.body.examplesPositive ?? []),
        examplesNegative: JSON.stringify(req.body.examplesNegative ?? []),
        validationChecklist: JSON.stringify(req.body.validationChecklist ?? [])
      }
    })
  );
});

adminRouter.patch('/generation-rules/:id', async (req, res) => {
  res.json(
    await prisma.generationRule.update({
      where: { id: req.params.id },
      data: {
        targetType: req.body.targetType,
        vincoli: req.body.vincoli ? JSON.stringify(req.body.vincoli) : undefined,
        examplesPositive: req.body.examplesPositive ? JSON.stringify(req.body.examplesPositive) : undefined,
        examplesNegative: req.body.examplesNegative ? JSON.stringify(req.body.examplesNegative) : undefined,
        validationChecklist: req.body.validationChecklist ? JSON.stringify(req.body.validationChecklist) : undefined
      }
    })
  );
});

adminRouter.post('/generation-rules/:id/run', async (_req, res) => {
  res.json({ items: [], queued: 0 });
});

adminRouter.get('/review-queue', async (_req, res) => {
  res.json([]);
});

adminRouter.patch('/review-queue', async (_req, res) => {
  res.json({ ok: true });
});

adminRouter.get('/sessions', async (_req, res) => {
  res.json(
    await prisma.session.findMany({
      include: { city: true, events: true },
      orderBy: { startedAt: 'desc' }
    })
  );
});

adminRouter.get('/sessions/:id', async (req, res) => {
  res.json(
    await prisma.session.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        city: {
          include: {
            places: { orderBy: { name: 'asc' } },
            missions: {
              include: {
                place: true
              },
              orderBy: { order: 'asc' }
            }
          }
        },
        events: { orderBy: { timestamp: 'asc' } }
      }
    })
  );
});

adminRouter.get('/users', requireRole('admin'), async (_req, res) => {
  res.json(await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } }));
});

adminRouter.post('/users', requireRole('admin'), async (req, res) => {
  const passwordHash = await bcrypt.hash(String(req.body.password), 10);
  res.status(201).json(
    await prisma.adminUser.create({
      data: {
        email: String(req.body.email),
        passwordHash,
        role: req.body.role === 'admin' ? 'admin' : 'editor'
      }
    })
  );
});

adminRouter.patch('/users/:id', requireRole('admin'), async (req, res) => {
  res.json(
    await prisma.adminUser.update({
      where: { id: String(req.params.id) },
      data: {
        role: req.body.role === 'admin' ? 'admin' : 'editor',
        active: req.body.active
      }
    })
  );
});
