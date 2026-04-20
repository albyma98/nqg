import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Select } from '../components/ui/Input';

type Proposal = Record<string, any>;
type City = { id: string; name: string };

export function GenerationProposalsPage(props: {
  onOpenProposal: (proposalId: string) => void;
  initialCityId?: string;
}) {
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState(props.initialCityId ?? '');
  const [status, setStatus] = useState('pending');
  const [proposals, setProposals] = useState<Proposal[]>([]);

  async function load() {
    const [cityData, proposalData] = await Promise.all([
      adminApi.cities() as Promise<City[]>,
      adminApi.generationProposals({ cityId, status })
    ]);
    setCities(cityData);
    if (!cityId && cityData[0]) {
      setCityId(cityData[0].id);
    }
    setProposals(proposalData);
  }

  useEffect(() => {
    void load();
  }, [cityId, status]);

  async function quickReject(proposalId: string) {
    const reason = window.prompt('Motivo del rifiuto');
    if (!reason) return;
    try {
      await adminApi.rejectGenerationProposal(proposalId, { reason });
      toast.success('Proposta rifiutata');
      await load();
    } catch {
      toast.error('Rifiuto non riuscito');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Select value={cityId} onChange={(event) => setCityId(event.target.value)} className="w-48">
          <option value="">Tutte le città</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-48">
          {['pending', 'approved', 'rejected', 'modified'].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-3">
        {proposals.map((proposal) => {
          const mission = proposal.proposedMission as Record<string, unknown>;
          return (
            <Card key={String(proposal.id)} className="flex items-center justify-between gap-4">
              <div>
                <div className="font-sans text-adminHeading font-semibold text-admin-text">{String(mission.title ?? 'Proposta missione')}</div>
                <div className="mt-1 font-sans text-adminBody text-admin-muted">
                  {String(proposal.city?.name ?? '')} · {String(mission.toneSlug ?? '')} · diff {String(mission.difficulty ?? '')}
                </div>
                <div className="mt-1 font-sans text-adminLabel text-admin-muted">
                  {new Date(String(proposal.generatedAt)).toLocaleString('it-IT')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={proposal.status === 'approved' ? 'success' : proposal.status === 'rejected' ? 'danger' : 'muted'}>
                  {String(proposal.status)}
                </Badge>
                <Button variant="outline" onClick={() => props.onOpenProposal(String(proposal.id))}>
                  Rivedi
                </Button>
                {proposal.status === 'pending' && (
                  <Button variant="danger" onClick={() => void quickReject(String(proposal.id))}>
                    Rifiuta
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
