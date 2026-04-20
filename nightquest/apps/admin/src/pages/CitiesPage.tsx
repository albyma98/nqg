import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { adminApi } from '../api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

type City = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  openingLine: string;
  _count?: { missions?: number; generatedProposals?: number; places?: number };
};
type CityForm = { slug: string; name: string; openingLine: string; active: boolean };

export function CitiesPage(props: {
  onGenerateForCity?: (cityId: string) => void;
  onOpenProposals?: (cityId: string) => void;
}) {
  const [cities, setCities] = useState<City[]>([]);
  const [editing, setEditing] = useState<City | null>(null);
  const [showForm, setShowForm] = useState(false);
  const form = useForm<CityForm>({ defaultValues: { active: true } });

  async function load() {
    setCities((await adminApi.cities()) as City[]);
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    form.reset({ slug: '', name: '', openingLine: '', active: true });
    setShowForm(true);
  }

  function openEdit(city: City) {
    setEditing(city);
    form.reset({ slug: city.slug, name: city.name, openingLine: city.openingLine, active: city.active });
    setShowForm(true);
  }

  async function onSubmit(values: CityForm) {
    try {
      if (editing) {
        await adminApi.updateCity(editing.id, values);
        toast.success('Citta aggiornata');
      } else {
        await adminApi.createCity(values);
        toast.success('Citta creata');
      }
      setShowForm(false);
      await load();
    } catch {
      toast.error('Operazione non riuscita');
    }
  }

  async function deleteCity(city: City) {
    if (!confirm(`Elimina "${city.name}"? Verranno eliminate anche tutte le missioni e sessioni associate.`)) return;
    try {
      await adminApi.deleteCity(city.id);
      toast.success('Citta eliminata');
      await load();
    } catch {
      toast.error('Eliminazione non riuscita');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-adminTitle font-semibold text-admin-text">Citta</h2>
        <Button onClick={openCreate}>
          <Plus size={14} className="mr-2" /> Nuova citta
        </Button>
      </div>

      {showForm && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-sans text-adminHeading font-semibold text-admin-text">
              {editing ? `Modifica: ${editing.name}` : 'Nuova citta'}
            </h3>
            <button type="button" onClick={() => setShowForm(false)}>
              <X size={16} />
            </button>
          </div>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input {...form.register('name')} placeholder="Nome citta" />
              <Input {...form.register('slug')} placeholder="slug (es. gallipoli)" />
            </div>
            <Textarea {...form.register('openingLine')} placeholder="Frase di apertura..." className="h-24" />
            <label className="flex items-center gap-2 font-sans text-adminBody text-admin-text">
              <input type="checkbox" {...form.register('active')} />
              Attiva
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

      {cities.length === 0 && !showForm ? (
        <EmptyState
          title="Nessuna citta"
          description="Crea la prima citta per iniziare."
          actionLabel="Nuova citta"
          onAction={openCreate}
        />
      ) : (
        <div className="space-y-3">
          {cities.map((city) => (
            <Card key={city.id} className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-adminHeading font-semibold text-admin-text">{city.name}</span>
                  <Badge tone={city.active ? 'success' : 'muted'}>{city.active ? 'Attiva' : 'Inattiva'}</Badge>
                </div>
                <div className="mt-1 font-sans text-adminLabel text-admin-muted">{city.slug}</div>
                <div className="mt-1 truncate font-sans text-adminBody text-admin-muted">{city.openingLine}</div>
                <div className="mt-2 flex gap-3 font-sans text-adminLabel text-admin-muted">
                  <span>{Number(city._count?.places ?? 0)} luoghi</span>
                  <span>{Number(city._count?.missions ?? 0)} missioni</span>
                  <span>{Number(city._count?.generatedProposals ?? 0)} proposte</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {Number(city._count?.places ?? 0) >= 3 && (
                  <Button variant="outline" onClick={() => props.onGenerateForCity?.(city.id)}>
                    Genera missioni con AI
                  </Button>
                )}
                {Number(city._count?.generatedProposals ?? 0) > 0 && (
                  <Button variant="ghost" onClick={() => props.onOpenProposals?.(city.id)}>
                    Proposte in coda
                  </Button>
                )}
                <Button variant="outline" onClick={() => openEdit(city)}>
                  <Pencil size={14} />
                </Button>
                <Button variant="danger" onClick={() => void deleteCity(city)}>
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
