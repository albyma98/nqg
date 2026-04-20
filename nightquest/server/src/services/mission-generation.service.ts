import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import OpenAI from 'openai';
import { generatedPreviewSchema } from '@nightquest/shared';
import { prisma } from '../db/prisma.js';
import { config } from '../config.js';
import { getSystemPrompt, validateNarratorOutput } from './orchestrator.service.js';
import { safeJsonParse } from '../utils.js';

type GenerationRequest = {
  cityId: string;
  placeIds: string[];
  missionCount: number;
  style: 'misterioso' | 'provocatorio' | 'contemplativo' | 'giocoso' | 'misto';
  targetDurationMinutes: 60 | 90 | 120;
  customConstraints?: string;
  excludeTones?: string[];
  requireDifficultyProgression?: boolean;
  forceRefresh?: boolean;
  confirmHighCost?: boolean;
};

type ValidationResult = {
  valid: boolean;
  warnings: string[];
  errors: string[];
};

type PreviewResult = {
  preview: {
    missions: Array<Record<string, unknown>>;
    narrativeArc: string;
  };
  validationResult: ValidationResult;
  estimatedCostUsd: number;
  generationModel: string;
  diagnostics: {
    cacheHit: boolean;
    openAiAttempted: boolean;
    openAiAttempts: number;
    usedFallback: boolean;
    fallbackReason?: string;
    openAiError?: string;
  };
};

const openai = config.OPENAI_API_KEY ? new OpenAI({ apiKey: config.OPENAI_API_KEY }) : null;

const previewCache = new Map<string, { createdAt: number; value: PreviewResult }>();

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toPrismaNullableJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function toPrismaExistingNullableJson(
  value: Prisma.JsonValue | null
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}
let currentDay = new Date().toISOString().slice(0, 10);
let dailyGenerations = 0;
let concurrentGenerations = 0;

function resetDailyCounterIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== currentDay) {
    currentDay = today;
    dailyGenerations = 0;
  }
}

function createCacheKey(request: GenerationRequest) {
  return JSON.stringify({
    cityId: request.cityId,
    placeIds: request.placeIds,
    missionCount: request.missionCount,
    style: request.style,
    targetDurationMinutes: request.targetDurationMinutes,
    customConstraints: request.customConstraints ?? '',
    excludeTones: request.excludeTones ?? [],
    requireDifficultyProgression: Boolean(request.requireDifficultyProgression)
  });
}

export function estimateGenerationCostUsd(request: GenerationRequest) {
  const promptWeight =
    request.placeIds.length * 900 +
    request.missionCount * 1100 +
    (request.customConstraints?.length ?? 0) * 2 +
    2400;
  const completionWeight = request.missionCount * 1600;
  const estimatedTokens = promptWeight + completionWeight;
  return Number(((estimatedTokens / 1_000_000) * 0.9).toFixed(3));
}

async function buildGenerationContext(request: GenerationRequest) {
  const city = await prisma.city.findUnique({
    where: { id: request.cityId },
    include: {
      places: {
        where: { id: { in: request.placeIds } },
        include: { facts: true },
        orderBy: { name: 'asc' }
      },
      missions: {
        include: { place: true },
        orderBy: { order: 'asc' }
      }
    }
  });

  if (!city) {
    throw new Error('city_not_found');
  }

  if (city.places.length < 3) {
    throw new Error('not_enough_places');
  }

  const selectedPlaces = request.placeIds
    .map((placeId) => city.places.find((place) => place.id === placeId))
    .filter(Boolean);

  if (selectedPlaces.length !== request.placeIds.length) {
    throw new Error('invalid_place_selection');
  }

  const placesWithoutFacts = selectedPlaces.filter((place) => !place?.facts);
  if (placesWithoutFacts.length > 0) {
    throw new Error(`missing_place_facts:${placesWithoutFacts.map((place) => place?.name).join(', ')}`);
  }

  const tones = await prisma.tone.findMany({ orderBy: { slug: 'asc' } });
  return { city, selectedPlaces, tones };
}

