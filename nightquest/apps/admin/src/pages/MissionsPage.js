import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Circle, CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import { Plus, Trash2, X, ChevronDown, ChevronUp, Wand2 } from 'lucide-react';
import { adminApi } from '../api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Select, Textarea } from '../components/ui/Input';
async function fetchOsrmRoute(fromLat, fromLng, toLat, toLng) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`, { signal: controller.signal });
        if (!response.ok) {
            return null;
        }
        const data = (await response.json());
        const coordinates = data.routes?.[0]?.geometry?.coordinates;
        if (!coordinates?.length) {
            return null;
        }
        return coordinates.map(([lng, lat]) => [lat, lng]);
    }
    catch {
        return null;
    }
    finally {
        window.clearTimeout(timeout);
    }
}
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
export function MissionsPage() {
    const [cities, setCities] = useState([]);
    const [selectedCityId, setSelectedCityId] = useState('');
    const [missions, setMissions] = useState([]);
    const [places, setPlaces] = useState([]);
    const [tones, setTones] = useState([]);
    const [selectedMissionId, setSelectedMissionId] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [ambientLines, setAmbientLines] = useState([]);
    const [estimatedMinutes, setEstimatedMinutes] = useState(4);
    const [recommendedPathText, setRecommendedPathText] = useState('[]');
    const [recommendedPathError, setRecommendedPathError] = useState(false);
    const form = useForm({
        defaultValues: { active: true, difficulty: 1, order: 1, checkpoints: [] }
    });
    const { fields: cpFields, append: cpAppend, remove: cpRemove } = useFieldArray({
        control: form.control,
        name: 'checkpoints'
    });
    const selectedPlace = useMemo(() => places.find((place) => place.id === form.watch('placeId')) ?? null, [form, places]);
    const selectedMission = useMemo(() => missions.find((mission) => String(mission.id) === selectedMissionId) ?? null, [missions, selectedMissionId]);
    const previousMissionPlace = useMemo(() => {
        if (!selectedMission)
            return null;
        const orderedMissions = [...missions].sort((first, second) => Number(first.order) - Number(second.order));
        const selectedIndex = orderedMissions.findIndex((mission) => String(mission.id) === String(selectedMission.id));
        if (selectedIndex <= 0)
            return null;
        return orderedMissions[selectedIndex - 1]?.place ?? null;
    }, [missions, selectedMission]);
    async function loadAll(cityId) {
        const [missionsData, placesData] = await Promise.all([
            adminApi.missions(cityId),
            adminApi.places(cityId)
        ]);
        setMissions(missionsData);
        setPlaces(placesData);
        if (missionsData.length > 0) {
            setSelectedMissionId(String(missionsData[0].id));
            fillForm(missionsData[0]);
        }
        else {
            setSelectedMissionId('');
            resetTransitEditor();
        }
    }
    useEffect(() => {
        async function init() {
            const [citiesData, tonesData] = await Promise.all([
                adminApi.cities(),
                adminApi.tones()
            ]);
            setCities(citiesData);
            setTones(tonesData);
            if (citiesData.length > 0) {
                setSelectedCityId(citiesData[0].id);
                await loadAll(citiesData[0].id);
            }
        }
        void init();
    }, []);
    function resetTransitEditor() {
        setAmbientLines([]);
        setEstimatedMinutes(4);
        setRecommendedPathText('[]');
        setRecommendedPathError(false);
    }
    function fillForm(mission) {
        const rawCheckpoints = Array.isArray(mission.checkpoints) ? mission.checkpoints : [];
        const checkpoints = rawCheckpoints.map((checkpoint) => {
            const hints = parseJson(checkpoint.hints, ['', '', '']);
            return {
                order: checkpoint.order ?? 1,
                type: checkpoint.type,
                prompt: checkpoint.prompt ?? '',
                validationRule: parseJson(checkpoint.validationRule, {}),
                hint0: hints[0] ?? '',
                hint1: hints[1] ?? '',
                hint2: hints[2] ?? '',
                acceptAny: Boolean(checkpoint.acceptAny)
            };
        });
        form.reset({
            title: mission.title,
            placeId: mission.placeId,
            toneSlug: mission.toneSlug,
            difficulty: mission.difficulty,
            objective: mission.objective,
            openingBrief: mission.openingBrief,
            successNote: mission.successNote,
            order: mission.order,
            active: mission.active,
            tagsRaw: parseJson(mission.tags, []).join(', '),
            checkpoints
        });
        setEstimatedMinutes(Number(mission.transit?.estimatedMinutes ?? 4));
        setRecommendedPathText(mission.transit?.recommendedPath
            ? JSON.stringify(parseJson(mission.transit.recommendedPath, []), null, 2)
            : '[]');
        setAmbientLines(Array.isArray(mission.transit?.ambientLines)
            ? mission.transit.ambientLines.map((line) => ({
                id: String(line.id),
                trigger: line.trigger,
                text: String(line.text),
                tone: String(line.tone ?? ''),
                order: Number(line.order ?? 1),
                minSecondsFromPrevious: Number(line.minSecondsFromPrevious ?? 60)
            }))
            : []);
    }
    async function onCityChange(cityId) {
        setSelectedCityId(cityId);
        setIsCreating(false);
        await loadAll(cityId);
    }
    function selectMission(mission) {
        setSelectedMissionId(String(mission.id));
        setIsCreating(false);
        fillForm(mission);
    }
    function openCreate() {
        setIsCreating(true);
        setSelectedMissionId('');
        form.reset({
            title: '',
            placeId: places[0]?.id ?? '',
            toneSlug: tones[0]?.slug ?? '',
            difficulty: 1,
            objective: '',
            openingBrief: '',
            successNote: '',
            order: missions.length + 1,
            active: true,
            tagsRaw: '',
            checkpoints: []
        });
        resetTransitEditor();
    }
    function parseRecommendedPath() {
        try {
            const parsed = JSON.parse(recommendedPathText);
            setRecommendedPathError(false);
            return parsed;
        }
        catch {
            setRecommendedPathError(true);
            throw new Error('recommended_path_invalid');
        }
    }
    async function persistTransit(missionId) {
        const normalizedLines = ambientLines
            .map((line, index) => ({
            ...line,
            order: Number(line.order || index + 1),
            minSecondsFromPrevious: Number(line.minSecondsFromPrevious || 60)
        }))
            .filter((line) => line.text.trim().length > 0);
        const recommendedPath = parseRecommendedPath();
        const existing = (await adminApi.transit(missionId));
        const shouldKeepTransit = normalizedLines.length > 0 || Number(estimatedMinutes) > 0 || (Array.isArray(recommendedPath) && recommendedPath.length > 0);
        if (!shouldKeepTransit && existing) {
            await adminApi.deleteTransit(missionId);
            return;
        }
        if (!shouldKeepTransit)
            return;
        const transit = existing
            ? await adminApi.updateTransit(missionId, {
                estimatedMinutes: Number(estimatedMinutes),
                recommendedPath
            })
            : await adminApi.createTransit(missionId, {
                estimatedMinutes: Number(estimatedMinutes),
                recommendedPath
            });
        const currentLines = Array.isArray(existing?.ambientLines)
            ? existing.ambientLines.map((line) => String(line.id))
            : [];
        const retainedLines = normalizedLines.filter((line) => line.id).map((line) => String(line.id));
        await Promise.all(currentLines
            .filter((id) => !retainedLines.includes(id))
            .map((id) => adminApi.deleteAmbientLine(id)));
        for (const line of normalizedLines) {
            const body = {
                transitId: String(transit.id),
                trigger: line.trigger,
                text: line.text,
                tone: line.tone || null,
                order: Number(line.order),
                minSecondsFromPrevious: Number(line.minSecondsFromPrevious)
            };
            if (line.id) {
                await adminApi.updateAmbientLine(line.id, body);
            }
            else {
                await adminApi.createAmbientLine(body);
            }
        }
    }
    async function onSubmit(values) {
        const body = {
            title: values.title,
            cityId: selectedCityId,
            placeId: values.placeId,
            toneSlug: values.toneSlug,
            difficulty: Number(values.difficulty),
            objective: values.objective,
            openingBrief: values.openingBrief,
            successNote: values.successNote,
            order: Number(values.order),
            active: values.active,
            tags: values.tagsRaw.split(',').map((value) => value.trim()).filter(Boolean),
            checkpoints: values.checkpoints.map((checkpoint, index) => ({
                order: index + 1,
                type: checkpoint.type,
                prompt: checkpoint.prompt,
                validationRule: checkpoint.validationRule,
                hints: [checkpoint.hint0, checkpoint.hint1, checkpoint.hint2],
                acceptAny: checkpoint.acceptAny
            }))
        };
        try {
            const mission = isCreating
                ? await adminApi.createMission(body)
                : await adminApi.updateMission(selectedMissionId, body);
            await persistTransit(String(mission.id));
            toast.success(isCreating ? 'Missione creata' : 'Missione aggiornata');
            await loadAll(selectedCityId);
            setIsCreating(false);
            setSelectedMissionId(String(mission.id));
        }
        catch {
            toast.error('Operazione non riuscita');
        }
    }
    async function deleteMission() {
        if (!confirm('Eliminare questa missione?'))
            return;
        try {
            await adminApi.deleteMission(selectedMissionId);
            toast.success('Missione eliminata');
            await loadAll(selectedCityId);
        }
        catch {
            toast.error('Eliminazione non riuscita');
        }
    }
    async function generateAmbientLines() {
        try {
            const response = await adminApi.generateAmbientLines({ missionTitle: form.getValues('title') });
            const generated = response.items.map((item, index) => ({
                trigger: item.trigger ?? 'start',
                text: String(item.text ?? ''),
                tone: String(item.tone ?? ''),
                order: ambientLines.length + index + 1,
                minSecondsFromPrevious: Number(item.minSecondsFromPrevious ?? 60)
            }));
            setAmbientLines((current) => [...current, ...generated]);
            toast.success('Proposte aggiunte');
        }
        catch {
            toast.error('Generazione non riuscita');
        }
    }
    async function precalculateRecommendedPath() {
        if (!selectedPlace || !previousMissionPlace) {
            toast.error('Serve una missione precedente con luogo valido');
            return;
        }
        const route = await fetchOsrmRoute(Number(previousMissionPlace.latitude), Number(previousMissionPlace.longitude), Number(selectedPlace.latitude), Number(selectedPlace.longitude));
        if (!route) {
            toast.error('OSRM non ha restituito un percorso pedonale');
            return;
        }
        setRecommendedPathText(JSON.stringify(route, null, 2));
        setRecommendedPathError(false);
        toast.success('Percorso consigliato pre-calcolato');
    }
    const editorVisible = isCreating || Boolean(selectedMissionId);
    return (_jsxs("div", { className: "grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]", children: [_jsxs("div", { className: "space-y-3", children: [_jsx(Select, { value: selectedCityId, onChange: (event) => void onCityChange(event.target.value), children: cities.map((city) => (_jsx("option", { value: city.id, children: city.name }, city.id))) }), _jsxs(Button, { className: "w-full", onClick: openCreate, children: [_jsx(Plus, { size: 14, className: "mr-2" }), " Nuova missione"] }), _jsx(Card, { className: "overflow-hidden p-0", children: missions.length === 0 ? (_jsx("div", { className: "p-4 font-sans text-adminBody text-admin-muted", children: "Nessuna missione" })) : (missions.map((mission) => (_jsxs("button", { onClick: () => selectMission(mission), className: `w-full border-b border-admin-border px-4 py-3 text-left transition last:border-0 hover:bg-admin-bg ${selectedMissionId === String(mission.id) && !isCreating ? 'bg-admin-bg' : ''}`, children: [_jsx("div", { className: "font-sans text-adminBody font-medium text-admin-text", children: String(mission.title) }), _jsxs("div", { className: "mt-1 flex items-center gap-2 font-sans text-adminLabel text-admin-muted", children: [_jsxs("span", { children: ["#", mission.order] }), _jsx(Badge, { tone: mission.active ? 'success' : 'muted', children: mission.active ? 'Attiva' : 'Bozza' })] })] }, String(mission.id))))) })] }), editorVisible ? (_jsx(Card, { className: "p-6", children: _jsxs("form", { onSubmit: form.handleSubmit(onSubmit), className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "font-sans text-adminTitle font-semibold text-admin-text", children: isCreating ? 'Nuova missione' : 'Editor missione' }), !isCreating && selectedMissionId ? (_jsxs(Button, { type: "button", variant: "danger", onClick: () => void deleteMission(), children: [_jsx(Trash2, { size: 14, className: "mr-1" }), " Elimina"] })) : null] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx(Input, { ...form.register('title'), placeholder: "Titolo missione" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { ...form.register('order', { valueAsNumber: true }), placeholder: "Ordine", type: "number", className: "w-24 shrink-0" }), _jsx(Select, { ...form.register('difficulty', { valueAsNumber: true }), children: [1, 2, 3, 4, 5].map((value) => (_jsxs("option", { value: value, children: ["Difficolta ", value] }, value))) })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs(Select, { ...form.register('placeId'), children: [_jsx("option", { value: "", children: "- Luogo -" }), places.map((place) => (_jsxs("option", { value: place.id, children: [place.name, " (", place.zone, ")"] }, place.id)))] }), _jsxs(Select, { ...form.register('toneSlug'), children: [_jsx("option", { value: "", children: "- Tono -" }), tones.map((tone) => (_jsx("option", { value: tone.slug, children: tone.name }, tone.slug)))] })] }), _jsx(Input, { ...form.register('tagsRaw'), placeholder: "Tag separati da virgola" }), _jsx(Textarea, { ...form.register('objective'), placeholder: "Obiettivo...", className: "h-20" }), _jsx(Textarea, { ...form.register('openingBrief'), placeholder: "Opening brief...", className: "h-24" }), _jsx(Textarea, { ...form.register('successNote'), placeholder: "Success note...", className: "h-20" }), _jsxs("label", { className: "flex items-center gap-2 font-sans text-adminBody text-admin-text", children: [_jsx("input", { type: "checkbox", ...form.register('active') }), "Missione attiva"] }), _jsxs("div", { className: "border-t border-admin-border pt-5", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsxs("h4", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: ["Checkpoint (", cpFields.length, ")"] }), _jsxs(Button, { type: "button", variant: "outline", onClick: () => cpAppend({
                                                order: cpFields.length + 1,
                                                type: 'keyword',
                                                prompt: '',
                                                validationRule: {},
                                                hint0: '',
                                                hint1: '',
                                                hint2: '',
                                                acceptAny: false
                                            }), children: [_jsx(Plus, { size: 14, className: "mr-1" }), " Aggiungi"] })] }), _jsxs("div", { className: "space-y-3", children: [cpFields.map((field, index) => (_jsx(CheckpointEditor, { index: index, form: form, onRemove: () => cpRemove(index) }, field.id))), cpFields.length === 0 ? (_jsx("div", { className: "rounded-sm border border-admin-border p-4 font-sans text-adminBody text-admin-muted", children: "Nessun checkpoint. Aggiungine uno." })) : null] })] }), _jsxs("div", { className: "border-t border-admin-border pt-5", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: "Transit" }), _jsx("p", { className: "mt-1 font-sans text-adminLabel text-admin-muted", children: "Tragitto, waypoints e battute ambientali del passaggio." })] }), _jsxs(Button, { type: "button", variant: "outline", onClick: () => void generateAmbientLines(), children: [_jsx(Wand2, { size: 14, className: "mr-1" }), " Genera con AI"] })] }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]", children: [_jsxs("div", { className: "space-y-4", children: [_jsx(Input, { type: "number", value: estimatedMinutes, onChange: (event) => setEstimatedMinutes(Number(event.target.value)), placeholder: "Minuti stimati" }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block font-sans text-adminLabel text-admin-muted", children: "Recommended path (JSON array di coordinate)" }), _jsxs("div", { className: "mb-2 flex flex-wrap gap-2", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => void precalculateRecommendedPath(), disabled: !selectedPlace || !previousMissionPlace, children: "Pre-calcola percorso consigliato" }), _jsx(Button, { type: "button", variant: "ghost", onClick: () => {
                                                                        setRecommendedPathText('[]');
                                                                        setRecommendedPathError(false);
                                                                    }, children: "Pulisci percorso" })] }), _jsx(Textarea, { value: recommendedPathText, onChange: (event) => {
                                                                setRecommendedPathText(event.target.value);
                                                                setRecommendedPathError(false);
                                                            }, className: `h-28 font-mono text-xs ${recommendedPathError ? 'border-admin-danger' : ''}` }), recommendedPathError ? (_jsx("span", { className: "font-sans text-adminLabel text-admin-danger", children: "JSON non valido" })) : null, previousMissionPlace ? (_jsxs("div", { className: "mt-2 font-sans text-adminLabel text-admin-muted", children: ["Origine stimata: ", String(previousMissionPlace.name), " \u2192 ", selectedPlace?.name ?? 'Destinazione'] })) : (_jsx("div", { className: "mt-2 font-sans text-adminLabel text-admin-muted", children: "La prima missione non ha una tappa precedente da cui calcolare il percorso." }))] }), _jsxs("div", { className: "space-y-3", children: [ambientLines.map((line, index) => (_jsxs("div", { className: "rounded-sm border border-admin-border bg-admin-bg p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsxs("div", { className: "font-sans text-adminBody font-medium text-admin-text", children: ["Linea ambient ", index + 1] }), _jsx("button", { type: "button", className: "text-admin-danger", onClick: () => setAmbientLines((current) => current.filter((_, itemIndex) => itemIndex !== index)), children: _jsx(X, { size: 14 }) })] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-3", children: [_jsx(Select, { value: line.trigger, onChange: (event) => setAmbientLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, trigger: event.target.value } : item))), children: ['start', 'halfway', 'approaching', 'arrival', 'idle', 'deviation'].map((trigger) => (_jsx("option", { value: trigger, children: trigger }, trigger))) }), _jsx(Input, { value: line.order, type: "number", onChange: (event) => setAmbientLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, order: Number(event.target.value) } : item))), placeholder: "Ordine" }), _jsx(Input, { value: line.minSecondsFromPrevious, type: "number", onChange: (event) => setAmbientLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, minSecondsFromPrevious: Number(event.target.value) } : item)), placeholder: "Cooldown" })] }), _jsx(Input, { className: "mt-3", value: line.tone, onChange: (event) => setAmbientLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, tone: event.target.value } : item))), placeholder: "Override tono (opzionale)" }), _jsx(Textarea, { className: "mt-3 h-24", value: line.text, onChange: (event) => setAmbientLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, text: event.target.value } : item))), placeholder: "Testo ambientale..." })] }, line.id ?? `${line.trigger}-${index}`))), _jsxs(Button, { type: "button", variant: "outline", onClick: () => setAmbientLines((current) => [
                                                                ...current,
                                                                {
                                                                    trigger: 'start',
                                                                    text: '',
                                                                    tone: '',
                                                                    order: current.length + 1,
                                                                    minSecondsFromPrevious: 60
                                                                }
                                                            ]), children: [_jsx(Plus, { size: 14, className: "mr-1" }), " Aggiungi linea ambient"] })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "font-sans text-adminLabel uppercase tracking-[0.18em] text-admin-muted", children: "Mappa progetto" }), _jsx("div", { className: "h-[360px] overflow-hidden rounded-sm border border-admin-border", children: places.length > 0 ? (_jsxs(MapContainer, { center: [
                                                            selectedPlace?.latitude ?? places[0].latitude,
                                                            selectedPlace?.longitude ?? places[0].longitude
                                                        ], zoom: 17, className: "h-full w-full", zoomControl: false, attributionControl: false, children: [_jsx(TileLayer, { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" }), places.map((place) => {
                                                                const active = place.id === selectedPlace?.id;
                                                                return (_jsxs(Fragment, { children: [_jsx(CircleMarker, { center: [place.latitude, place.longitude], radius: active ? 7 : 5, pathOptions: { color: active ? '#1a1a1a' : '#6a6a60', fillColor: active ? '#1a1a1a' : '#ffffff', fillOpacity: 0.95 } }), active ? (_jsxs(_Fragment, { children: [_jsx(Circle, { center: [place.latitude, place.longitude], radius: place.gpsRadius, pathOptions: { color: '#2a7a40', weight: 1 } }), _jsx(Circle, { center: [place.latitude, place.longitude], radius: place.gpsUncertaintyRadius, pathOptions: { color: '#a82020', weight: 1, dashArray: '4 4' } })] })) : null] }, place.id));
                                                            })] })) : null }), selectedPlace ? (_jsxs("div", { className: "rounded-sm border border-admin-border bg-admin-bg p-4 font-sans text-adminBody text-admin-muted", children: [_jsx("div", { className: "font-medium text-admin-text", children: selectedPlace.name }), _jsxs("div", { className: "mt-1", children: ["Zona: ", selectedPlace.zone] }), _jsxs("div", { children: ["GPS radius: ", selectedPlace.gpsRadius, "m"] }), _jsxs("div", { children: ["Uncertainty: ", selectedPlace.gpsUncertaintyRadius, "m"] })] })) : null] })] })] }), _jsx(Button, { type: "submit", className: "w-full", children: isCreating ? 'Crea missione' : 'Salva missione' })] }) })) : (_jsx(Card, { className: "flex items-center justify-center p-12", children: _jsx("span", { className: "font-sans text-adminBody text-admin-muted", children: "Seleziona una missione o creane una nuova" }) }))] }));
}
function CheckpointEditor({ index, form, onRemove }) {
    const [open, setOpen] = useState(true);
    const typeValue = form.watch(`checkpoints.${index}.type`);
    const validationRule = form.watch(`checkpoints.${index}.validationRule`) ?? {};
    const [ruleText, setRuleText] = useState(() => JSON.stringify(validationRule, null, 2));
    const [ruleError, setRuleError] = useState(false);
    function onRuleChange(text) {
        setRuleText(text);
        try {
            form.setValue(`checkpoints.${index}.validationRule`, JSON.parse(text));
            setRuleError(false);
        }
        catch {
            setRuleError(true);
        }
    }
    return (_jsxs("div", { className: "rounded-sm border border-admin-border bg-admin-bg", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3", children: [_jsxs("button", { type: "button", className: "flex flex-1 items-center gap-2 text-left", onClick: () => setOpen((value) => !value), children: [_jsxs("span", { className: "font-sans text-adminBody font-medium text-admin-text", children: ["Checkpoint ", index + 1] }), _jsx("span", { className: "font-sans text-adminLabel text-admin-muted", children: typeValue }), open ? _jsx(ChevronUp, { size: 14, className: "ml-auto" }) : _jsx(ChevronDown, { size: 14, className: "ml-auto" })] }), _jsx("button", { type: "button", className: "ml-3 text-admin-danger", onClick: onRemove, children: _jsx(X, { size: 14 }) })] }), open ? (_jsxs("div", { className: "space-y-3 border-t border-admin-border p-4", children: [_jsxs(Select, { ...form.register(`checkpoints.${index}.type`), children: [_jsx("option", { value: "keyword", children: "Keyword" }), _jsx("option", { value: "multiple_choice", children: "Scelta multipla" }), _jsx("option", { value: "observation_confirm", children: "Conferma osservazione" }), _jsx("option", { value: "count", children: "Conteggio" }), _jsx("option", { value: "sequence", children: "Sequenza" }), _jsx("option", { value: "walk_blind", children: "Walk blind" })] }), _jsx(Textarea, { ...form.register(`checkpoints.${index}.prompt`), placeholder: "Testo del checkpoint...", className: "h-20" }), _jsxs("div", { className: "grid gap-3 md:grid-cols-3", children: [_jsx(Input, { ...form.register(`checkpoints.${index}.hint0`), placeholder: "Indizio 1" }), _jsx(Input, { ...form.register(`checkpoints.${index}.hint1`), placeholder: "Indizio 2" }), _jsx(Input, { ...form.register(`checkpoints.${index}.hint2`), placeholder: "Indizio 3" })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block font-sans text-adminLabel text-admin-muted", children: "Regola di validazione (JSON)" }), _jsx(Textarea, { value: ruleText, onChange: (event) => onRuleChange(event.target.value), className: `h-24 font-mono text-xs ${ruleError ? 'border-admin-danger' : ''}` }), ruleError ? _jsx("span", { className: "font-sans text-adminLabel text-admin-danger", children: "JSON non valido" }) : null] }), _jsxs("label", { className: "flex items-center gap-2 font-sans text-adminBody text-admin-text", children: [_jsx("input", { type: "checkbox", ...form.register(`checkpoints.${index}.acceptAny`) }), "Accetta qualsiasi risposta"] })] })) : null] }));
}
