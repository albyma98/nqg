import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { adminApi } from '../api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { countFilledVisualElements, createEmptyPlaceFactsDraft, PlaceFactsEditor, placeFactsDraftFromApi, placeFactsDraftToApi } from '../components/ui/PlaceFactsEditor';
export function PlacesPage() {
    const [cities, setCities] = useState([]);
    const [selectedCityId, setSelectedCityId] = useState('');
    const [places, setPlaces] = useState([]);
    const [editing, setEditing] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [factsPlaceId, setFactsPlaceId] = useState('');
    const [factsDraft, setFactsDraft] = useState(createEmptyPlaceFactsDraft());
    const form = useForm({ defaultValues: { active: true } });
    async function loadCities() {
        const data = (await adminApi.cities());
        setCities(data);
        if (data.length > 0) {
            setSelectedCityId(data[0].id);
            await loadPlaces(data[0].id);
        }
    }
    async function loadPlaces(cityId) {
        setPlaces((await adminApi.places(cityId)));
    }
    useEffect(() => { void loadCities(); }, []);
    async function onCityChange(cityId) {
        setSelectedCityId(cityId);
        setShowForm(false);
        await loadPlaces(cityId);
    }
    function openCreate() {
        setEditing(null);
        form.reset({ name: '', zone: '', latitude: '', longitude: '', atmosphere: '', hint: '', active: true });
        setShowForm(true);
    }
    function openEdit(place) {
        setEditing(place);
        form.reset({
            name: place.name,
            zone: place.zone,
            latitude: place.latitude != null ? String(place.latitude) : '',
            longitude: place.longitude != null ? String(place.longitude) : '',
            atmosphere: place.atmosphere,
            hint: place.hint,
            active: place.active
        });
        setShowForm(true);
    }
    async function onSubmit(values) {
        const body = {
            cityId: selectedCityId,
            name: values.name,
            zone: values.zone,
            latitude: values.latitude !== '' ? Number(values.latitude) : null,
            longitude: values.longitude !== '' ? Number(values.longitude) : null,
            atmosphere: values.atmosphere,
            hint: values.hint,
            active: values.active
        };
        try {
            if (editing) {
                await adminApi.updatePlace(editing.id, body);
                toast.success('Luogo aggiornato');
            }
            else {
                await adminApi.createPlace(body);
                toast.success('Luogo creato');
            }
            setShowForm(false);
            await loadPlaces(selectedCityId);
        }
        catch {
            toast.error('Operazione non riuscita');
        }
    }
    async function deletePlace(place) {
        if (!confirm(`Elimina "${place.name}"?`))
            return;
        try {
            await adminApi.deletePlace(place.id);
            toast.success('Luogo eliminato');
            await loadPlaces(selectedCityId);
        }
        catch {
            toast.error('Eliminazione non riuscita');
        }
    }
    function openFacts(place) {
        setFactsPlaceId(place.id);
        setFactsDraft(placeFactsDraftFromApi(place.facts));
    }
    async function saveFacts() {
        if (!factsPlaceId)
            return;
        try {
            const payload = placeFactsDraftToApi(factsDraft);
            if (payload.visualElements.length < 3) {
                toast.error('Servono almeno 3 elementi visivi completi');
                return;
            }
            await adminApi.upsertPlaceFacts({
                placeId: factsPlaceId,
                ...payload
            });
            toast.success('Fatti osservabili salvati');
            setFactsPlaceId('');
            await loadPlaces(selectedCityId);
        }
        catch {
            toast.error('PlaceFacts non validi o salvataggio fallito');
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-sans text-adminTitle font-semibold text-admin-text", children: "Luoghi" }), _jsxs("div", { className: "flex gap-3", children: [_jsx(Select, { value: selectedCityId, onChange: (e) => void onCityChange(e.target.value), className: "w-44", children: cities.map((c) => (_jsx("option", { value: c.id, children: c.name }, c.id))) }), _jsxs(Button, { onClick: openCreate, children: [_jsx(Plus, { size: 14, className: "mr-2" }), " Nuovo luogo"] })] })] }), showForm && (_jsxs(Card, { className: "p-6", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h3", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: editing ? `Modifica: ${editing.name}` : 'Nuovo luogo' }), _jsx("button", { type: "button", onClick: () => setShowForm(false), children: _jsx(X, { size: 16 }) })] }), _jsxs("form", { onSubmit: form.handleSubmit(onSubmit), className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx(Input, { ...form.register('name'), placeholder: "Nome luogo" }), _jsx(Input, { ...form.register('zone'), placeholder: "Zona (es. Centro storico)" })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx(Input, { ...form.register('latitude'), placeholder: "Latitudine (opzionale)", type: "number", step: "any" }), _jsx(Input, { ...form.register('longitude'), placeholder: "Longitudine (opzionale)", type: "number", step: "any" })] }), _jsx(Textarea, { ...form.register('atmosphere'), placeholder: "Atmosfera del luogo...", className: "h-24" }), _jsx(Input, { ...form.register('hint'), placeholder: "Indizio per trovarlo..." }), _jsxs("label", { className: "flex items-center gap-2 font-sans text-adminBody text-admin-text", children: [_jsx("input", { type: "checkbox", ...form.register('active') }), "Attivo"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", children: editing ? 'Salva' : 'Crea' }), _jsx(Button, { type: "button", variant: "outline", onClick: () => setShowForm(false), children: "Annulla" })] })] })] })), factsPlaceId && (_jsxs(Card, { className: "p-6", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h3", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: "Fatti osservabili" }), _jsx("button", { type: "button", onClick: () => setFactsPlaceId(''), children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { className: "mb-4 font-sans text-adminLabel text-admin-muted", children: ["Elementi visivi completi: ", countFilledVisualElements(factsDraft), " / 3 minimi"] }), _jsxs("div", { className: "space-y-3", children: [_jsx(PlaceFactsEditor, { value: factsDraft, onChange: setFactsDraft }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: () => void saveFacts(), children: "Salva facts" }), _jsx(Button, { variant: "outline", onClick: () => setFactsPlaceId(''), children: "Chiudi" })] })] })] })), places.length === 0 && !showForm ? (_jsx(EmptyState, { title: "Nessun luogo", description: "Aggiungi il primo luogo per questa citt\u00E0.", actionLabel: "Nuovo luogo", onAction: openCreate })) : (_jsx("div", { className: "space-y-3", children: places.map((place) => (_jsxs(Card, { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: place.name }), _jsx(Badge, { tone: "muted", children: place.zone }), !place.active && _jsx(Badge, { tone: "muted", children: "Inattivo" })] }), _jsx("div", { className: "mt-1 font-sans text-adminBody text-admin-muted", children: place.atmosphere }), _jsx("div", { className: "mt-1 font-sans text-adminLabel text-admin-muted italic", children: place.hint }), _jsxs("div", { className: "mt-2 font-sans text-adminLabel text-admin-muted", children: ["Facts: ", Array.isArray(place.facts?.visualElements) ? place.facts.visualElements.length : 0, " visuali"] })] }), _jsxs("div", { className: "flex shrink-0 gap-2", children: [_jsx(Button, { variant: "outline", onClick: () => openFacts(place), children: "Facts" }), _jsx(Button, { variant: "outline", onClick: () => openEdit(place), children: _jsx(Pencil, { size: 14 }) }), _jsx(Button, { variant: "danger", onClick: () => void deletePlace(place), children: _jsx(Trash2, { size: 14 }) })] })] }, place.id))) }))] }));
}
