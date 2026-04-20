import OpenAI from 'openai';
import { config } from '../config.js';
import { getFallbackLine } from './narrator-fallbacks.js';
import { getSystemPrompt, validateNarratorOutput } from './orchestrator.service.js';

const openai = config.OPENAI_API_KEY ? new OpenAI({ apiKey: config.OPENAI_API_KEY }) : null;

export async function speak(briefing: Record<string, unknown>, bannedWords: string[] = []) {
  if (!openai) {
    return getFallbackLine(briefing);
  }

  const systemPrompt = (await getSystemPrompt()).replace('[CITTA]', String(briefing.city ?? 'questa citta'));
  const userPrompt = JSON.stringify(briefing, null, 2);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.9,
        max_tokens: 120,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });

      const text = response.choices[0]?.message?.content?.trim() ?? '';
      if (validateNarratorOutput(text, bannedWords)) {
        return text;
      }
    } catch {
      break;
    }
  }

  return getFallbackLine(briefing);
}
