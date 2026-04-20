import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Textarea } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

type Version = { id: string; content: string; createdAt: string };

export function SystemPromptPage() {
  const [content, setContent] = useState('');
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [sandboxResult, setSandboxResult] = useState<string | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  async function load() {
    const data = await adminApi.systemPrompt();
    setContent(data.current?.content ?? '');
    setVersions(data.versions ?? []);
    if (data.versions?.length > 0) {
      setSelectedVersionId(data.versions[0].id);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    try {
      await adminApi.updateSystemPrompt(content);
      toast.success('Versione salvata');
      await load();
    } catch {
      toast.error('Salvataggio non riuscito');
    }
  }

  async function runSandbox() {
    setSandboxLoading(true);
    setSandboxResult(null);
    try {
      const result = await adminApi.sandboxSystemPrompt(content);
      setSandboxResult(result.prompt);
    } catch {
      toast.error('Sandbox non riuscito');
    } finally {
      setSandboxLoading(false);
    }
  }

  function loadVersion(version: Version) {
    setContent(version.content);
    toast.success('Versione caricata nell\'editor — ricordati di salvare');
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4">
        <Card className="p-6">
          <h2 className="mb-4 font-sans text-adminTitle font-semibold text-admin-text">
            System prompt — L'Ombra
          </h2>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="h-[420px] font-mono text-sm"
          />
          <div className="mt-4 flex gap-3">
            <Button onClick={() => void save()}>Salva nuova versione</Button>
            <Button variant="outline" onClick={() => void runSandbox()} disabled={sandboxLoading}>
              {sandboxLoading ? 'Elaborazione...' : 'Test sandbox'}
            </Button>
          </div>
        </Card>

        {sandboxResult != null && (
          <Card className="p-6">
            <h3 className="mb-3 font-sans text-adminHeading font-semibold text-admin-text">Output sandbox</h3>
            <pre className="whitespace-pre-wrap font-mono text-xs text-admin-text">{sandboxResult}</pre>
          </Card>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-sans text-adminHeading font-semibold text-admin-text">Storico versioni</h3>
        {versions.length === 0 ? (
          <div className="font-sans text-adminBody text-admin-muted">Nessuna versione salvata.</div>
        ) : (
          versions.map((v, i) => (
            <Card
              key={v.id}
              className={`cursor-pointer p-3 transition hover:border-admin-text ${selectedVersionId === v.id ? 'border-admin-text' : ''}`}
              onClick={() => setSelectedVersionId(v.id)}
            >
              <div className="flex items-center justify-between">
                <Badge tone={i === 0 ? 'success' : 'muted'}>
                  {i === 0 ? 'Corrente' : `v${versions.length - i}`}
                </Badge>
                <span className="font-sans text-adminLabel text-admin-muted">
                  {new Date(v.createdAt).toLocaleDateString('it-IT')}
                </span>
              </div>
              <div className="mt-2 line-clamp-2 font-mono text-xs text-admin-muted">
                {v.content.slice(0, 120)}...
              </div>
              {selectedVersionId === v.id && (
                <Button
                  variant="outline"
                  className="mt-3 w-full text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadVersion(v);
                  }}
                >
                  Carica nell'editor
                </Button>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
