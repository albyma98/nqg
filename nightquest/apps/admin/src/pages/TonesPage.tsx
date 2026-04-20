import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, Pencil, X } from 'lucide-react';
import { adminApi } from '../api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';

type Tone = { id: string; slug: string; name: string; guidelines: string; bannedWords: string; examples: string };
type ToneForm = { slug: string; name: string; guidelines: string; bannedWordsRaw: string; examplesRaw: string };

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as string[];
  } catch {}
  return [];
}

export function TonesPage() {
  const [tones, setTones] = useState<Tone[]>([]);
  const [editing, setEditing] = useState<Tone | null>(null);
  const [showForm, setShowForm] = useState(false);
  const form = useForm<ToneForm>();

  async function load() {
    setTones((await adminApi.tones()) as Tone[]);
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditing(null);
    form.reset({ slug: '', name: '', guidelines: '', bannedWordsRaw: '', examplesRaw: '' });
    setShowForm(true);
  }

  function openEdit(tone: Tone) {
    setEditing(tone);
    form.reset({
      slug: tone.slug,
      name: tone.name,
      guidelines: tone.guidelines,
      bannedWordsRaw: parseJsonArray(tone.bannedWords).join('\n'),
      examplesRaw: parseJsonArray(tone.examples).join('\n')
    });
    setShowForm(true);
  }

  async function onSubmit(values: ToneForm) {
    const body = {
      slug: values.slug,
      name: values.name,
      guidelines: values.guidelines,
      bannedWords: values.bannedWordsRaw.split('\n').map((s) => s.trim()).filter(Boolean),
      examples: values.examplesRaw.split('\n').map((s) => s.trim()).filter(Boolean)
    };
    try {
      if (editing) {
        await adminApi.updateTone(editing.id, body);
        toast.success('Tono aggiornato');
      } else {
        await adminApi.createTone(body);
        toast.success('Tono creato');
      }
      setShowForm(false);
      await load();
    } catch {
      toast.error('Operazione non riuscita');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-adminTitle font-semibold text-admin-text">Toni narrativi</h2>
        <Button onClick={openCreate}>
          <Plus size={14} className="mr-2" /> Nuovo tono
        </Button>
      </div>

      {showForm && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-sans text-adminHeading font-semibold text-admin-text">
              {editing ? `Modifica: ${editing.name}` : 'Nuovo tono'}
            </h3>
            <button type="button" onClick={() => setShowForm(false)}>
              <X size={16} />
            </button>
          </div>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input {...form.register('name')} placeholder="Nome (es. Enigmatico)" />
              <Input {...form.register('slug')} placeholder="Slug (es. enigmatico)" />
            </div>
            <Textarea {...form.register('guidelines')} placeholder="Linee guida narrative..." className="h-28" />
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block font-sans text-adminLabel text-admin-muted">
                  Parole vietate (una per riga)
                </label>
                <Textarea
                  {...form.register('bannedWordsRaw')}
                  placeholder={'assolutamente\nottima domanda'}
                  className="h-28"
                />
              </div>
              <div>
                <label className="mb-1 block font-sans text-adminLabel text-admin-muted">
                  Esempi di output (uno per riga)
                </label>
                <Textarea
                  {...form.register('examplesRaw')}
                  placeholder={'So dove sei stato.\nLa città non dimentica.'}
                  className="h-28"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">{editing ? 'Salva' : 'Crea'}</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Annulla
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tones.length === 0 && !showForm ? (
        <EmptyState
          title="Nessun tono"
          description="Crea il primo tono narrativo."
          actionLabel="Nuovo tono"
          onAction={openCreate}
        />
      ) : (
        <div className="space-y-3">
          {tones.map((tone) => (
            <Card key={tone.id} className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-adminHeading font-semibold text-admin-text">{tone.name}</span>
                  <span className="font-sans text-adminLabel text-admin-muted">{tone.slug}</span>
                </div>
                <div className="mt-1 font-sans text-adminBody text-admin-muted">{tone.guidelines}</div>
                {parseJsonArray(tone.bannedWords).length > 0 && (
                  <div className="mt-1 font-sans text-adminLabel text-admin-muted">
                    Vietate: {parseJsonArray(tone.bannedWords).join(', ')}
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={() => openEdit(tone)}>
                <Pencil size={14} />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