function createMetaPrompt(args: {
  city: Awaited<ReturnType<typeof buildGenerationContext>>['city'];
  selectedPlaces: Awaited<ReturnType<typeof buildGenerationContext>>['selectedPlaces'];
  tones: Awaited<ReturnType<typeof buildGenerationContext>>['tones'];
  request: GenerationRequest;
}) {
  const tones = args.tones
    .filter((tone) => !(args.request.excludeTones ?? []).includes(tone.slug))
    .map((tone) => ({
      slug: tone.slug,
      name: tone.name,
      guidelines: tone.guidelines,
      bannedWords: safeJsonParse<string[]>(tone.bannedWords, [])
    }));

  const placesWithFacts = args.selectedPlaces.map((place) => ({
    id: place!.id,
    name: place!.name,
    zone: place!.zone,
    atmosphere: place!.atmosphere,
    facts: {
      visualElements: place!.facts?.visualElements ?? [],
      sensoryElements: place!.facts?.sensoryElements ?? [],
      historicalFacts: place!.facts?.historicalFacts ?? [],
      notableDetails: place!.facts?.notableDetails ?? []
    }
  }));

  return `Sei il designer narrativo di NightQuest, un'esperienza urbana notturna guidata da una presenza chiamata "L'Ombra".
Il tuo compito: generare proposte di missioni per la città di ${args.city.name}, basate su luoghi reali verificati.

CONTESTO CITTÀ
Nome: ${args.city.name}
Opening line della città: "${args.city.openingLine}"
Stile richiesto: ${args.request.style}
Durata totale target: ${args.request.targetDurationMinutes} minuti

LUOGHI DISPONIBILI (in ordine di visita suggerito)
${JSON.stringify(placesWithFacts, null, 2)}

TONI DISPONIBILI PER L'OMBRA
${JSON.stringify(tones, null, 2)}

MISSIONI GIÀ ESISTENTI IN QUESTA CITTÀ (non duplicare)
${JSON.stringify(args.city.missions.map((mission) => ({
  title: mission.title,
  place: mission.place.name,
  tags: safeJsonParse<string[]>(mission.tags, [])
})), null, 2)}

VINCOLI STRUTTURALI ASSOLUTI
- Genera esattamente ${args.request.missionCount} missioni, una per ogni luogo fornito in ordine.
- Ogni missione contiene 2 checkpoint.
- Ogni checkpoint ha 3 hint progressivi.
- Tra una missione e l'altra c'è un transit con 4-6 ambient lines.
- L'ultima missione ha transit null.
- I checkpoint devono essere verificabili fisicamente nel luogo.
- Se requireDifficultyProgression è true, usa difficoltà crescente.
- Ogni missione usa un tono diverso dalla precedente.
- Usa solo toneSlug esistenti.
- difficulty deve essere sempre 1, 2 o 3.
- Tipi checkpoint ammessi: keyword, multiple_choice, observation_confirm, count.
- ValidationRule multiple_choice: { correctAnswer: string }
- ValidationRule keyword: { acceptedAnswers: string[] }
- ValidationRule count: { exactCount: number, tolerance?: number }
- ValidationRule observation_confirm: {}
- options solo per multiple_choice.
- Ogni ambientLine deve avere sempre trigger, text e order.
- narrativeArc deve contenere almeno una frase completa, mai stringa vuota.
- customConstraints: ${args.request.customConstraints ?? 'nessuno'}
- requireDifficultyProgression: ${Boolean(args.request.requireDifficultyProgression)}

VINCOLI SULLA VOCE
- Italiano sempre
- max 2 frasi per openingBrief, successNote e ambient lines
- no emoji, no chatbotese, no "hai vinto", "hai sbagliato", "corretto", "esatto"

OUTPUT
Restituisci solo JSON valido con struttura:
{
  "missions": [
    {
      "order": 1,
      "mission": { "title": "", "placeId": "", "toneSlug": "", "difficulty": 1, "objective": "", "openingBrief": "", "successNote": "", "tags": [] },
      "checkpoints": [
        { "order": 1, "type": "keyword", "prompt": "", "validationRule": {}, "hints": ["", "", ""], "acceptAny": false },
        { "order": 2, "type": "count", "prompt": "", "validationRule": {}, "hints": ["", "", ""], "acceptAny": false }
      ],
      "transit": {
        "estimatedMinutes": 4,
        "ambientLines": [
          { "trigger": "start", "text": "", "order": 1 },
          { "trigger": "halfway", "text": "", "order": 2 },
          { "trigger": "approaching", "text": "", "order": 3 },
          { "trigger": "arrival", "text": "", "order": 4 }
        ]
      }
    }
  ],
  "narrativeArc": "La notte si apre e poi si stringe su chi cammina."
}`;
}

