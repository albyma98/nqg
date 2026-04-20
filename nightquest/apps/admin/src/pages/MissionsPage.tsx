import { Fragment, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Circle, CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import { Plus, Trash2, X, ChevronDown, ChevronUp, Wand2 } from 'lucide-react';
import { adminApi } from '../api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Select, Textarea } from '../components/ui/Input';

type CheckpointType = 'keyword' | 'multiple_choice' | 'observation_confirm' | 'count' | 'sequence' | 'walk_blind';
type AmbientTrigger = 'start' | 'halfway' | 'approaching' | 'arrival' | 'idle' | 'deviation';

type CheckpointForm = {
  order: number;
  type: CheckpointType;
  prompt: string;
  validationRule: Record<string, unknown>;
  hint0: string;
  hint1: string;
  hint2: string;
  acceptAny: boolean;
};

type MissionForm = {
  title: string;
  placeId: string;
  toneSlug: string;
  difficulty: number;
  objective: string;
  openingBrief: string;
  successNote: string;
  order: number;
  active: boolean;
  tagsRaw: string;
  checkpoints: CheckpointForm[];
};

type AmbientLineForm = {
  id?: string;
  trigger: AmbientTrigger;
  text: string;
  tone: string;
  order: number;
  minSecondsFromPrevious: number;
};

type Mission = Record<string, any>;
type City = { id: string; name: string };
type Place = {
  id: string;
  name: string;
  zone: string;
  latitude: number;
  longitude: number;
  gpsRadius: number;
  gpsUncertaintyRadius: number;
};
type Tone = { id: string; slug: string; name: string };

async function fetchOsrmRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<Array<[number, number]> | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
    };

    const coordinates = data.routes?.[0]?.geometry?.coordinates;
    if (!coordinates?.length) {
      return null;
    }

    return coordinates.map(([lng, lat]) => [lat, lng]);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export function MissionsPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityId, setSelectedCityId] = useState('');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [tones, setTones] = useState<Tone[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [ambientLines, setAmbientLines] = useState<AmbientLineForm[]>([]);
  const [estimatedMinutes, setEstimatedMinutes] = useState(4);
  const [recommendedPathText, setRecommendedPathText] = useState('[]');
  const [recommendedPathError, setRecommendedPathError] = useState(false);

  const form = useForm<MissionForm>({
    defaultValues: { active: true, difficulty: 1, order: 1, checkpoints: [] }
  });
  const { fields: cpFields, append: cpAppend, remove: cpRemove } = useFieldArray({
    control: form.control,
    name: 'checkpoints'
  });

  const selectedPlace = useMemo(() => places.find((place) => place.id === form.watch('placeId')) ?? null, [form, places]);
  const selectedMission = useMemo(
    () => missions.find((mission) => String(mission.id) === selectedMissionId) ?? null,
    [missions, selectedMissionId]
  );
  const previousMissionPlace = useMemo(() => {
    if (!selectedMission) return null;
    const orderedMissions = [...missions].sort((first, second) => Number(first.order) - Number(second.order));
    const selectedIndex = orderedMissions.findIndex((mission) => String(mission.id) === String(selectedMission.id));
    if (selectedIndex <= 0) return null;
    return orderedMissions[selectedIndex - 1]?.place ?? null;
  }, [missions, selectedMission]);

  async function loadAll(cityId: string) {
    const [missionsData, placesData] = await Promise.all([
      adminApi.missions(cityId) as Promise<Mission[]>,
      adminApi.places(cityId) as Promise<Place[]>
    ]);
    setMissions(missionsData);
    setPlaces(placesData);
    if (missionsData.length > 0) {
      setSelectedMissionId(String(missionsData[0].id));
      fillForm(missionsData[0]);
    } else {
      setSelectedMissionId('');
      resetTransitEditor();
    }
  }

  useEffect(() => {
    async function init() {
      const [citiesData, tonesData] = await Promise.all([
        adminApi.cities() as Promise<City[]>,
        adminApi.tones() as Promise<Tone[]>
      ]);
      setCities(citiesData);
      setTones(tonesData);
      if (citiesData.length > 0) {
        setSelectedCityId(citiesData[0].id);
        await loadAll(citiesData[0].id);
      }
    }
    void init();
  }, []);

  function resetTransitEditor() {
    setAmbientLines([]);
    setEstimatedMinutes(4);
    setRecommendedPathText('[]');
    setRecommendedPathError(false);
  }

  function fillForm(mission: Mission) {
    const rawCheckpoints = Array.isArray(mission.checkpoints) ? mission.checkpoints : [];
    const checkpoints: CheckpointForm[] = rawCheckpoints.map((checkpoint: any) => {
      const hints = parseJson<string[]>(checkpoint.hints, ['', '', '']);
      return {
        order: checkpoint.order ?? 1,
        type: checkpoint.type as CheckpointType,
        prompt: checkpoint.prompt ?? '',
        validationRule: parseJson<Record<string, unknown>>(checkpoint.validationRule, {}),
        hint0: hints[0] ?? '',
        hint1: hints[1] ?? '',
        hint2: hints[2] ?? '',
        acceptAny: Boolean(checkpoint.acceptAny)
      };
    });

    form.reset({
      title: mission.title,
      placeId: mission.placeId,
      toneSlug: mission.toneSlug,
      difficulty: mission.difficulty,
      objective: mission.objective,
      openingBrief: mission.openingBrief,
      successNote: mission.successNote,
      order: mission.order,
      active: mission.active,
      tagsRaw: parseJson<string[]>(mission.tags, []).join(', '),
      checkpoints
    });

    setEstimatedMinutes(Number(mission.transit?.estimatedMinutes ?? 4));
    setRecommendedPathText(
      mission.transit?.recommendedPath
        ? JSON.stringify(parseJson<unknown[]>(mission.transit.recommendedPath, []), null, 2)
        : '[]'
    );
    setAmbientLines(
      Array.isArray(mission.transit?.ambientLines)
        ? mission.transit.ambientLines.map((line: any) => ({
            id: String(line.id),
            trigger: line.trigger as AmbientTrigger,
            text: String(line.text),
            tone: String(line.tone ?? ''),
            order: Number(line.order ?? 1),
            minSecondsFromPrevious: Number(line.minSecondsFromPrevious ?? 60)
          }))
        : []
    );
  }

  async function onCityChange(cityId: string) {
    setSelectedCityId(cityId);
    setIsCreating(false);
    await loadAll(cityId);
  }

  function selectMission(mission: Mission) {
    setSelectedMissionId(String(mission.id));
    setIsCreating(false);
    fillForm(mission);
  }

  function openCreate() {
    setIsCreating(true);
    setSelectedMissionId('');
    form.reset({
      title: '',
      placeId: places[0]?.id ?? '',
      toneSlug: tones[0]?.slug ?? '',
      difficulty: 1,
      objective: '',
      openingBrief: '',
      successNote: '',
      order: missions.length + 1,
      active: true,
      tagsRaw: '',
      checkpoints: []
    });
    resetTransitEditor();
  }

  function parseRecommendedPath() {
    try {
      const parsed = JSON.parse(recommendedPathText);
      setRecommendedPathError(false);
      return parsed;
    } catch {
      setRecommendedPathError(true);
      throw new Error('recommended_path_invalid');
    }
  }

  async function persistTransit(missionId: string) {
    const normalizedLines = ambientLines
      .map((line, index) => ({
        ...line,
        order: Number(line.order || index + 1),
        minSecondsFromPrevious: Number(line.minSecondsFromPrevious || 60)
      }))
      .filter((line) => line.text.trim().length > 0);

    const recommendedPath = parseRecommendedPath();
    const existing = (await adminApi.transit(missionId)) as Record<string, any> | null;

    const shouldKeepTransit =
      normalizedLines.length > 0 || Number(estimatedMinutes) > 0 || (Array.isArray(recommendedPath) && recommendedPath.length > 0);

    if (!shouldKeepTransit && existing) {
      await adminApi.deleteTransit(missionId);
      return;
    }

    if (!shouldKeepTransit) return;

    const transit = existing
      ? await adminApi.updateTransit(missionId, {
          estimatedMinutes: Number(estimatedMinutes),
          recommendedPath
        })
      : await adminApi.createTransit(missionId, {
          estimatedMinutes: Number(estimatedMinutes),
          recommendedPath
        });

    const currentLines = Array.isArray(existing?.ambientLines)
      ? existing.ambientLines.map((line: any) => String(line.id))
      : [];
    const retainedLines = normalizedLines.filter((line) => line.id).map((line) => String(line.id));

    await Promise.all(
      currentLines
        .filter((id) => !retainedLines.includes(id))
        .map((id) => adminApi.deleteAmbientLine(id))
    );

    for (const line of normalizedLines) {
      const body = {
        transitId: String(transit.id),
        trigger: line.trigger,
        text: line.text,
        tone: line.tone || null,
        order: Number(line.order),
        minSecondsFromPrevious: Number(line.minSecondsFromPrevious)
      };
      if (line.id) {
        await adminApi.updateAmbientLine(line.id, body);
      } else {
        await adminApi.createAmbientLine(body);
      }
    }
  }

  async function onSubmit(values: MissionForm) {
    const body = {
      title: values.title,
      cityId: selectedCityId,
      placeId: values.placeId,
      toneSlug: values.toneSlug,
      difficulty: Number(values.difficulty),
      objective: values.objective,
      openingBrief: values.openingBrief,
      successNote: values.successNote,
      order: Number(values.order),
      active: values.active,
      tags: values.tagsRaw.split(',').map((value) => value.trim()).filter(Boolean),
      checkpoints: values.checkpoints.map((checkpoint, index) => ({
        order: index + 1,
        type: checkpoint.type,
        prompt: checkpoint.prompt,
        validationRule: checkpoint.validationRule,
        hints: [checkpoint.hint0, checkpoint.hint1, checkpoint.hint2],
        acceptAny: checkpoint.acceptAny
      }))
    };

    try {
      const mission = isCreating
        ? await adminApi.createMission(body)
        : await adminApi.updateMission(selectedMissionId, body);
      await persistTransit(String(mission.id));
      toast.success(isCreating ? 'Missione creata' : 'Missione aggiornata');
      await loadAll(selectedCityId);
      setIsCreating(false);
      setSelectedMissionId(String(mission.id));
    } catch {
      toast.error('Operazione non riuscita');
    }
  }

  async function deleteMission() {
    if (!confirm('Eliminare questa missione?')) return;
    try {
      await adminApi.deleteMission(selectedMissionId);
      toast.success('Missione eliminata');
      await loadAll(selectedCityId);
    } catch {
      toast.error('Eliminazione non riuscita');
    }
  }

  async function generateAmbientLines() {
    try {
      const response = await adminApi.generateAmbientLines({ missionTitle: form.getValues('title') });
      const generated = response.items.map((item, index) => ({
        trigger: (item.trigger as AmbientTrigger) ?? 'start',
        text: String(item.text ?? ''),
        tone: String(item.tone ?? ''),
        order: ambientLines.length + index + 1,
        minSecondsFromPrevious: Number(item.minSecondsFromPrevious ?? 60)
      }));
      setAmbientLines((current) => [...current, ...generated]);
      toast.success('Proposte aggiunte');
    } catch {
      toast.error('Generazione non riuscita');
    }
  }

  async function precalculateRecommendedPath() {
    if (!selectedPlace || !previousMissionPlace) {
      toast.error('Serve una missione precedente con luogo valido');
      return;
    }

    const route = await fetchOsrmRoute(
      Number(previousMissionPlace.latitude),
      Number(previousMissionPlace.longitude),
      Number(selectedPlace.latitude),
      Number(selectedPlace.longitude)
    );

    if (!route) {
      toast.error('OSRM non ha restituito un percorso pedonale');
      return;
    }

    setRecommendedPathText(JSON.stringify(route, null, 2));
    setRecommendedPathError(false);
    toast.success('Percorso consigliato pre-calcolato');
  }

  const editorVisible = isCreating || Boolean(selectedMissionId);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="space-y-3">
        <Select value={selectedCityId} onChange={(event) => void onCityChange(event.target.value)}>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </Select>
        <Button className="w-full" onClick={openCreate}>
          <Plus size={14} className="mr-2" /> Nuova missione
        </Button>
        <Card className="overflow-hidden p-0">
          {missions.length === 0 ? (
            <div className="p-4 font-sans text-adminBody text-admin-muted">Nessuna missione</div>
          ) : (
            missions.map((mission) => (
              <button
                key={String(mission.id)}
                onClick={() => selectMission(mission)}
                className={`w-full border-b border-admin-border px-4 py-3 text-left transition last:border-0 hover:bg-admin-bg ${selectedMissionId === String(mission.id) && !isCreating ? 'bg-admin-bg' : ''}`}
              >
                <div className="font-sans text-adminBody font-medium text-admin-text">{String(mission.title)}</div>
                <div className="mt-1 flex items-center gap-2 font-sans text-adminLabel text-admin-muted">
                  <span>#{mission.order}</span>
                  <Badge tone={mission.active ? 'success' : 'muted'}>{mission.active ? 'Attiva' : 'Bozza'}</Badge>
                </div>
              </button>
            ))
          )}
        </Card>
      </div>

      {editorVisible ? (
        <Card className="p-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-adminTitle font-semibold text-admin-text">
                {isCreating ? 'Nuova missione' : 'Editor missione'}
              </h3>
              {!isCreating && selectedMissionId ? (
                <Button type="button" variant="danger" onClick={() => void deleteMission()}>
                  <Trash2 size={14} className="mr-1" /> Elimina
                </Button>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input {...form.register('title')} placeholder="Titolo missione" />
              <div className="flex gap-2">
                <Input {...form.register('order', { valueAsNumber: true })} placeholder="Ordine" type="number" className="w-24 shrink-0" />
                <Select {...form.register('difficulty', { valueAsNumber: true })}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      Difficolta {value}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Select {...form.register('placeId')}>
                <option value="">- Luogo -</option>
                {places.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name} ({place.zone})
                  </option>
                ))}
              </Select>
              <Select {...form.register('toneSlug')}>
                <option value="">- Tono -</option>
                {tones.map((tone) => (
                  <option key={tone.slug} value={tone.slug}>
                    {tone.name}
                  </option>
                ))}
              </Select>
            </div>

            <Input {...form.register('tagsRaw')} placeholder="Tag separati da virgola" />
            <Textarea {...form.register('objective')} placeholder="Obiettivo..." className="h-20" />
            <Textarea {...form.register('openingBrief')} placeholder="Opening brief..." className="h-24" />
            <Textarea {...form.register('successNote')} placeholder="Success note..." className="h-20" />

            <label className="flex items-center gap-2 font-sans text-adminBody text-admin-text">
              <input type="checkbox" {...form.register('active')} />
              Missione attiva
            </label>

            <div className="border-t border-admin-border pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-sans text-adminHeading font-semibold text-admin-text">Checkpoint ({cpFields.length})</h4>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    cpAppend({
                      order: cpFields.length + 1,
                      type: 'keyword',
                      prompt: '',
                      validationRule: {},
                      hint0: '',
                      hint1: '',
                      hint2: '',
                      acceptAny: false
                    })
                  }
                >
                  <Plus size={14} className="mr-1" /> Aggiungi
                </Button>
              </div>
              <div className="space-y-3">
                {cpFields.map((field, index) => (
                  <CheckpointEditor key={field.id} index={index} form={form as any} onRemove={() => cpRemove(index)} />
                ))}
                {cpFields.length === 0 ? (
                  <div className="rounded-sm border border-admin-border p-4 font-sans text-adminBody text-admin-muted">
                    Nessun checkpoint. Aggiungine uno.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-admin-border pt-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="font-sans text-adminHeading font-semibold text-admin-text">Transit</h4>
                  <p className="mt-1 font-sans text-adminLabel text-admin-muted">
                    Tragitto, waypoints e battute ambientali del passaggio.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => void generateAmbientLines()}>
                  <Wand2 size={14} className="mr-1" /> Genera con AI
                </Button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  <Input
                    type="number"
                    value={estimatedMinutes}
                    onChange={(event) => setEstimatedMinutes(Number(event.target.value))}
                    placeholder="Minuti stimati"
                  />
                  <div>
                    <label className="mb-1 block font-sans text-adminLabel text-admin-muted">
                      Recommended path (JSON array di coordinate)
                    </label>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void precalculateRecommendedPath()}
                        disabled={!selectedPlace || !previousMissionPlace}
                      >
                        Pre-calcola percorso consigliato
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setRecommendedPathText('[]');
                          setRecommendedPathError(false);
                        }}
                      >
                        Pulisci percorso
                      </Button>
                    </div>
                    <Textarea
                      value={recommendedPathText}
                      onChange={(event) => {
                        setRecommendedPathText(event.target.value);
                        setRecommendedPathError(false);
                      }}
                      className={`h-28 font-mono text-xs ${recommendedPathError ? 'border-admin-danger' : ''}`}
                    />
                    {recommendedPathError ? (
                      <span className="font-sans text-adminLabel text-admin-danger">JSON non valido</span>
                    ) : null}
                    {previousMissionPlace ? (
                      <div className="mt-2 font-sans text-adminLabel text-admin-muted">
                        Origine stimata: {String(previousMissionPlace.name)} → {selectedPlace?.name ?? 'Destinazione'}
                      </div>
                    ) : (
                      <div className="mt-2 font-sans text-adminLabel text-admin-muted">
                        La prima missione non ha una tappa precedente da cui calcolare il percorso.
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {ambientLines.map((line, index) => (
                      <div key={line.id ?? `${line.trigger}-${index}`} className="rounded-sm border border-admin-border bg-admin-bg p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="font-sans text-adminBody font-medium text-admin-text">Linea ambient {index + 1}</div>
                          <button type="button" className="text-admin-danger" onClick={() => setAmbientLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                            <X size={14} />
                          </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <Select
                            value={line.trigger}
                            onChange={(event) =>
                              setAmbientLines((current) =>
                                current.map((item, itemIndex) => (itemIndex === index ? { ...item, trigger: event.target.value as AmbientTrigger } : item))
                              )
                            }
                          >
                            {['start', 'halfway', 'approaching', 'arrival', 'idle', 'deviation'].map((trigger) => (
                              <option key={trigger} value={trigger}>
                                {trigger}
                              </option>
                            ))}
                          </Select>
                          <Input
                            value={line.order}
                            type="number"
                            onChange={(event) =>
                              setAmbientLines((current) =>
                                current.map((item, itemIndex) => (itemIndex === index ? { ...item, order: Number(event.target.value) } : item))
                              )
                            }
                            placeholder="Ordine"
                          />
                          <Input
                            value={line.minSecondsFromPrevious}
                            type="number"
                            onChange={(event) =>
                              setAmbientLines((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, minSecondsFromPrevious: Number(event.target.value) } : item
                                )
                              )
                            }
                            placeholder="Cooldown"
                          />
                        </div>
                        <Input
                          className="mt-3"
                          value={line.tone}
                          onChange={(event) =>
                            setAmbientLines((current) =>
                              current.map((item, itemIndex) => (itemIndex === index ? { ...item, tone: event.target.value } : item))
                            )
                          }
                          placeholder="Override tono (opzionale)"
                        />
                        <Textarea
                          className="mt-3 h-24"
                          value={line.text}
                          onChange={(event) =>
                            setAmbientLines((current) =>
                              current.map((item, itemIndex) => (itemIndex === index ? { ...item, text: event.target.value } : item))
                            )
                          }
                          placeholder="Testo ambientale..."
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setAmbientLines((current) => [
                          ...current,
                          {
                            trigger: 'start',
                            text: '',
                            tone: '',
                            order: current.length + 1,
                            minSecondsFromPrevious: 60
                          }
                        ])
                      }
                    >
                      <Plus size={14} className="mr-1" /> Aggiungi linea ambient
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="font-sans text-adminLabel uppercase tracking-[0.18em] text-admin-muted">Mappa progetto</div>
                  <div className="h-[360px] overflow-hidden rounded-sm border border-admin-border">
                    {places.length > 0 ? (
                      <MapContainer
                        center={[
                          selectedPlace?.latitude ?? places[0].latitude,
                          selectedPlace?.longitude ?? places[0].longitude
                        ]}
                        zoom={17}
                        className="h-full w-full"
                        zoomControl={false}
                        attributionControl={false}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        {places.map((place) => {
                          const active = place.id === selectedPlace?.id;
                          return (
                            <Fragment key={place.id}>
                              <CircleMarker
                                center={[place.latitude, place.longitude]}
                                radius={active ? 7 : 5}
                                pathOptions={{ color: active ? '#1a1a1a' : '#6a6a60', fillColor: active ? '#1a1a1a' : '#ffffff', fillOpacity: 0.95 }}
                              />
                              {active ? (
                                <>
                                  <Circle center={[place.latitude, place.longitude]} radius={place.gpsRadius} pathOptions={{ color: '#2a7a40', weight: 1 }} />
                                  <Circle center={[place.latitude, place.longitude]} radius={place.gpsUncertaintyRadius} pathOptions={{ color: '#a82020', weight: 1, dashArray: '4 4' }} />
                                </>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </MapContainer>
                    ) : null}
                  </div>
                  {selectedPlace ? (
                    <div className="rounded-sm border border-admin-border bg-admin-bg p-4 font-sans text-adminBody text-admin-muted">
                      <div className="font-medium text-admin-text">{selectedPlace.name}</div>
                      <div className="mt-1">Zona: {selectedPlace.zone}</div>
                      <div>GPS radius: {selectedPlace.gpsRadius}m</div>
                      <div>Uncertainty: {selectedPlace.gpsUncertaintyRadius}m</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full">
              {isCreating ? 'Crea missione' : 'Salva missione'}
            </Button>
          </form>
        </Card>
      ) : (
        <Card className="flex items-center justify-center p-12">
          <span className="font-sans text-adminBody text-admin-muted">Seleziona una missione o creane una nuova</span>
        </Card>
      )}
    </div>
  );
}

function CheckpointEditor({
  index,
  form,
  onRemove
}: {
  index: number;
  form: any;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const typeValue: string = form.watch(`checkpoints.${index}.type`);
  const validationRule: Record<string, unknown> = form.watch(`checkpoints.${index}.validationRule`) ?? {};
  const [ruleText, setRuleText] = useState(() => JSON.stringify(validationRule, null, 2));
  const [ruleError, setRuleError] = useState(false);

  function onRuleChange(text: string) {
    setRuleText(text);
    try {
      form.setValue(`checkpoints.${index}.validationRule`, JSON.parse(text));
      setRuleError(false);
    } catch {
      setRuleError(true);
    }
  }

  return (
    <div className="rounded-sm border border-admin-border bg-admin-bg">
      <div className="flex items-center justify-between px-4 py-3">
        <button type="button" className="flex flex-1 items-center gap-2 text-left" onClick={() => setOpen((value) => !value)}>
          <span className="font-sans text-adminBody font-medium text-admin-text">Checkpoint {index + 1}</span>
          <span className="font-sans text-adminLabel text-admin-muted">{typeValue}</span>
          {open ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
        </button>
        <button type="button" className="ml-3 text-admin-danger" onClick={onRemove}>
          <X size={14} />
        </button>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-admin-border p-4">
          <Select {...form.register(`checkpoints.${index}.type`)}>
            <option value="keyword">Keyword</option>
            <option value="multiple_choice">Scelta multipla</option>
            <option value="observation_confirm">Conferma osservazione</option>
            <option value="count">Conteggio</option>
            <option value="sequence">Sequenza</option>
            <option value="walk_blind">Walk blind</option>
          </Select>
          <Textarea {...form.register(`checkpoints.${index}.prompt`)} placeholder="Testo del checkpoint..." className="h-20" />
          <div className="grid gap-3 md:grid-cols-3">
            <Input {...form.register(`checkpoints.${index}.hint0`)} placeholder="Indizio 1" />
            <Input {...form.register(`checkpoints.${index}.hint1`)} placeholder="Indizio 2" />
            <Input {...form.register(`checkpoints.${index}.hint2`)} placeholder="Indizio 3" />
          </div>
          <div>
            <label className="mb-1 block font-sans text-adminLabel text-admin-muted">Regola di validazione (JSON)</label>
            <Textarea value={ruleText} onChange={(event) => onRuleChange(event.target.value)} className={`h-24 font-mono text-xs ${ruleError ? 'border-admin-danger' : ''}`} />
            {ruleError ? <span className="font-sans text-adminLabel text-admin-danger">JSON non valido</span> : null}
          </div>
          <label className="flex items-center gap-2 font-sans text-adminBody text-admin-text">
            <input type="checkbox" {...form.register(`checkpoints.${index}.acceptAny`)} />
            Accetta qualsiasi risposta
          </label>
        </div>
      ) : null}
    </div>
  );
}
