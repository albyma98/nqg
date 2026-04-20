import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Select, Textarea } from '../components/ui/Input';
import {
  countFilledVisualElements,
  createEmptyPlaceFactsDraft,
  PlaceFactsDraft,
  PlaceFactsEditor,
  placeFactsDraftFromApi,
  placeFactsDraftToApi
} from '../components/ui/PlaceFactsEditor';

type City = { id: string; name: string; _count?: { places?: number; missions?: number; generatedProposals?: number } };
type Place = {
  id: string;
  name: string;
  zone: string;
  facts?: Record<string, any> | null;
};

export function GenerationWizardPage(props: {
  initialCityId?: string;
  onOpenProposals: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cities, setCities] = useState<City[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [cityId, setCityId] = useState(props.initialCityId ?? '');
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
  const [missionCount, setMissionCount] = useState(5);
  const [style, setStyle] = useState<'misterioso' | 'provocatorio' | 'contemplativo' | 'giocoso' | 'misto'>('misterioso');
  const [targetDurationMinutes, setTargetDurationMinutes] = useState<60 | 90 | 120>(90);
  const [customConstraints, setCustomConstraints] = useState('');
  const [requireDifficultyProgression, setRequireDifficultyProgression] = useState(true);
  const [excludeTonesText, setExcludeTonesText] = useState('');
  const [factsDraft, setFactsDraft] = useState<Record<string, PlaceFactsDraft>>({});
  const [preview, setPreview] = useState<Record<string, any> | null>(null);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; warnings: string[]; errors: string[] } | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [generationModel, setGenerationModel] = useState<string>('gpt-4o-mini');
  const [diagnostics, setDiagnostics] = useState<{
    cacheHit: boolean;
    openAiAttempted: boolean;
    openAiAttempts: number;
    usedFallback: boolean;
    fallbackReason?: string;
    openAiError?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadCities() {
      const data = (await adminApi.cities()) as City[];
      setCities(data);
      const nextCityId = props.initialCityId || data.find((city) => Number(city._count?.places ?? 0) >= 3)?.id || data[0]?.id || '';
      setCityId(nextCityId);
    }
    void loadCities();
  }, [props.initialCityId]);

  useEffect(() => {
    async function loadPlaces() {
      if (!cityId) return;
      const data = (await adminApi.places(cityId)) as Place[];
      setPlaces(data);
      const defaultPlaceIds = data.slice(0, Math.min(5, data.length)).map((place) => place.id);
      setSelectedPlaceIds((current) => (current.length > 0 && current.every((id) => data.some((place) => place.id === id)) ? current : defaultPlaceIds));
      setFactsDraft(
        Object.fromEntries(
          data.map((place) => [place.id, placeFactsDraftFromApi(place.facts)])
        )
      );
    }
    void loadPlaces();
  }, [cityId]);

  const selectedPlaces = useMemo(
    () => selectedPlaceIds.map((placeId) => places.find((place) => place.id === placeId)).filter(Boolean) as Place[],
    [places, selectedPlaceIds]
  );

  function togglePlace(placeId: string) {
    setSelectedPlaceIds((current) => {
      if (current.includes(placeId)) {
        return current.filter((id) => id !== placeId);
      }
      if (current.length >= 5) return current;
      return [...current, placeId];
    });
  }

  async function saveFactsAndContinue() {
    try {
      for (const place of selectedPlaces) {
        const draft = factsDraft[place.id] ?? createEmptyPlaceFactsDraft();
        const payload = placeFactsDraftToApi(draft);
        if (payload.visualElements.length < 3) {
          toast.error(`PlaceFacts incompleti per ${place.name}`);
          return;
        }
        await adminApi.upsertPlaceFacts({
          placeId: place.id,
          ...payload
        });
      }
      setStep(3);
    } catch {
      toast.error('Salvataggio PlaceFacts non riuscito');
    }
  }

  async function generatePreview(forceRefresh = false) {
    setLoading(true);
    try {
      const response = await adminApi.generationPreview({
        cityId,
        placeIds: selectedPlaceIds.slice(0, missionCount),
        missionCount,
        style,
        targetDurationMinutes,
        customConstraints,
        excludeTones: excludeTonesText.split(',').map((item) => item.trim()).filter(Boolean),
        requireDifficultyProgression,
        forceRefresh
      });
      setPreview(response.preview as Record<string, any>);
      setValidationResult(response.validationResult as { valid: boolean; warnings: string[]; errors: string[] });
      setEstimatedCost(Number(response.estimatedCostUsd ?? 0));
      setGenerationModel(String(response.generationModel ?? 'gpt-4o-mini'));
      setDiagnostics((response.diagnostics as typeof diagnostics) ?? null);
      if (String(response.generationModel ?? '') !== 'gpt-4o-mini') {
        toast.error('Preview generata con fallback locale, non con OpenAI');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Generazione non riuscita');
    } finally {
      setLoading(false);
    }
  }

  async function commitPreview() {
    if (!preview) return;
    try {
      await adminApi.generationCommit({
        request: {
          cityId,
          placeIds: selectedPlaceIds.slice(0, missionCount),
          missionCount,
          style,
          targetDurationMinutes,
          customConstraints,
          excludeTones: excludeTonesText.split(',').map((item) => item.trim()).filter(Boolean),
          requireDifficultyProgression
        },
        preview,
        generationModel,
        generationCost: estimatedCost
      });
      toast.success('Proposte salvate in ReviewQueue');
      props.onOpenProposals();
    } catch {
      toast.error('Salvataggio proposta non riuscito');
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4 font-sans text-adminLabel uppercase tracking-[0.2em] text-admin-muted">Step {step} / 3</div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Select value={cityId} onChange={(event) => setCityId(event.target.value)}>
                {cities
                  .filter((city) => Number(city._count?.places ?? 0) >= 3)
                  .map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
              </Select>
              <Input
                type="number"
                min={1}
                max={5}
                value={missionCount}
                onChange={(event) => setMissionCount(Math.max(1, Math.min(5, Number(event.target.value))))}
                placeholder="Numero missioni"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Select value={style} onChange={(event) => setStyle(event.target.value as typeof style)}>
                {['misterioso', 'provocatorio', 'contemplativo', 'giocoso', 'misto'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
              <Select value={String(targetDurationMinutes)} onChange={(event) => setTargetDurationMinutes(Number(event.target.value) as 60 | 90 | 120)}>
                {[60, 90, 120].map((value) => (
                  <option key={value} value={value}>
                    {value} minuti
                  </option>
                ))}
              </Select>
            </div>
            <Textarea value={customConstraints} onChange={(event) => setCustomConstraints(event.target.value)} placeholder="Constraint aggiuntivi..." className="h-24" />
            <Input value={excludeTonesText} onChange={(event) => setExcludeTonesText(event.target.value)} placeholder="Toni da escludere, separati da virgola" />
            <label className="flex items-center gap-2 font-sans text-adminBody text-admin-text">
              <input type="checkbox" checked={requireDifficultyProgression} onChange={(event) => setRequireDifficultyProgression(event.target.checked)} />
              Progressione difficoltà
            </label>
            <div>
              <div className="mb-2 font-sans text-adminLabel text-admin-muted">Seleziona i Place da usare (ordine attuale della lista)</div>
              <div className="grid gap-2 md:grid-cols-2">
                {places.map((place) => (
                  <label key={place.id} className="flex items-center gap-2 rounded-sm border border-admin-border px-3 py-2 font-sans text-adminBody text-admin-text">
                    <input type="checkbox" checked={selectedPlaceIds.includes(place.id)} onChange={() => togglePlace(place.id)} />
                    <span>{place.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={() => setStep(2)} disabled={!cityId || selectedPlaceIds.length < 3}>
              Avanti
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            {selectedPlaces.slice(0, missionCount).map((place) => (
              <Card key={place.id} className="p-4">
                <div className="mb-3 font-sans text-adminHeading font-semibold text-admin-text">{place.name}</div>
                <div className="mb-3 font-sans text-adminLabel text-admin-muted">
                  Elementi visivi completi: {countFilledVisualElements(factsDraft[place.id] ?? createEmptyPlaceFactsDraft())} / 3 minimi
                </div>
                <div className="grid gap-3">
                  <PlaceFactsEditor
                    value={factsDraft[place.id] ?? createEmptyPlaceFactsDraft()}
                    onChange={(next) =>
                      setFactsDraft((current) => ({
                        ...current,
                        [place.id]: next
                      }))
                    }
                    compact
                  />
                </div>
              </Card>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Indietro
              </Button>
              <Button onClick={() => void saveFactsAndContinue()}>Avanti</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={() => void generatePreview(false)} disabled={loading}>
                {loading ? 'Generazione...' : 'Genera proposte'}
              </Button>
              <Button variant="outline" onClick={() => void generatePreview(true)} disabled={loading}>
                {loading ? 'Rigenerazione...' : 'Rigenera con modifiche'}
              </Button>
              <Button variant="ghost" onClick={() => setStep(1)}>
                Torna ai parametri
              </Button>
            </div>

            {preview && (
              <div className="space-y-4">
                <Card className="p-4">
                  <div className="font-sans text-adminLabel uppercase tracking-[0.18em] text-admin-muted">Arco narrativo</div>
                  <div className="mt-2 font-sans text-adminBody text-admin-text">{String(preview.narrativeArc ?? '')}</div>
                  <div className="mt-3 font-sans text-adminLabel text-admin-muted">Costo stimato: ${estimatedCost?.toFixed(3) ?? '0.000'}</div>
                  <div className="mt-1 font-sans text-adminLabel text-admin-muted">Motore usato: {generationModel}</div>
                  {diagnostics && (
                    <div className="mt-2 space-y-1 font-sans text-adminBody text-admin-muted">
                      <div>Tentativi OpenAI: {diagnostics.openAiAttempts}</div>
                      <div>Cache: {diagnostics.cacheHit ? 'si' : 'no'}</div>
                      <div>Fallback: {diagnostics.usedFallback ? 'si' : 'no'}</div>
                      {diagnostics.fallbackReason && <div>Motivo fallback: {diagnostics.fallbackReason}</div>}
                      {diagnostics.openAiError && <div>Errore OpenAI: {diagnostics.openAiError}</div>}
                    </div>
                  )}
                </Card>

                <div className="grid gap-3">
                  {(preview.missions as Array<Record<string, any>>).map((bundle, index) => (
                    <Card key={index} className="p-4">
                      <div className="font-sans text-adminHeading font-semibold text-admin-text">{String(bundle.mission?.title)}</div>
                      <div className="mt-1 font-sans text-adminBody text-admin-muted">
                        {String(selectedPlaces.find((place) => place.id === bundle.mission?.placeId)?.name ?? bundle.mission?.placeId)} · tono {String(bundle.mission?.toneSlug)} · diff {String(bundle.mission?.difficulty)}
                      </div>
                    </Card>
                  ))}
                </div>

                {validationResult && (
                  <Card className="p-4">
                    <div className="font-sans text-adminHeading font-semibold text-admin-text">
                      Validazione {validationResult.valid ? 'OK' : 'con errori'}
                    </div>
                    {validationResult.errors.length > 0 && (
                      <div className="mt-2 space-y-1 font-sans text-adminBody text-admin-danger">
                        {validationResult.errors.map((error) => (
                          <div key={error}>{error}</div>
                        ))}
                      </div>
                    )}
                    {validationResult.warnings.length > 0 && (
                      <div className="mt-2 space-y-1 font-sans text-adminBody text-admin-muted">
                        {validationResult.warnings.map((warning) => (
                          <div key={warning}>{warning}</div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                <div className="flex gap-2">
                  <Button onClick={() => void commitPreview()} disabled={!validationResult?.valid}>
                    Salva come proposta nella ReviewQueue
                  </Button>
                  <Button variant="ghost" onClick={props.onOpenProposals}>
                    Vai alla ReviewQueue
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