function chooseTone(index: number, tones: Array<{ slug: string }>) {
  return tones[index % tones.length]?.slug ?? 'enigmatico';
}

function buildFallbackPreview(args: Awaited<ReturnType<typeof buildGenerationContext>>, request: GenerationRequest): PreviewResult['preview'] {
  const usableTones = args.tones.filter((tone) => !(request.excludeTones ?? []).includes(tone.slug));
  const difficulties = request.requireDifficultyProgression
    ? [1, 1, 2, 2, 3].slice(0, request.missionCount)
    : Array.from({ length: request.missionCount }, (_, index) => (index % 3) + 1);

  const missions = args.selectedPlaces.slice(0, request.missionCount).map((place, index) => {
    const facts = place!.facts;
    const visualElements = safeJsonParse<Array<Record<string, unknown>>>(facts?.visualElements, []);
    const sensoryElements = safeJsonParse<Array<Record<string, unknown>>>(facts?.sensoryElements, []);
    const notableDetails = safeJsonParse<Array<Record<string, unknown>>>(facts?.notableDetails, []);
    const countable = visualElements.find((item) => item.countable && typeof item.exactCount === 'number');
    const keywordDetail = notableDetails[0]?.detail ?? visualElements[0]?.description ?? place!.atmosphere;
    const sensoryDetail = sensoryElements[0]?.description ?? place!.atmosphere;
    const toneSlug = chooseTone(index, usableTones);

    return {
      order: index + 1,
      mission: {
        title: `La soglia di ${place!.name}`,
        placeId: place!.id,
        toneSlug,
        difficulty: difficulties[index] ?? 1,
        objective: `Leggere ${place!.name} con attenzione vera.`,
        openingBrief: `A ${place!.name} non devi passare. Devi restare abbastanza da capire cosa nasconde.`,
        successNote: `Hai lasciato che ${place!.name} ti guardasse da vicino. La città se ne ricorderà.`,
        tags: [place!.zone.toLowerCase(), request.style, 'ai-draft']
      },
      checkpoints: [
        {
          order: 1,
          type: countable ? 'count' : 'keyword',
          prompt: countable
            ? `Conta ${String(countable.description)}. Quanti ne vedi davvero?`
            : `Osserva ${place!.name}. Quale dettaglio emerge per primo davanti a te?`,
          validationRule: countable
            ? { exactCount: Number(countable.exactCount), tolerance: 0 }
            : {
                acceptedAnswers: [String(keywordDetail).toLowerCase(), String(place!.name).toLowerCase()]
              },
          hints: [
            'Non guardare tutto. Guarda solo quello che insiste.',
            'Rallenta. Il dettaglio giusto non scappa.',
            countable
              ? `Il numero fermo e ${String(countable.exactCount)}.`
              : `La parola da cui partire e "${String(keywordDetail).split(' ')[0]}".`
          ],
          acceptAny: false
        },
        {
          order: 2,
          type: 'observation_confirm',
          prompt: `Resta in silenzio per un momento. Poi restituisci in una parola cosa senti qui.`,
          validationRule: {},
          hints: [
            'Lascialo arrivare prima di nominarlo.',
            `C'e qualcosa nell'aria: ${String(sensoryDetail).slice(0, 30)}.`,
            'Non c e risposta giusta. Ma l Ombra nota comunque come rispondi.'
          ],
          acceptAny: true
        }
      ],
      transit:
        index === request.missionCount - 1
          ? null
          : {
              estimatedMinutes: Math.max(3, Math.round(request.targetDurationMinutes / (request.missionCount * 4))),
              ambientLines: [
                { trigger: 'start', text: `Lascia ${place!.name}. Il resto della città non si mostrerà da fermo.`, order: 1 },
                { trigger: 'halfway', text: 'Il percorso sta già cambiando il tuo passo.', order: 2 },
                { trigger: 'approaching', text: 'Tra poco dovrai guardare meglio del solito.', order: 3 },
                { trigger: 'arrival', text: `Il prossimo luogo ti è già addosso. Non fare finta di niente.`, order: 4 }
              ]
            }
    };
  });

  return {
    missions,
    narrativeArc: `La notte comincia come un attraversamento e finisce come un riconoscimento. ${args.city.name} si lascia leggere a strappi, non tutta insieme.`
  };
}

