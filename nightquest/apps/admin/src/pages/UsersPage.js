import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import { adminApi } from '../api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Table, THead, TBody, TR, TH, TD } from '../components/ui/Table';
export function UsersPage() {
    const [users, setUsers] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const form = useForm({ defaultValues: { role: 'editor' } });
    async function load() {
        try {
            setUsers((await adminApi.users()));
        }
        catch {
            // 403 if editor role — silently ignore
        }
    }
    useEffect(() => { void load(); }, []);
    async function onSubmit(values) {
        try {
            await adminApi.createUser(values);
            toast.success('Utente creato');
            setShowForm(false);
            form.reset({ email: '', password: '', role: 'editor' });
            await load();
        }
        catch {
            toast.error('Creazione non riuscita');
        }
    }
    async function toggleActive(user) {
        try {
            await adminApi.updateUser(user.id, { active: !user.active, role: user.role });
            await load();
        }
        catch {
            toast.error('Aggiornamento non riuscito');
        }
    }
    async function changeRole(user, role) {
        try {
            await adminApi.updateUser(user.id, { active: user.active, role });
            await load();
        }
        catch {
            toast.error('Aggiornamento non riuscito');
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-sans text-adminTitle font-semibold text-admin-text", children: "Utenti admin" }), _jsxs(Button, { onClick: () => setShowForm((s) => !s), children: [_jsx(Plus, { size: 14, className: "mr-2" }), " Nuovo utente"] })] }), showForm && (_jsxs(Card, { className: "p-6", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h3", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: "Crea utente" }), _jsx("button", { type: "button", onClick: () => setShowForm(false), children: _jsx(X, { size: 16 }) })] }), _jsxs("form", { onSubmit: form.handleSubmit(onSubmit), className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-3", children: [_jsx(Input, { ...form.register('email'), placeholder: "Email", type: "email" }), _jsx(Input, { ...form.register('password'), placeholder: "Password", type: "password" }), _jsxs(Select, { ...form.register('role'), children: [_jsx("option", { value: "editor", children: "Editor" }), _jsx("option", { value: "admin", children: "Admin" })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", children: "Crea" }), _jsx(Button, { type: "button", variant: "outline", onClick: () => setShowForm(false), children: "Annulla" })] })] })] })), _jsx(Card, { className: "p-6", children: users.length === 0 ? (_jsx("div", { className: "font-sans text-adminBody text-admin-muted", children: "Nessun utente trovato. Solo gli admin possono accedere a questa sezione." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs(Table, { children: [_jsx(THead, { children: _jsxs("tr", { children: [_jsx(TH, { children: "Email" }), _jsx(TH, { children: "Ruolo" }), _jsx(TH, { children: "Stato" }), _jsx(TH, { children: "Creato" }), _jsx(TH, { children: "Azioni" })] }) }), _jsx(TBody, { children: users.map((user) => (_jsxs(TR, { children: [_jsx(TD, { children: user.email }), _jsx(TD, { children: _jsxs(Select, { value: user.role, onChange: (e) => void changeRole(user, e.target.value), className: "w-28 py-1.5", children: [_jsx("option", { value: "editor", children: "Editor" }), _jsx("option", { value: "admin", children: "Admin" })] }) }), _jsx(TD, { children: _jsx(Badge, { tone: user.active ? 'success' : 'muted', children: user.active ? 'Attivo' : 'Disabilitato' }) }), _jsx(TD, { children: new Date(user.createdAt).toLocaleDateString('it-IT') }), _jsx(TD, { children: _jsx(Button, { variant: user.active ? 'outline' : 'primary', onClick: () => void toggleActive(user), children: user.active ? 'Disabilita' : 'Abilita' }) })] }, user.id))) })] }) })) })] }));
}
