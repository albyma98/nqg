import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Textarea } from '../components/ui/Input';
function parseJson(value, fallback) {
    if (value == null)
        return fallback;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        }
        catch {
            return fallback;
        }
    }
    return value;
}
export function GenerationProposalDetailPage(props) {
    const [proposal, setProposal] = useState(null);
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
    const parsedMission = useMemo(() => parseJson(missionText, {}), [missionText]);
    const parsedCheckpoints = useMemo(() => parseJson(checkpointsText, []), [checkpointsText]);
    const parsedTransit = useMemo(() => parseJson(transitText, null), [transitText]);
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
        }
        catch {
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
        }
        catch {
            toast.error('Approvazione non riuscita');
        }
    }
    async function reject() {
        const reason = window.prompt('Motivo del rifiuto');
        if (!reason)
            return;
        try {
            await adminApi.rejectGenerationProposal(props.proposalId, { reason });
            toast.success('Proposta rifiutata');
            await load();
        }
        catch {
            toast.error('Rifiuto non riuscito');
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(Button, { variant: "ghost", onClick: props.onBack, children: "Torna alla ReviewQueue" }), proposal && (_jsxs(_Fragment, { children: [_jsx(Card, { className: "p-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-sans text-adminTitle font-semibold text-admin-text", children: String(parsedMission.title ?? 'Proposta') }), _jsx("div", { className: "mt-1 font-sans text-adminBody text-admin-muted", children: String(proposal.city?.name ?? '') })] }), _jsx(Badge, { tone: proposal.status === 'approved' ? 'success' : proposal.status === 'rejected' ? 'danger' : 'muted', children: String(proposal.status) })] }) }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-2", children: [_jsxs(Card, { className: "p-4", children: [_jsx("div", { className: "mb-2 font-sans text-adminHeading font-semibold text-admin-text", children: "Editor proposta" }), _jsxs("div", { className: "space-y-3", children: [_jsx(Textarea, { value: missionText, onChange: (event) => setMissionText(event.target.value), className: "h-48 font-mono text-xs" }), _jsx(Textarea, { value: checkpointsText, onChange: (event) => setCheckpointsText(event.target.value), className: "h-56 font-mono text-xs" }), _jsx(Textarea, { value: transitText, onChange: (event) => setTransitText(event.target.value), className: "h-40 font-mono text-xs" })] })] }), _jsxs(Card, { className: "p-4", children: [_jsx("div", { className: "mb-2 font-sans text-adminHeading font-semibold text-admin-text", children: "Anteprima utente" }), _jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "font-serif text-2xl italic text-admin-text", children: String(parsedMission.openingBrief ?? '') }), _jsxs("div", { className: "font-sans text-adminBody text-admin-muted", children: ["Obiettivo: ", String(parsedMission.objective ?? '')] }), parsedCheckpoints.map((checkpoint, index) => (_jsxs("div", { className: "rounded-sm border border-admin-border p-3", children: [_jsx("div", { className: "font-sans text-adminBody font-medium text-admin-text", children: String(checkpoint.prompt ?? '') }), _jsxs("div", { className: "mt-2 font-sans text-adminLabel text-admin-muted", children: ["Hint: ", Array.isArray(checkpoint.hints) ? checkpoint.hints.join(' / ') : ''] })] }, index))), _jsx("div", { className: "font-serif text-xl italic text-admin-text", children: String(parsedMission.successNote ?? '') })] })] })] }), _jsxs(Card, { className: "p-4", children: [_jsxs("label", { className: "flex items-center gap-2 font-sans text-adminBody text-admin-text", children: [_jsx("input", { type: "checkbox", checked: confirmRead, onChange: (event) => setConfirmRead(event.target.checked) }), "Ho letto tutti i checkpoint e le frasi dell'Ombra e confermo che sono all'altezza del prodotto"] }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-2", children: [_jsx(Button, { onClick: () => void saveModifications(), children: "Salva modifiche" }), _jsx(Button, { onClick: () => void approve(), disabled: !confirmRead || proposal.status === 'approved', children: "Approva e pubblica" }), _jsx(Button, { variant: "danger", onClick: () => void reject(), disabled: proposal.status === 'approved', children: "Rifiuta" })] })] })] }))] }));
}