async function callOpenAiPreview(context: Awaited<ReturnType<typeof buildGenerationContext>>, request: GenerationRequest) {
  if (!openai) return null;

  const systemPrompt = (await getSystemPrompt()).replace('[CITTA]', context.city.name);
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.8,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: createMetaPrompt({ ...context, request }) }
    ]
  });

  const text = response.choices[0]?.message?.content ?? '';
  const parsed = JSON.parse(text) as { missions: Array<Record<string, unknown>>; narrativeArc: string };
  const usage = response.usage;
  const estimatedCost = usage
    ? Number((((usage.prompt_tokens * 0.15 + usage.completion_tokens * 0.6) / 1_000_000)).toFixed(3))
    : estimateGenerationCostUsd(request);

  return {
    preview: normalizeGeneratedPreview(parsed, context, request),
    estimatedCost
  };
}

function defaultAmbientText(trigger: string, currentPlaceName: string, nextPlaceName?: string) {
  switch (trigger) {
    case 'start':
      return `Lascia ${currentPlaceName}. Il passo conta piu della fretta.`;
    case 'halfway':
      return 'La distanza si accorcia solo per chi continua a guardare.';
    case 'approaching':
      return nextPlaceName ? `${nextPlaceName} e gia dentro il tuo percorso.` : 'Stai entrando nella parte piu precisa del tragitto.';
    case 'arrival':
      return nextPlaceName ? `${nextPlaceName} ti sta gia aspettando, senza fretta.` : 'Sei arrivato abbastanza vicino da dover cambiare sguardo.';
    case 'idle':
      return 'Ti sei fermato abbastanza da farti notare.';
    case 'deviation':
      return 'Stai piegando altrove. La citta se n e accorta.';
    default:
      return 'Continua.';
  }
}

