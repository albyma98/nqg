import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Textarea } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
export function SystemPromptPage() {
    const [content, setContent] = useState('');
    const [versions, setVersions] = useState([]);
    const [selectedVersionId, setSelectedVersionId] = useState(null);
    const [sandboxResult, setSandboxResult] = useState(null);
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
        }
        catch {
            toast.error('Salvataggio non riuscito');
        }
    }
    async function runSandbox() {
        setSandboxLoading(true);
        setSandboxResult(null);
        try {
            const result = await adminApi.sandboxSystemPrompt(content);
            setSandboxResult(result.prompt);
        }
        catch {
            toast.error('Sandbox non riuscito');
        }
        finally {
            setSandboxLoading(false);
        }
    }
    function loadVersion(version) {
        setContent(version.content);
        toast.success('Versione caricata nell\'editor — ricordati di salvare');
    }
    return (_jsxs("div", { className: "grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs(Card, { className: "p-6", children: [_jsx("h2", { className: "mb-4 font-sans text-adminTitle font-semibold text-admin-text", children: "System prompt \u2014 L'Ombra" }), _jsx(Textarea, { value: content, onChange: (e) => setContent(e.target.value), className: "h-[420px] font-mono text-sm" }), _jsxs("div", { className: "mt-4 flex gap-3", children: [_jsx(Button, { onClick: () => void save(), children: "Salva nuova versione" }), _jsx(Button, { variant: "outline", onClick: () => void runSandbox(), disabled: sandboxLoading, children: sandboxLoading ? 'Elaborazione...' : 'Test sandbox' })] })] }), sandboxResult != null && (_jsxs(Card, { className: "p-6", children: [_jsx("h3", { className: "mb-3 font-sans text-adminHeading font-semibold text-admin-text", children: "Output sandbox" }), _jsx("pre", { className: "whitespace-pre-wrap font-mono text-xs text-admin-text", children: sandboxResult })] }))] }), _jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: "Storico versioni" }), versions.length === 0 ? (_jsx("div", { className: "font-sans text-adminBody text-admin-muted", children: "Nessuna versione salvata." })) : (versions.map((v, i) => (_jsxs(Card, { className: `cursor-pointer p-3 transition hover:border-admin-text ${selectedVersionId === v.id ? 'border-admin-text' : ''}`, onClick: () => setSelectedVersionId(v.id), children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Badge, { tone: i === 0 ? 'success' : 'muted', children: i === 0 ? 'Corrente' : `v${versions.length - i}` }), _jsx("span", { className: "font-sans text-adminLabel text-admin-muted", children: new Date(v.createdAt).toLocaleDateString('it-IT') })] }), _jsxs("div", { className: "mt-2 line-clamp-2 font-mono text-xs text-admin-muted", children: [v.content.slice(0, 120), "..."] }), selectedVersionId === v.id && (_jsx(Button, { variant: "outline", className: "mt-3 w-full text-xs", onClick: (e) => {
                                    e.stopPropagation();
                                    loadVersion(v);
                                }, children: "Carica nell'editor" }))] }, v.id))))] })] }));
}
