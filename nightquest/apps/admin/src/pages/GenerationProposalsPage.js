import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Select } from '../components/ui/Input';
export function GenerationProposalsPage(props) {
    const [cities, setCities] = useState([]);
    const [cityId, setCityId] = useState(props.initialCityId ?? '');
    const [status, setStatus] = useState('pending');
    const [proposals, setProposals] = useState([]);
    async function load() {
        const [cityData, proposalData] = await Promise.all([
            adminApi.cities(),
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
    async function quickReject(proposalId) {
        const reason = window.prompt('Motivo del rifiuto');
        if (!reason)
            return;
        try {
            await adminApi.rejectGenerationProposal(proposalId, { reason });
            toast.success('Proposta rifiutata');
            await load();
        }
        catch {
            toast.error('Rifiuto non riuscito');
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex gap-3", children: [_jsxs(Select, { value: cityId, onChange: (event) => setCityId(event.target.value), className: "w-48", children: [_jsx("option", { value: "", children: "Tutte le citt\u00E0" }), cities.map((city) => (_jsx("option", { value: city.id, children: city.name }, city.id)))] }), _jsx(Select, { value: status, onChange: (event) => setStatus(event.target.value), className: "w-48", children: ['pending', 'approved', 'rejected', 'modified'].map((value) => (_jsx("option", { value: value, children: value }, value))) })] }), _jsx("div", { className: "space-y-3", children: proposals.map((proposal) => {
                    const mission = proposal.proposedMission;
                    return (_jsxs(Card, { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("div", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: String(mission.title ?? 'Proposta missione') }), _jsxs("div", { className: "mt-1 font-sans text-adminBody text-admin-muted", children: [String(proposal.city?.name ?? ''), " \u00B7 ", String(mission.toneSlug ?? ''), " \u00B7 diff ", String(mission.difficulty ?? '')] }), _jsx("div", { className: "mt-1 font-sans text-adminLabel text-admin-muted", children: new Date(String(proposal.generatedAt)).toLocaleString('it-IT') })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Badge, { tone: proposal.status === 'approved' ? 'success' : proposal.status === 'rejected' ? 'danger' : 'muted', children: String(proposal.status) }), _jsx(Button, { variant: "outline", onClick: () => props.onOpenProposal(String(proposal.id)), children: "Rivedi" }), proposal.status === 'pending' && (_jsx(Button, { variant: "danger", onClick: () => void quickReject(String(proposal.id)), children: "Rifiuta" }))] })] }, String(proposal.id)));
                }) })] }));
}
