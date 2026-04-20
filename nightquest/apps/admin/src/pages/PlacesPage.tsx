import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { adminApi } from '../api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import {
  countFilledVisualElements,
  createEmptyPlaceFactsDraft,
  PlaceFactsDraft,
  PlaceFactsEditor,
  placeFactsDraftFromApi,
  placeFactsDraftToApi
} from '../components/ui/PlaceFactsEditor';

type Place = {
  id: string;
  cityId: string;
  name: string;
  zone: string;
  latitude?: number | null;
  longitude?: number | null;
  atmosphere: string;
  hint: string;
  active: boolean;
  facts?: Record<string, any> | null;
};

type City = { id: string; name: string };

type PlaceForm = {
  name: string;
  zone: string;
  latitude: string;
  longitude: string;
  atmosphere: string;
  hint: string;
  active: boolean;
};

export function PlacesPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityId, setSelectedCityId] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [editing, setEditing] = useState<Place | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [factsPlaceId, setFactsPlaceId] = useState('');
  const [factsDraft, setFactsDraft] = useState<PlaceFactsDraft>(createEmptyPlaceFactsDraft());
  const form = useForm<PlaceForm>({ defaultValues: { active: true } });

  async function loadCities() {
    const data = (await adminApi.cities()) as City[];
    setCities(data);
    if (data.length > 0) {
      setSelectedCityId(data[0].id);
      await loadPlaces(data[0].id);
    }
  }

  async function loadPlaces(cityId: string) {
    setPlaces((await adminApi.places(cityId)) as Place[]);
  }

  useEffect(() => { void loadCities(); }, []);

  async function onCityChange(cityId: string) {
    setSelectedCityId(cityId);
    setShowForm(false);
    await loadPlaces(cityId);
  }

  function openCreate() {
    setEditing(null);
    form.reset({ name: '', zone: '', latitude: '', longitude: '', atmosphere: '', hint: '', active: true });
    setShowForm(true);
  }

  function openEdit(place: Place) {
    setEditing(place);
    form.reset({
      name: place.name,
      zone: place.zone,
      latitude: place.latitude != null ? String(place.latitude) : '',
      longitude: place.longitude != null ? String(place.longitude) : '',
      atmosphere: place.atmosphere,
      hint: place.hint,
      active: place.active
    });
    setShowForm(true);
  }

  async function onSubmit(values: PlaceForm) {
    const body = {
      cityId: selectedCityId,
      name: values.name,
      zone: values.zone,
      latitude: values.latitude !== '' ? Number(values.latitude) : null,
      longitude: values.longitude !== '' ? Number(values.longitude) : null,
      atmosphere: values.atmosphere,
      hint: values.hint,
      active: values.active
    };
    try {
      if (editing) {
        await adminApi.updatePlace(editing.id, body);
        toast.success('Luogo aggiornato');
      } else {
        await adminApi.createPlace(body);
        toast.success('Luogo creato');
      }
      setShowForm(false);
      await loadPlaces(selectedCityId);
    } catch {
      toast.error('Operazione non riuscita');
    }
  }

  async function deletePlace(place: Place) {
    if (!confirm(`Elimina "${place.name}"?`)) return;
    try {
      await adminApi.deletePlace(place.id);
      toast.success('Luogo eliminato');
      await loadPlaces(selectedCityId);
    } catch {
      toast.error('Eliminazione non riuscita');
    }
  }

  function openFacts(place: Place) {
    setFactsPlaceId(place.id);
    setFactsDraft(placeFactsDraftFromApi(place.facts));
  }

  async function saveFacts() {
    if (!factsPlaceId) return;
    try {
      const payload = placeFactsDraftToApi(factsDraft);
      if (payload.visualElements.length < 3) {
        toast.error('Servono almeno 3 elementi visivi completi');
        return;
      }
      await adminApi.upsertPlaceFacts({
        placeId: factsPlaceId,
        ...payload
      });
      toast.success('Fatti osservabili salvati');
      setFactsPlaceId('');
      await loadPlaces(selectedCityId);
    } catch {
      toast.error('PlaceFacts non validi o salvataggio fallito');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-adminTitle font-semibold text-admin-text">Luoghi</h2>
        <div className="flex gap-3">
          <Select
            value={selectedCityId}
            onChange={(e) => void onCityChange(e.target.value)}
            className="w-44"
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Button onClick={openCreate}>
            <Plus size={14} className="mr-2" /> Nuovo luogo
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-sans text-adminHeading font-semibold text-admin-text">
              {editing ? `Modifica: ${editing.name}` : 'Nuovo luogo'}
            </h3>
            <button type="button" onClick={() => setShowForm(false)}>
              <X size={16} />
            </button>
          </div>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input {...form.register('name')} placeholder="Nome luogo" />
              <Input {...form.register('zone')} placeholder="Zona (es. Centro storico)" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input {...form.register('latitude')} placeholder="Latitudine (opzionale)" type="number" step="any" />
              <Input {...form.register('longitude')} placeholder="Longitudine (opzionale)" type="number" step="any" />
            </div>
            <Textarea {...form.register('atmosphere')} placeholder="Atmosfera del luogo..." className="h-24" />
            <Input {...form.register('hint')} placeholder="Indizio per trovarlo..." />
            <label className="flex items-center gap-2 font-sans text-adminBody text-admin-text">
              <input type="checkbox" {...form.register('active')} />
              Attivo
            </label>
            <div className="flex gap-2">
              <Button type="submit">{editing ? 'Salva' : 'Crea'}</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Annulla
              </Button>
            </div>
          </form>
        </Card>
      )}

      {factsPlaceId && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-sans text-adminHeading font-semibold text-admin-text">Fatti osservabili</h3>
            <button type="button" onClick={() => setFactsPlaceId('')}>
              <X size={16} />
            </button>
          </div>
          <div className="mb-4 font-sans text-adminLabel text-admin-muted">
            Elementi visivi completi: {countFilledVisualElements(factsDraft)} / 3 minimi
          </div>
          <div className="space-y-3">
            <PlaceFactsEditor value={factsDraft} onChange={setFactsDraft} />
            <div className="flex gap-2">
              <Button onClick={() => void saveFacts()}>Salva facts</Button>
              <Button variant="outline" onClick={() => setFactsPlaceId('')}>
                Chiudi
              </Button>
            </div>
          </div>
        </Card>
      )}

      {places.length === 0 && !showForm ? (
        <EmptyState
          title="Nessun luogo"
          description="Aggiungi il primo luogo per questa città."
          actionLabel="Nuovo luogo"
          onAction={openCreate}
        />
      ) : (
        <div className="space-y-3">
          {places.map((place) => (
            <Card key={place.id} className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-adminHeading font-semibold text-admin-text">{place.name}</span>
                  <Badge tone="muted">{place.zone}</Badge>
                  {!place.active && <Badge tone="muted">Inattivo</Badge>}
                </div>
              <div className="mt-1 font-sans text-adminBody text-admin-muted">{place.atmosphere}</div>
              <div className="mt-1 font-sans text-adminLabel text-admin-muted italic">{place.hint}</div>
              <div className="mt-2 font-sans text-adminLabel text-admin-muted">
                Facts: {Array.isArray(place.facts?.visualElements) ? place.facts.visualElements.length : 0} visuali
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={() => openFacts(place)}>
                Facts
              </Button>
              <Button variant="outline" onClick={() => openEdit(place)}>
                <Pencil size={14} />
              </Button>
                <Button variant="danger" onClick={() => void deletePlace(place)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