function normalizeGeneratedPreview(
  raw: unknown,
  context: Awaited<ReturnType<typeof buildGenerationContext>>,
  request: GenerationRequest
): PreviewResult['preview'] {
  const fallback = buildFallbackPreview(context, request);
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawMissions = Array.isArray(source.missions) ? source.missions : [];

  const missions = fallback.missions.map((fallbackBundle, index) => {
    const incomingBundle = (rawMissions[index] && typeof rawMissions[index] === 'object' ? rawMissions[index] : {}) as Record<string, unknown>;
    const incomingMission = (incomingBundle.mission && typeof incomingBundle.mission === 'object' ? incomingBundle.mission : {}) as Record<string, unknown>;
    const incomingCheckpoints = Array.isArray(incomingBundle.checkpoints) ? incomingBundle.checkpoints : [];
    const fallbackCheckpoints = Array.isArray(fallbackBundle.checkpoints) ? fallbackBundle.checkpoints : [];
    const fallbackTransit = (fallbackBundle.transit && typeof fallbackBundle.transit === 'object' ? fallbackBundle.transit : null) as Record<string, unknown> | null;
    const incomingTransit = (incomingBundle.transit && typeof incomingBundle.transit === 'object' ? incomingBundle.transit : null) as Record<string, unknown> | null;
    const fallbackMission = fallbackBundle.mission as Record<string, unknown>;
    const currentPlace = context.selectedPlaces[index];
    const nextPlace = context.selectedPlaces[index + 1];

    const normalizedCheckpoints = fallbackCheckpoints.map((fallbackCheckpoint, checkpointIndex) => {
      const incomingCheckpoint =
        incomingCheckpoints[checkpointIndex] && typeof incomingCheckpoints[checkpointIndex] === 'object'
          ? (incomingCheckpoints[checkpointIndex] as Record<string, unknown>)
          : {};
      const base = fallbackCheckpoint as Record<string, unknown>;
      const incomingHints = Array.isArray(incomingCheckpoint.hints) ? incomingCheckpoint.hints.slice(0, 3).map((hint) => String(hint ?? '')) : [];
      while (incomingHints.length < 3) {
        incomingHints.push(String((base.hints as string[] | undefined)?.[incomingHints.length] ?? ''));
      }

      return {
        ...base,
        ...incomingCheckpoint,
        order: Number(incomingCheckpoint.order ?? base.order ?? checkpointIndex + 1),
        type: String(incomingCheckpoint.type ?? base.type ?? 'keyword'),
        prompt: String(incomingCheckpoint.prompt ?? base.prompt ?? ''),
        validationRule:
          incomingCheckpoint.validationRule && typeof incomingCheckpoint.validationRule === 'object'
            ? incomingCheckpoint.validationRule
            : base.validationRule ?? {},
        hints: [incomingHints[0] ?? '', incomingHints[1] ?? '', incomingHints[2] ?? ''],
        acceptAny: Boolean(incomingCheckpoint.acceptAny ?? base.acceptAny ?? false),
        options: Array.isArray(incomingCheckpoint.options)
          ? incomingCheckpoint.options.map((option) => String(option))
          : Array.isArray(base.options)
            ? base.options
            : undefined
      };
    });

    let normalizedTransit: Record<string, unknown> | null = null;
    if (index !== request.missionCount - 1) {
      const baseTransit = fallbackTransit ?? {
        estimatedMinutes: 4,
        ambientLines: [
          { trigger: 'start', text: defaultAmbientText('start', currentPlace?.name ?? 'il luogo', nextPlace?.name), order: 1 },
          { trigger: 'halfway', text: defaultAmbientText('halfway', currentPlace?.name ?? 'il luogo', nextPlace?.name), order: 2 },
          { trigger: 'approaching', text: defaultAmbientText('approaching', currentPlace?.name ?? 'il luogo', nextPlace?.name), order: 3 },
          { trigger: 'arrival', text: defaultAmbientText('arrival', currentPlace?.name ?? 'il luogo', nextPlace?.name), order: 4 }
        ]
      };
      const incomingAmbientLines = Array.isArray(incomingTransit?.ambientLines) ? incomingTransit.ambientLines : [];
      const normalizedAmbientLines = incomingAmbientLines
        .filter((line) => line && typeof line === 'object')
        .map((line, lineIndex) => {
          const record = line as Record<string, unknown>;
          const trigger = String(record.trigger ?? ['start', 'halfway', 'approaching', 'arrival'][lineIndex] ?? 'start');
          return {
            trigger,
            text: String(record.text ?? defaultAmbientText(trigger, currentPlace?.name ?? 'il luogo', nextPlace?.name)),
            order: Number(record.order ?? lineIndex + 1)
          };
        });

      for (const trigger of ['start', 'halfway', 'approaching', 'arrival']) {
        if (!normalizedAmbientLines.some((line) => line.trigger === trigger)) {
          normalizedAmbientLines.push({
            trigger,
            text: defaultAmbientText(trigger, currentPlace?.name ?? 'il luogo', nextPlace?.name),
            order: normalizedAmbientLines.length + 1
          });
        }
      }

      normalizedTransit = {
        ...baseTransit,
        ...incomingTransit,
        estimatedMinutes: Math.max(1, Math.min(25, Number(incomingTransit?.estimatedMinutes ?? baseTransit.estimatedMinutes ?? 4))),
        ambientLines: normalizedAmbientLines.slice(0, 6).map((line, lineIndex) => ({
          trigger: line.trigger,
          text: line.text,
          order: lineIndex + 1
        }))
      };
    }

    return {
      order: index + 1,
      mission: {
        ...fallbackMission,
        ...incomingMission,
        title: String(incomingMission.title ?? fallbackMission.title ?? currentPlace?.name ?? `Missione ${index + 1}`),
        placeId: String(incomingMission.placeId ?? fallbackMission.placeId ?? currentPlace?.id ?? ''),
        toneSlug: String(incomingMission.toneSlug ?? fallbackMission.toneSlug ?? 'enigmatico'),
        difficulty: Math.max(1, Math.min(3, Number(incomingMission.difficulty ?? fallbackMission.difficulty ?? 1))),
        objective: String(incomingMission.objective ?? fallbackMission.objective ?? ''),
        openingBrief: String(incomingMission.openingBrief ?? fallbackMission.openingBrief ?? ''),
        successNote: String(incomingMission.successNote ?? fallbackMission.successNote ?? ''),
        tags: Array.isArray(incomingMission.tags) ? incomingMission.tags.map((tag) => String(tag)) : fallbackMission.tags
      },
      checkpoints: normalizedCheckpoints,
      transit: normalizedTransit
    };
  });

  const narrativeArc = String(source.narrativeArc ?? '').trim();
  return {
    missions,
    narrativeArc: narrativeArc.length >= 3 ? narrativeArc : fallback.narrativeArc
  };
}

