import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';

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

export function GenerationProposalDetailPage(props: {
  proposalId: string;
  onBack: () => void;
}) {
  const [proposal, setProposal] = useState<Record<string, any> | null>(null);
  const [missionText, setMissionText] = useState('{}');
  const [checkpointsText, setCheckpointsText] = useState('[]');
  const [transitText, setTransitText] = useState('null');
  const [confirmRead, setConfirmRead] = useState(false);

  async function load() {
    const data = await adminApi.generationProposalDetail(props.proposalId);
    setProposal(data);
    setMissionText(JSON.stringify(parseJson(data.proposedMission, {}), null, 2));
    setCheckpointsText(JSON.stringify(parseJson(data.proposedCheckpoints, []), null, 2));
    setTransitText(JSON.stringify(parseJson(data.proposedTransit, null), null, 2));
  }

  useEffect(() => {
    void load();
  }, [props.proposalId]);

  const parsedMission = useMemo(() => parseJson<Record<string, unknown>>(missionText, {}), [missionText]);
  const parsedCheckpoints = useMemo(() => parseJson<Array<Record<string, unknown>>>(checkpointsText, []), [checkpointsText]);
  const parsedTransit = useMemo(() => parseJson<Record<string, unknown> | null>(transitText, null), [transitText]);

  async function saveModifications() {
    try {
      await adminApi.patchGenerationProposal(props.proposalId, {
        proposedMission: parsedMission,
        proposedCheckpoints: parsedCheckpoints,
        proposedTransit: parsedTransit,
        modifications: [{ field: 'manual_edit', reason: 'review_admin' }]
      });
      toast.success('Modifiche salvate');
      await load();
    } catch {
      toast.error('Salvataggio non riuscito');
    }
  }

  async function approve() {
    if (!confirmRead) {
      toast.error('Conferma prima di aver letto e verificato la proposta');
      return;
    }
    try {
      await adminApi.approveGenerationProposal(props.proposalId, {
        proposedMission: parsedMission,
        proposedCheckpoints: parsedCheckpoints,
        proposedTransit: parsedTransit,
        modifications: [{ field: 'approval', reason: 'human_review_confirmed' }]
      });
      toast.success('Proposta approvata e pubblicata');
      await load();
    } catch {
      toast.error('Approvazione non riuscita');
    }
  }

  async function reject() {
    const reason = window.prompt('Motivo del rifiuto');
    if (!reason) return;
    try {
      await adminApi.rejectGenerationProposal(props.proposalId, { reason });
      toast.success('Proposta rifiutata');
      await load();
    } catch {
      toast.error('Rifiuto non riuscito');
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={props.onBack}>
        Torna alla ReviewQueue
      </Button>

      {proposal && (
        <>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-sans text-adminTitle font-semibold text-admin-text">{String(parsedMission.title ?? 'Proposta')}</div>
                <div className="mt-1 font-sans text-adminBody text-admin-muted">{String(proposal.city?.name ?? '')}</div>
              </div>
              <Badge tone={proposal.status === 'approved' ? 'success' : proposal.status === 'rejected' ? 'danger' : 'muted'}>
                {String(proposal.status)}
              </Badge>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-4">
              <div className="mb-2 font-sans text-adminHeading font-semibold text-admin-text">Editor proposta</div>
              <div className="space-y-3">
                <Textarea value={missionText} onChange={(event) => setMissionText(event.target.value)} className="h-48 font-mono text-xs" />
                <Textarea value={checkpointsText} onChange={(event) => setCheckpointsText(event.target.value)} className="h-56 font-mono text-xs" />
                <Textarea value={transitText} onChange={(event) => setTransitText(event.target.value)} className="h-40 font-mono text-xs" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-2 font-sans text-adminHeading font-semibold text-admin-text">Anteprima utente</div>
              <div className="space-y-3">
                <div className="font-serif text-2xl italic text-admin-text">{String(parsedMission.openingBrief ?? '')}</div>
                <div className="font-sans text-adminBody text-admin-muted">Obiettivo: {String(parsedMission.objective ?? '')}</div>
                {parsedCheckpoints.map((checkpoint, index) => (
                  <div key={index} className="rounded-sm border border-admin-border p-3">
                    <div className="font-sans text-adminBody font-medium text-admin-text">{String(checkpoint.prompt ?? '')}</div>
                    <div className="mt-2 font-sans text-adminLabel text-admin-muted">
                      Hint: {Array.isArray(checkpoint.hints) ? checkpoint.hints.join(' / ') : ''}
                    </div>
                  </div>
                ))}
                <div className="font-serif text-xl italic text-admin-text">{String(parsedMission.successNote ?? '')}</div>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <label className="flex items-center gap-2 font-sans text-adminBody text-admin-text">
              <input type="checkbox" checked={confirmRead} onChange={(event) => setConfirmRead(event.target.checked)} />
              Ho letto tutti i checkpoint e le frasi dell'Ombra e confermo che sono all'altezza del prodotto
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => void saveModifications()}>Salva modifiche</Button>
              <Button onClick={() => void approve()} disabled={!confirmRead || proposal.status === 'approved'}>
                Approva e pubblica
              </Button>
              <Button variant="danger" onClick={() => void reject()} disabled={proposal.status === 'approved'}>
                Rifiuta
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
