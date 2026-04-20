export function getFallbackLine(briefing: Record<string, unknown>) {
  const eventType = String(briefing.eventType ?? 'ambient');
  const mission = briefing.mission as { openingBrief?: string; successNote?: string } | null;
  const map: Record<string, string> = {
    session_start: 'La notte ti ha notato prima del tuo alias.',
    mission_intro: mission?.openingBrief ?? 'Cammina. Il resto si scopre dopo.',
    answer_valid: 'Hai lasciato un segno abbastanza netto da farti passare.',
    answer_invalid: 'C e qualcosa che non hai visto davvero.',
    hint_request: 'Ti concedo un bordo, non una mappa.',
    resume: 'Sei tornato. La citta non aveva smesso di guardare.',
    finale: 'Gallipoli ti lascia uscire con piu domande di quante ne avessi all inizio.',
    ambient: 'Non tutto quello che tace e fermo.'
  };

  return map[eventType] ?? map.ambient;
}
