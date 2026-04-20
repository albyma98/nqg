import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
export function CitiesPage(props) {
    const [cities, setCities] = useState([]);
    const [editing, setEditing] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const form = useForm({ defaultValues: { active: true } });
    async function load() {
        setCities((await adminApi.cities()));
    }
    useEffect(() => {
        void load();
    }, []);
    function openCreate() {
        setEditing(null);
        form.reset({ slug: '', name: '', openingLine: '', active: true });
        setShowForm(true);
    }
    function openEdit(city) {
        setEditing(city);
        form.reset({ slug: city.slug, name: city.name, openingLine: city.openingLine, active: city.active });
        setShowForm(true);
    }
    async function onSubmit(values) {
        try {
            if (editing) {
                await adminApi.updateCity(editing.id, values);
                toast.success('Citta aggiornata');
            }
            else {
                await adminApi.createCity(values);
                toast.success('Citta creata');
            }
            setShowForm(false);
            await load();
        }
        catch {
            toast.error('Operazione non riuscita');
        }
    }
    async function deleteCity(city) {
        if (!confirm(`Elimina "${city.name}"? Verranno eliminate anche tutte le missioni e sessioni associate.`))
            return;
        try {
            await adminApi.deleteCity(city.id);
            toast.success('Citta eliminata');
            await load();
        }
        catch {
            toast.error('Eliminazione non riuscita');
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-sans text-adminTitle font-semibold text-admin-text", children: "Citta" }), _jsxs(Button, { onClick: openCreate, children: [_jsx(Plus, { size: 14, className: "mr-2" }), " Nuova citta"] })] }), showForm && (_jsxs(Card, { className: "p-6", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h3", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: editing ? `Modifica: ${editing.name}` : 'Nuova citta' }), _jsx("button", { type: "button", onClick: () => setShowForm(false), children: _jsx(X, { size: 16 }) })] }), _jsxs("form", { onSubmit: form.handleSubmit(onSubmit), className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx(Input, { ...form.register('name'), placeholder: "Nome citta" }), _jsx(Input, { ...form.register('slug'), placeholder: "slug (es. gallipoli)" })] }), _jsx(Textarea, { ...form.register('openingLine'), placeholder: "Frase di apertura...", className: "h-24" }), _jsxs("label", { className: "flex items-center gap-2 font-sans text-adminBody text-admin-text", children: [_jsx("input", { type: "checkbox", ...form.register('active') }), "Attiva"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", children: editing ? 'Salva' : 'Crea' }), _jsx(Button, { type: "button", variant: "outline", onClick: () => setShowForm(false), children: "Annulla" })] })] })] })), cities.length === 0 && !showForm ? (_jsx(EmptyState, { title: "Nessuna citta", description: "Crea la prima citta per iniziare.", actionLabel: "Nuova citta", onAction: openCreate })) : (_jsx("div", { className: "space-y-3", children: cities.map((city) => (_jsxs(Card, { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: city.name }), _jsx(Badge, { tone: city.active ? 'success' : 'muted', children: city.active ? 'Attiva' : 'Inattiva' })] }), _jsx("div", { className: "mt-1 font-sans text-adminLabel text-admin-muted", children: city.slug }), _jsx("div", { className: "mt-1 truncate font-sans text-adminBody text-admin-muted", children: city.openingLine }), _jsxs("div", { className: "mt-2 flex gap-3 font-sans text-adminLabel text-admin-muted", children: [_jsxs("span", { children: [Number(city._count?.places ?? 0), " luoghi"] }), _jsxs("span", { children: [Number(city._count?.missions ?? 0), " missioni"] }), _jsxs("span", { children: [Number(city._count?.generatedProposals ?? 0), " proposte"] })] })] }), _jsxs("div", { className: "flex shrink-0 gap-2", children: [Number(city._count?.places ?? 0) >= 3 && (_jsx(Button, { variant: "outline", onClick: () => props.onGenerateForCity?.(city.id), children: "Genera missioni con AI" })), Number(city._count?.generatedProposals ?? 0) > 0 && (_jsx(Button, { variant: "ghost", onClick: () => props.onOpenProposals?.(city.id), children: "Proposte in coda" })), _jsx(Button, { variant: "outline", onClick: () => openEdit(city), children: _jsx(Pencil, { size: 14 }) }), _jsx(Button, { variant: "danger", onClick: () => void deleteCity(city), children: _jsx(Trash2, { size: 14 }) })] })] }, city.id))) }))] }));
}