export async function validateProposal(preview: PreviewResult['preview'], cityId: string): Promise<ValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const tones = await prisma.tone.findMany();
  const toneBySlug = new Map(tones.map((tone) => [tone.slug, tone]));
  const places = await prisma.place.findMany({ where: { cityId }, include: { facts: true } });
  const placeById = new Map(places.map((place) => [place.id, place]));

  if (preview.missions.length === 0) {
    errors.push('Nessuna missione generata');
  }

  const usedTones = new Set<string>();

  preview.missions.forEach((bundle, index) => {
    const mission = bundle.mission as Record<string, unknown>;
    const checkpoints = bundle.checkpoints as Array<Record<string, unknown>>;
    const transit = bundle.transit as Record<string, unknown> | null;
    const toneSlug = String(mission.toneSlug ?? '');
    const placeId = String(mission.placeId ?? '');
    const place = placeById.get(placeId);
    const facts = place?.facts;

    if (!toneBySlug.has(toneSlug)) {
      errors.push(`Missione ${index + 1}: toneSlug inesistente (${toneSlug})`);
    } else {
      usedTones.add(toneSlug);
    }

    if (!place) {
      errors.push(`Missione ${index + 1}: placeId non valido`);
    }

    if (!Array.isArray(checkpoints) || checkpoints.length !== 2) {
      errors.push(`Missione ${index + 1}: numero checkpoint non valido`);
    }

    checkpoints.forEach((checkpoint, checkpointIndex) => {
      const hints = checkpoint.hints as string[];
      if (!Array.isArray(hints) || hints.length !== 3) {
        errors.push(`Missione ${index + 1}, checkpoint ${checkpointIndex + 1}: hint non validi`);
      }

      if (String(checkpoint.prompt ?? '').length > 200) {
        warnings.push(`Missione ${index + 1}, checkpoint ${checkpointIndex + 1}: prompt lungo`);
      }

      if (Array.isArray(hints) && hints.some((hint) => String(hint).length > 100)) {
        warnings.push(`Missione ${index + 1}, checkpoint ${checkpointIndex + 1}: hint troppo lunghi`);
      }

      const type = String(checkpoint.type ?? '');
      const rule = (checkpoint.validationRule ?? {}) as Record<string, unknown>;
      if (type === 'multiple_choice' && typeof rule.correctAnswer !== 'string') {
        errors.push(`Missione ${index + 1}, checkpoint ${checkpointIndex + 1}: correctAnswer mancante`);
      }
      if (type === 'keyword' && !Array.isArray(rule.acceptedAnswers)) {
        errors.push(`Missione ${index + 1}, checkpoint ${checkpointIndex + 1}: acceptedAnswers mancanti`);
      }
      if (type === 'count' && typeof rule.exactCount !== 'number') {
        errors.push(`Missione ${index + 1}, checkpoint ${checkpointIndex + 1}: exactCount mancante`);
      }

      const visualFacts = safeJsonParse<Array<Record<string, unknown>>>(facts?.visualElements, []);
      if (type === 'count' && !visualFacts.some((item) => item.countable === true)) {
        warnings.push(`Missione ${index + 1}, checkpoint ${checkpointIndex + 1}: count senza fact countable confermato`);
      }
    });

    if (typeof mission.difficulty !== 'number' || Number(mission.difficulty) < 1 || Number(mission.difficulty) > 3) {
      errors.push(`Missione ${index + 1}: difficulty fuori range`);
    }

    [mission.openingBrief, mission.successNote].forEach((text) => {
      const phrase = String(text ?? '');
      if (!validateNarratorOutput(phrase)) {
        warnings.push(`Missione ${index + 1}: briefing o successNote fuori tono`);
      }
    });

    if (transit) {
      const ambientLines = Array.isArray(transit.ambientLines) ? transit.ambientLines : [];
      ambientLines.forEach((line, lineIndex) => {
        if (!validateNarratorOutput(String((line as Record<string, unknown>).text ?? ''))) {
          warnings.push(`Missione ${index + 1}, transit line ${lineIndex + 1}: testo fuori tono`);
        }
      });
    }
  });

  if (usedTones.size < Math.min(2, preview.missions.length)) {
    warnings.push('Diversità toni bassa');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
}

