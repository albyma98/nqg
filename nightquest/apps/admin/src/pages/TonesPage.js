import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, Pencil, X } from 'lucide-react';
import { adminApi } from '../api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
function parseJsonArray(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed))
            return parsed;
    }
    catch { }
    return [];
}
export function TonesPage() {
    const [tones, setTones] = useState([]);
    const [editing, setEditing] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const form = useForm();
    async function load() {
        setTones((await adminApi.tones()));
    }
    useEffect(() => { void load(); }, []);
    function openCreate() {
        setEditing(null);
        form.reset({ slug: '', name: '', guidelines: '', bannedWordsRaw: '', examplesRaw: '' });
        setShowForm(true);
    }
    function openEdit(tone) {
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
    async function onSubmit(values) {
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
            }
            else {
                await adminApi.createTone(body);
                toast.success('Tono creato');
            }
            setShowForm(false);
            await load();
        }
        catch {
            toast.error('Operazione non riuscita');
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-sans text-adminTitle font-semibold text-admin-text", children: "Toni narrativi" }), _jsxs(Button, { onClick: openCreate, children: [_jsx(Plus, { size: 14, className: "mr-2" }), " Nuovo tono"] })] }), showForm && (_jsxs(Card, { className: "p-6", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h3", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: editing ? `Modifica: ${editing.name}` : 'Nuovo tono' }), _jsx("button", { type: "button", onClick: () => setShowForm(false), children: _jsx(X, { size: 16 }) })] }), _jsxs("form", { onSubmit: form.handleSubmit(onSubmit), className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx(Input, { ...form.register('name'), placeholder: "Nome (es. Enigmatico)" }), _jsx(Input, { ...form.register('slug'), placeholder: "Slug (es. enigmatico)" })] }), _jsx(Textarea, { ...form.register('guidelines'), placeholder: "Linee guida narrative...", className: "h-28" }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block font-sans text-adminLabel text-admin-muted", children: "Parole vietate (una per riga)" }), _jsx(Textarea, { ...form.register('bannedWordsRaw'), placeholder: 'assolutamente\nottima domanda', className: "h-28" })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block font-sans text-adminLabel text-admin-muted", children: "Esempi di output (uno per riga)" }), _jsx(Textarea, { ...form.register('examplesRaw'), placeholder: 'So dove sei stato.\nLa città non dimentica.', className: "h-28" })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", children: editing ? 'Salva' : 'Crea' }), _jsx(Button, { type: "button", variant: "outline", onClick: () => setShowForm(false), children: "Annulla" })] })] })] })), tones.length === 0 && !showForm ? (_jsx(EmptyState, { title: "Nessun tono", description: "Crea il primo tono narrativo.", actionLabel: "Nuovo tono", onAction: openCreate })) : (_jsx("div", { className: "space-y-3", children: tones.map((tone) => (_jsxs(Card, { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: tone.name }), _jsx("span", { className: "font-sans text-adminLabel text-admin-muted", children: tone.slug })] }), _jsx("div", { className: "mt-1 font-sans text-adminBody text-admin-muted", children: tone.guidelines }), parseJsonArray(tone.bannedWords).length > 0 && (_jsxs("div", { className: "mt-1 font-sans text-adminLabel text-admin-muted", children: ["Vietate: ", parseJsonArray(tone.bannedWords).join(', ')] }))] }), _jsx(Button, { variant: "outline", onClick: () => openEdit(tone), children: _jsx(Pencil, { size: 14 }) })] }, tone.id))) }))] }));
}
