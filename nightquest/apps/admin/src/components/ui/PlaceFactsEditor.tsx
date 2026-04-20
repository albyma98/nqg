import { Plus, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { Input, Select, Textarea } from './Input';

export type VisualElementDraft = {
  category: string;
  description: string;
  countable: boolean;
  exactCount: string;
};

export type SensoryElementDraft = {
  sense: 'sight' | 'sound' | 'smell' | 'touch';
  description: string;
};

export type HistoricalFactDraft = {
  fact: string;
  source: string;
};

export type NotableDetailDraft = {
  detail: string;
  verifiableByUser: boolean;
};

export type PlaceFactsDraft = {
  visualElements: VisualElementDraft[];
  sensoryElements: SensoryElementDraft[];
  historicalFacts: HistoricalFactDraft[];
  notableDetails: NotableDetailDraft[];
  adminNotes: string;
};

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function createEmptyPlaceFactsDraft(): PlaceFactsDraft {
  return {
    visualElements: [{ category: '', description: '', countable: false, exactCount: '' }],
    sensoryElements: [{ sense: 'sound', description: '' }],
    historicalFacts: [{ fact: '', source: '' }],
    notableDetails: [{ detail: '', verifiableByUser: true }],
    adminNotes: ''
  };
}

export function placeFactsDraftFromApi(facts?: Record<string, unknown> | null): PlaceFactsDraft {
  const visualElements = Array.isArray(facts?.visualElements)
    ? facts!.visualElements.map((item) => {
        const record = asRecord(item);
        return {
          category: String(record.category ?? ''),
          description: String(record.description ?? ''),
          countable: Boolean(record.countable ?? false),
          exactCount: record.exactCount != null ? String(record.exactCount) : ''
        };
      })
    : [];
  const sensoryElements = Array.isArray(facts?.sensoryElements)
    ? facts!.sensoryElements.map((item) => {
        const record = asRecord(item);
        const sense = String(record.sense ?? 'sound');
        return {
          sense: (['sight', 'sound', 'smell', 'touch'].includes(sense) ? sense : 'sound') as SensoryElementDraft['sense'],
          description: String(record.description ?? '')
        };
      })
    : [];
  const historicalFacts = Array.isArray(facts?.historicalFacts)
    ? facts!.historicalFacts.map((item) => {
        const record = asRecord(item);
        return {
          fact: String(record.fact ?? ''),
          source: String(record.source ?? '')
        };
      })
    : [];
  const notableDetails = Array.isArray(facts?.notableDetails)
    ? facts!.notableDetails.map((item) => {
        const record = asRecord(item);
        return {
          detail: String(record.detail ?? ''),
          verifiableByUser: Boolean(record.verifiableByUser ?? true)
        };
      })
    : [];

  return {
    visualElements: visualElements.length > 0 ? visualElements : createEmptyPlaceFactsDraft().visualElements,
    sensoryElements: sensoryElements.length > 0 ? sensoryElements : createEmptyPlaceFactsDraft().sensoryElements,
    historicalFacts: historicalFacts.length > 0 ? historicalFacts : createEmptyPlaceFactsDraft().historicalFacts,
    notableDetails: notableDetails.length > 0 ? notableDetails : createEmptyPlaceFactsDraft().notableDetails,
    adminNotes: String(facts?.adminNotes ?? '')
  };
}

export function placeFactsDraftToApi(draft: PlaceFactsDraft) {
  return {
    visualElements: draft.visualElements
      .filter((item) => item.category.trim() || item.description.trim())
      .map((item) => ({
        category: item.category.trim(),
        description: item.description.trim(),
        countable: item.countable,
        ...(item.countable && item.exactCount.trim() ? { exactCount: Number(item.exactCount) } : {})
      })),
    sensoryElements: draft.sensoryElements
      .filter((item) => item.description.trim())
      .map((item) => ({
        sense: item.sense,
        description: item.description.trim()
      })),
    historicalFacts: draft.historicalFacts
      .filter((item) => item.fact.trim())
      .map((item) => ({
        fact: item.fact.trim(),
        ...(item.source.trim() ? { source: item.source.trim() } : {})
      })),
    notableDetails: draft.notableDetails
      .filter((item) => item.detail.trim())
      .map((item) => ({
        detail: item.detail.trim(),
        verifiableByUser: item.verifiableByUser
      })),
    adminNotes: draft.adminNotes.trim()
  };
}

export function countFilledVisualElements(draft: PlaceFactsDraft) {
  return draft.visualElements.filter((item) => item.category.trim() && item.description.trim()).length;
}

export function PlaceFactsEditor(props: {
  value: PlaceFactsDraft;
  onChange: (value: PlaceFactsDraft) => void;
  compact?: boolean;
}) {
  const { value, onChange, compact = false } = props;

  function updateSection<K extends keyof PlaceFactsDraft>(key: K, next: PlaceFactsDraft[K]) {
    onChange({ ...value, [key]: next });
  }

  function updateArrayItem<K extends 'visualElements' | 'sensoryElements' | 'historicalFacts' | 'notableDetails'>(
    key: K,
    index: number,
    patch: Partial<PlaceFactsDraft[K][number]>
  ) {
    const next = value[key].map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) as PlaceFactsDraft[K];
    updateSection(key, next);
  }

  function removeArrayItem<K extends 'visualElements' | 'sensoryElements' | 'historicalFacts' | 'notableDetails'>(key: K, index: number) {
    const next = value[key].filter((_, itemIndex) => itemIndex !== index) as PlaceFactsDraft[K];
    updateSection(key, next.length > 0 ? next : createEmptyPlaceFactsDraft()[key]);
  }

  function addArrayItem(key: 'visualElements' | 'sensoryElements' | 'historicalFacts' | 'notableDetails') {
    const empty = createEmptyPlaceFactsDraft()[key][0];
    updateSection(key, [...value[key], empty] as PlaceFactsDraft[typeof key]);
  }

  const gapClass = compact ? 'space-y-3' : 'space-y-4';

  return (
    <div className={gapClass}>
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-sans text-adminHeading font-semibold text-admin-text">Elementi visivi</div>
            <div className="font-sans text-adminLabel text-admin-muted">Cose che l'utente puo vedere davvero e, se serve, contare.</div>
          </div>
          <Button type="button" variant="outline" onClick={() => addArrayItem('visualElements')}>
            <Plus size={14} className="mr-2" /> Aggiungi
          </Button>
        </div>
        <div className="space-y-3">
          {value.visualElements.map((item, index) => (
            <div key={`visual-${index}`} className="rounded-sm border border-admin-border p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={item.category} onChange={(event) => updateArrayItem('visualElements', index, { category: event.target.value })} placeholder="Categoria: archi, statue, iscrizioni..." />
                <Input value={item.description} onChange={(event) => updateArrayItem('visualElements', index, { description: event.target.value })} placeholder="Descrizione osservabile" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 font-sans text-adminBody text-admin-text">
                  <input
                    type="checkbox"
                    checked={item.countable}
                    onChange={(event) => updateArrayItem('visualElements', index, { countable: event.target.checked, exactCount: event.target.checked ? item.exactCount : '' })}
                  />
                  E conteggiabile
                </label>
                {item.countable && (
                  <Input
                    type="number"
                    min={0}
                    value={item.exactCount}
                    onChange={(event) => updateArrayItem('visualElements', index, { exactCount: event.target.value })}
                    placeholder="Conteggio esatto"
                    className="w-40"
                  />
                )}
                <Button type="button" variant="ghost" onClick={() => removeArrayItem('visualElements', index)}>
                  <Trash2 size={14} className="mr-2" /> Rimuovi
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-sans text-adminHeading font-semibold text-admin-text">Elementi sensoriali</div>
            <div className="font-sans text-adminLabel text-admin-muted">Suoni, odori, luce, tatto, atmosfera percepibile sul posto.</div>
          </div>
          <Button type="button" variant="outline" onClick={() => addArrayItem('sensoryElements')}>
            <Plus size={14} className="mr-2" /> Aggiungi
          </Button>
        </div>
        <div className="space-y-3">
          {value.sensoryElements.map((item, index) => (
            <div key={`sensory-${index}`} className="rounded-sm border border-admin-border p-3">
              <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                <Select value={item.sense} onChange={(event) => updateArrayItem('sensoryElements', index, { sense: event.target.value as SensoryElementDraft['sense'] })}>
                  <option value="sight">Vista</option>
                  <option value="sound">Suono</option>
                  <option value="smell">Odore</option>
                  <option value="touch">Tatto</option>
                </Select>
                <Input value={item.description} onChange={(event) => updateArrayItem('sensoryElements', index, { description: event.target.value })} placeholder="Descrizione sensoriale concreta" />
              </div>
              <div className="mt-3">
                <Button type="button" variant="ghost" onClick={() => removeArrayItem('sensoryElements', index)}>
                  <Trash2 size={14} className="mr-2" /> Rimuovi
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-sans text-adminHeading font-semibold text-admin-text">Fatti storici</div>
            <div className="font-sans text-adminLabel text-admin-muted">Solo fatti reali e utili al contesto, non trivia gratuita.</div>
          </div>
          <Button type="button" variant="outline" onClick={() => addArrayItem('historicalFacts')}>
            <Plus size={14} className="mr-2" /> Aggiungi
          </Button>
        </div>
        <div className="space-y-3">
          {value.historicalFacts.map((item, index) => (
            <div key={`historical-${index}`} className="rounded-sm border border-admin-border p-3">
              <div className="grid gap-3">
                <Input value={item.fact} onChange={(event) => updateArrayItem('historicalFacts', index, { fact: event.target.value })} placeholder="Fatto storico confermato" />
                <Input value={item.source} onChange={(event) => updateArrayItem('historicalFacts', index, { source: event.target.value })} placeholder="Fonte opzionale" />
              </div>
              <div className="mt-3">
                <Button type="button" variant="ghost" onClick={() => removeArrayItem('historicalFacts', index)}>
                  <Trash2 size={14} className="mr-2" /> Rimuovi
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-sans text-adminHeading font-semibold text-admin-text">Dettagli notevoli</div>
            <div className="font-sans text-adminLabel text-admin-muted">Dettagli piccoli ma caratteristici, meglio se verificabili dal giocatore.</div>
          </div>
          <Button type="button" variant="outline" onClick={() => addArrayItem('notableDetails')}>
            <Plus size={14} className="mr-2" /> Aggiungi
          </Button>
        </div>
        <div className="space-y-3">
          {value.notableDetails.map((item, index) => (
            <div key={`detail-${index}`} className="rounded-sm border border-admin-border p-3">
              <Textarea value={item.detail} onChange={(event) => updateArrayItem('notableDetails', index, { detail: event.target.value })} placeholder="Dettaglio osservabile o utile alla missione" className="h-20" />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 font-sans text-adminBody text-admin-text">
                  <input
                    type="checkbox"
                    checked={item.verifiableByUser}
                    onChange={(event) => updateArrayItem('notableDetails', index, { verifiableByUser: event.target.checked })}
                  />
                  Verificabile dal giocatore
                </label>
                <Button type="button" variant="ghost" onClick={() => removeArrayItem('notableDetails', index)}>
                  <Trash2 size={14} className="mr-2" /> Rimuovi
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 font-sans text-adminHeading font-semibold text-admin-text">Note admin</div>
        <Textarea value={value.adminNotes} onChange={(event) => updateSection('adminNotes', event.target.value)} placeholder="Note pratiche per la generazione o per il sopralluogo" className="h-24" />
      </Card>
    </div>
  );
}