export async function generateMissionPreview(request: GenerationRequest): Promise<PreviewResult> {
  resetDailyCounterIfNeeded();
  const cacheKey = createCacheKey(request);
  const cached = previewCache.get(cacheKey);
  if (cached && !request.forceRefresh && Date.now() - cached.createdAt < 10 * 60 * 1000) {
    return {
      ...cached.value,
      diagnostics: {
        ...cached.value.diagnostics,
        cacheHit: true
      }
    };
  }

  if (dailyGenerations >= config.GENERATION_DAILY_LIMIT) {
    throw new Error('daily_limit_exceeded');
  }
  if (concurrentGenerations >= config.GENERATION_CONCURRENT_LIMIT) {
    throw new Error('concurrency_limit_exceeded');
  }

  const estimatedCostUsd = estimateGenerationCostUsd(request);
  if (estimatedCostUsd > config.GENERATION_CONFIRM_COST_THRESHOLD_USD && !request.confirmHighCost) {
    throw new Error('high_cost_confirmation_required');
  }

  concurrentGenerations += 1;
  try {
    const context = await buildGenerationContext(request);
    let preview: PreviewResult['preview'];
    let generationModel = 'fallback-local';
    let measuredCost = estimatedCostUsd;
    let openAiAttempted = false;
    let openAiAttempts = 0;
    let usedFallback = false;
    let fallbackReason: string | undefined;
    let openAiError: string | undefined;

    try {
      const aiResult = await callOpenAiPreview(context, request);
      if (aiResult) {
        openAiAttempted = true;
        openAiAttempts = 1;
        preview = generatedPreviewSchema.parse(aiResult.preview);
        generationModel = 'gpt-4o-mini';
        measuredCost = aiResult.estimatedCost;
      } else {
        usedFallback = true;
        fallbackReason = 'openai_not_configured';
        preview = generatedPreviewSchema.parse(buildFallbackPreview(context, request));
      }
    } catch (error) {
      openAiAttempted = Boolean(openai);
      openAiAttempts = openai ? 1 : 0;
      usedFallback = true;
      fallbackReason = 'openai_failed';
      openAiError = error instanceof Error ? error.message : 'openai_failed';
      preview = generatedPreviewSchema.parse(buildFallbackPreview(context, request));
    }

    const validationResult = await validateProposal(preview, request.cityId);
    if (generationModel === 'gpt-4o-mini' && !validationResult.valid) {
      fallbackReason = 'ai_validation_failed';
    }

    const result = {
      preview,
      validationResult,
      estimatedCostUsd: measuredCost,
      generationModel,
      diagnostics: {
        cacheHit: false,
        openAiAttempted,
        openAiAttempts,
        usedFallback,
        fallbackReason,
        openAiError
      }
    };
    previewCache.set(cacheKey, { createdAt: Date.now(), value: result });
    dailyGenerations += 1;
    return result;
  } finally {
    concurrentGenerations -= 1;
  }
}

export async function commitPreviewAsProposals(args: {
  request: GenerationRequest;
  preview: PreviewResult['preview'];
  generationModel: string;
  generationCost: number;
}) {
  const batchId = randomUUID();
  const created = [];

  for (const bundle of args.preview.missions) {
    const proposal = await prisma.generatedMissionProposal.create({
      data: {
        batchId,
        cityId: args.request.cityId,
        status: 'pending',
        proposedMission: toPrismaJson(bundle.mission),
        proposedCheckpoints: toPrismaJson(bundle.checkpoints),
        proposedTransit: toPrismaNullableJson(bundle.transit ?? null),
        generationConfig: toPrismaJson(args.request),
        generationModel: args.generationModel,
        generationCost: args.generationCost
      }
    });
    created.push(proposal);
  }

  return { batchId, items: created };
}

export async function approveProposal(args: {
  proposalId: string;
  reviewerId: string;
  overrides?: {
    proposedMission?: Record<string, unknown>;
    proposedCheckpoints?: Array<Record<string, unknown>>;
    proposedTransit?: Record<string, unknown> | null;
    modifications?: Array<Record<string, unknown>>;
  };
}) {
  const proposal = await prisma.generatedMissionProposal.findUnique({
    where: { id: args.proposalId }
  });
  if (!proposal) {
    throw new Error('proposal_not_found');
  }

  const missionData = { ...safeJsonParse<Record<string, unknown>>(proposal.proposedMission, {}), ...(args.overrides?.proposedMission ?? {}) };
  const checkpoints = args.overrides?.proposedCheckpoints ?? safeJsonParse<Array<Record<string, unknown>>>(proposal.proposedCheckpoints, []);
  const transit = args.overrides?.proposedTransit ?? safeJsonParse<Record<string, unknown> | null>(proposal.proposedTransit, null);

  const mission = await prisma.mission.create({
    data: {
      cityId: String(proposal.cityId),
      placeId: String(missionData.placeId),
      title: String(missionData.title),
      toneSlug: String(missionData.toneSlug),
      difficulty: Number(missionData.difficulty),
      objective: String(missionData.objective),
      openingBrief: String(missionData.openingBrief),
      successNote: String(missionData.successNote),
      order: Number(missionData.order ?? 1),
      active: true,
      tags: JSON.stringify(Array.isArray(missionData.tags) ? missionData.tags : []),
      checkpoints: {
        create: checkpoints.map((checkpoint, index) => ({
          order: Number(checkpoint.order ?? index + 1),
          type: String(checkpoint.type) as never,
          prompt: String(checkpoint.prompt),
          validationRule: JSON.stringify(checkpoint.validationRule ?? {}),
          hints: JSON.stringify(checkpoint.hints ?? ['', '', '']),
          acceptAny: Boolean(checkpoint.acceptAny)
        }))
      },
      transit: transit
        ? {
            create: {
              estimatedMinutes: Number(transit.estimatedMinutes ?? 4),
              recommendedPath: transit.recommendedPath ? JSON.stringify(transit.recommendedPath) : null,
              ambientLines: {
                create: Array.isArray(transit.ambientLines)
                  ? transit.ambientLines.map((line, index) => ({
                      trigger: String((line as Record<string, unknown>).trigger) as never,
                      text: String((line as Record<string, unknown>).text),
                      order: Number((line as Record<string, unknown>).order ?? index + 1)
                    }))
                  : []
              }
            }
          }
        : undefined
    }
  });

  await prisma.generatedMissionProposal.update({
    where: { id: args.proposalId },
    data: {
      status: args.overrides?.modifications?.length ? 'modified' : 'approved',
      reviewedBy: args.reviewerId,
      reviewedAt: new Date(),
      approvedAsMissionId: mission.id,
      modifications: args.overrides?.modifications ? toPrismaJson(args.overrides.modifications) : undefined,
      proposedMission: toPrismaJson(missionData),
      proposedCheckpoints: toPrismaJson(checkpoints),
      proposedTransit: toPrismaNullableJson(transit)
    }
  });

  return mission;
}

export async function rejectProposal(proposalId: string, reviewerId: string, reason: string) {
  return prisma.generatedMissionProposal.update({
    where: { id: proposalId },
    data: {
      status: 'rejected',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      rejectionReason: reason
    }
  });
}

export async function patchProposal(args: {
  proposalId: string;
  changes: {
    proposedMission?: Record<string, unknown>;
    proposedCheckpoints?: Array<Record<string, unknown>>;
    proposedTransit?: Record<string, unknown> | null;
    modifications?: Array<Record<string, unknown>>;
  };
}) {
  const proposal = await prisma.generatedMissionProposal.findUnique({ where: { id: args.proposalId } });
  if (!proposal) {
    throw new Error('proposal_not_found');
  }

  const nextMission = args.changes.proposedMission ?? safeJsonParse<Record<string, unknown>>(proposal.proposedMission, {});
  const nextCheckpoints = args.changes.proposedCheckpoints ?? safeJsonParse<Array<Record<string, unknown>>>(proposal.proposedCheckpoints, []);
  const nextTransit = Object.prototype.hasOwnProperty.call(args.changes, 'proposedTransit')
    ? args.changes.proposedTransit ?? null
    : safeJsonParse<Record<string, unknown> | null>(proposal.proposedTransit, null);

  return prisma.generatedMissionProposal.update({
    where: { id: args.proposalId },
    data: {
      status: 'modified',
      proposedMission: toPrismaJson(nextMission),
      proposedCheckpoints: toPrismaJson(nextCheckpoints),
      proposedTransit: toPrismaNullableJson(nextTransit),
      modifications: args.changes.modifications
        ? toPrismaJson(args.changes.modifications)
        : toPrismaExistingNullableJson(proposal.modifications)
    }
  });
}
