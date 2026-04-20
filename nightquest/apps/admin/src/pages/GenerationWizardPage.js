import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Select, Textarea } from '../components/ui/Input';
import { countFilledVisualElements, createEmptyPlaceFactsDraft, PlaceFactsEditor, placeFactsDraftFromApi, placeFactsDraftToApi } from '../components/ui/PlaceFactsEditor';
export function GenerationWizardPage(props) {
    const [step, setStep] = useState(1);
    const [cities, setCities] = useState([]);
    const [places, setPlaces] = useState([]);
    const [cityId, setCityId] = useState(props.initialCityId ?? '');
    const [selectedPlaceIds, setSelectedPlaceIds] = useState([]);
    const [missionCount, setMissionCount] = useState(5);
    const [style, setStyle] = useState('misterioso');
    const [targetDurationMinutes, setTargetDurationMinutes] = useState(90);
    const [customConstraints, setCustomConstraints] = useState('');
    const [requireDifficultyProgression, setRequireDifficultyProgression] = useState(true);
    const [excludeTonesText, setExcludeTonesText] = useState('');
    const [factsDraft, setFactsDraft] = useState({});
    const [preview, setPreview] = useState(null);
    const [validationResult, setValidationResult] = useState(null);
    const [estimatedCost, setEstimatedCost] = useState(null);
    const [generationModel, setGenerationModel] = useState('gpt-4o-mini');
    const [diagnostics, setDiagnostics] = useState(null);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        async function loadCities() {
            const data = (await adminApi.cities());
            setCities(data);
            const nextCityId = props.initialCityId || data.find((city) => Number(city._count?.places ?? 0) >= 3)?.id || data[0]?.id || '';
            setCityId(nextCityId);
        }
        void loadCities();
    }, [props.initialCityId]);
    useEffect(() => {
        async function loadPlaces() {
            if (!cityId)
                return;
            const data = (await adminApi.places(cityId));
            setPlaces(data);
            const defaultPlaceIds = data.slice(0, Math.min(5, data.length)).map((place) => place.id);
            setSelectedPlaceIds((current) => (current.length > 0 && current.every((id) => data.some((place) => place.id === id)) ? current : defaultPlaceIds));
            setFactsDraft(Object.fromEntries(data.map((place) => [place.id, placeFactsDraftFromApi(place.facts)])));
        }
        void loadPlaces();
    }, [cityId]);
    const selectedPlaces = useMemo(() => selectedPlaceIds.map((placeId) => places.find((place) => place.id === placeId)).filter(Boolean), [places, selectedPlaceIds]);
    function togglePlace(placeId) {
        setSelectedPlaceIds((current) => {
            if (current.includes(placeId)) {
                return current.filter((id) => id !== placeId);
            }
            if (current.length >= 5)
                return current;
            return [...current, placeId];
        });
    }
    async function saveFactsAndContinue() {
        try {
            for (const place of selectedPlaces) {
                const draft = factsDraft[place.id] ?? createEmptyPlaceFactsDraft();
                const payload = placeFactsDraftToApi(draft);
                if (payload.visualElements.length < 3) {
                    toast.error(`PlaceFacts incompleti per ${place.name}`);
                    return;
                }
                await adminApi.upsertPlaceFacts({
                    placeId: place.id,
                    ...payload
                });
            }
            setStep(3);
        }
        catch {
            toast.error('Salvataggio PlaceFacts non riuscito');
        }
    }
    async function generatePreview(forceRefresh = false) {
        setLoading(true);
        try {
            const response = await adminApi.generationPreview({
                cityId,
                placeIds: selectedPlaceIds.slice(0, missionCount),
                missionCount,
                style,
                targetDurationMinutes,
                customConstraints,
                excludeTones: excludeTonesText.split(',').map((item) => item.trim()).filter(Boolean),
                requireDifficultyProgression,
                forceRefresh
            });
            setPreview(response.preview);
            setValidationResult(response.validationResult);
            setEstimatedCost(Number(response.estimatedCostUsd ?? 0));
            setGenerationModel(String(response.generationModel ?? 'gpt-4o-mini'));
            setDiagnostics(response.diagnostics ?? null);
            if (String(response.generationModel ?? '') !== 'gpt-4o-mini') {
                toast.error('Preview generata con fallback locale, non con OpenAI');
            }
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : 'Generazione non riuscita');
        }
        finally {
            setLoading(false);
        }
    }
    async function commitPreview() {
        if (!preview)
            return;
        try {
            await adminApi.generationCommit({
                request: {
                    cityId,
                    placeIds: selectedPlaceIds.slice(0, missionCount),
                    missionCount,
                    style,
                    targetDurationMinutes,
                    customConstraints,
                    excludeTones: excludeTonesText.split(',').map((item) => item.trim()).filter(Boolean),
                    requireDifficultyProgression
                },
                preview,
                generationModel,
                generationCost: estimatedCost
            });
            toast.success('Proposte salvate in ReviewQueue');
            props.onOpenProposals();
        }
        catch {
            toast.error('Salvataggio proposta non riuscito');
        }
    }
    return (_jsx("div", { className: "space-y-6", children: _jsxs(Card, { className: "p-6", children: [_jsxs("div", { className: "mb-4 font-sans text-adminLabel uppercase tracking-[0.2em] text-admin-muted", children: ["Step ", step, " / 3"] }), step === 1 && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx(Select, { value: cityId, onChange: (event) => setCityId(event.target.value), children: cities
                                        .filter((city) => Number(city._count?.places ?? 0) >= 3)
                                        .map((city) => (_jsx("option", { value: city.id, children: city.name }, city.id))) }), _jsx(Input, { type: "number", min: 1, max: 5, value: missionCount, onChange: (event) => setMissionCount(Math.max(1, Math.min(5, Number(event.target.value)))), placeholder: "Numero missioni" })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx(Select, { value: style, onChange: (event) => setStyle(event.target.value), children: ['misterioso', 'provocatorio', 'contemplativo', 'giocoso', 'misto'].map((value) => (_jsx("option", { value: value, children: value }, value))) }), _jsx(Select, { value: String(targetDurationMinutes), onChange: (event) => setTargetDurationMinutes(Number(event.target.value)), children: [60, 90, 120].map((value) => (_jsxs("option", { value: value, children: [value, " minuti"] }, value))) })] }), _jsx(Textarea, { value: customConstraints, onChange: (event) => setCustomConstraints(event.target.value), placeholder: "Constraint aggiuntivi...", className: "h-24" }), _jsx(Input, { value: excludeTonesText, onChange: (event) => setExcludeTonesText(event.target.value), placeholder: "Toni da escludere, separati da virgola" }), _jsxs("label", { className: "flex items-center gap-2 font-sans text-adminBody text-admin-text", children: [_jsx("input", { type: "checkbox", checked: requireDifficultyProgression, onChange: (event) => setRequireDifficultyProgression(event.target.checked) }), "Progressione difficolt\u00E0"] }), _jsxs("div", { children: [_jsx("div", { className: "mb-2 font-sans text-adminLabel text-admin-muted", children: "Seleziona i Place da usare (ordine attuale della lista)" }), _jsx("div", { className: "grid gap-2 md:grid-cols-2", children: places.map((place) => (_jsxs("label", { className: "flex items-center gap-2 rounded-sm border border-admin-border px-3 py-2 font-sans text-adminBody text-admin-text", children: [_jsx("input", { type: "checkbox", checked: selectedPlaceIds.includes(place.id), onChange: () => togglePlace(place.id) }), _jsx("span", { children: place.name })] }, place.id))) })] }), _jsx(Button, { onClick: () => setStep(2), disabled: !cityId || selectedPlaceIds.length < 3, children: "Avanti" })] })), step === 2 && (_jsxs("div", { className: "space-y-5", children: [selectedPlaces.slice(0, missionCount).map((place) => (_jsxs(Card, { className: "p-4", children: [_jsx("div", { className: "mb-3 font-sans text-adminHeading font-semibold text-admin-text", children: place.name }), _jsxs("div", { className: "mb-3 font-sans text-adminLabel text-admin-muted", children: ["Elementi visivi completi: ", countFilledVisualElements(factsDraft[place.id] ?? createEmptyPlaceFactsDraft()), " / 3 minimi"] }), _jsx("div", { className: "grid gap-3", children: _jsx(PlaceFactsEditor, { value: factsDraft[place.id] ?? createEmptyPlaceFactsDraft(), onChange: (next) => setFactsDraft((current) => ({
                                            ...current,
                                            [place.id]: next
                                        })), compact: true }) })] }, place.id))), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "outline", onClick: () => setStep(1), children: "Indietro" }), _jsx(Button, { onClick: () => void saveFactsAndContinue(), children: "Avanti" })] })] })), step === 3 && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: () => void generatePreview(false), disabled: loading, children: loading ? 'Generazione...' : 'Genera proposte' }), _jsx(Button, { variant: "outline", onClick: () => void generatePreview(true), disabled: loading, children: loading ? 'Rigenerazione...' : 'Rigenera con modifiche' }), _jsx(Button, { variant: "ghost", onClick: () => setStep(1), children: "Torna ai parametri" })] }), preview && (_jsxs("div", { className: "space-y-4", children: [_jsxs(Card, { className: "p-4", children: [_jsx("div", { className: "font-sans text-adminLabel uppercase tracking-[0.18em] text-admin-muted", children: "Arco narrativo" }), _jsx("div", { className: "mt-2 font-sans text-adminBody text-admin-text", children: String(preview.narrativeArc ?? '') }), _jsxs("div", { className: "mt-3 font-sans text-adminLabel text-admin-muted", children: ["Costo stimato: $", estimatedCost?.toFixed(3) ?? '0.000'] }), _jsxs("div", { className: "mt-1 font-sans text-adminLabel text-admin-muted", children: ["Motore usato: ", generationModel] }), diagnostics && (_jsxs("div", { className: "mt-2 space-y-1 font-sans text-adminBody text-admin-muted", children: [_jsxs("div", { children: ["Tentativi OpenAI: ", diagnostics.openAiAttempts] }), _jsxs("div", { children: ["Cache: ", diagnostics.cacheHit ? 'si' : 'no'] }), _jsxs("div", { children: ["Fallback: ", diagnostics.usedFallback ? 'si' : 'no'] }), diagnostics.fallbackReason && _jsxs("div", { children: ["Motivo fallback: ", diagnostics.fallbackReason] }), diagnostics.openAiError && _jsxs("div", { children: ["Errore OpenAI: ", diagnostics.openAiError] })] }))] }), _jsx("div", { className: "grid gap-3", children: preview.missions.map((bundle, index) => (_jsxs(Card, { className: "p-4", children: [_jsx("div", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: String(bundle.mission?.title) }), _jsxs("div", { className: "mt-1 font-sans text-adminBody text-admin-muted", children: [String(selectedPlaces.find((place) => place.id === bundle.mission?.placeId)?.name ?? bundle.mission?.placeId), " \u00B7 tono ", String(bundle.mission?.toneSlug), " \u00B7 diff ", String(bundle.mission?.difficulty)] })] }, index))) }), validationResult && (_jsxs(Card, { className: "p-4", children: [_jsxs("div", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: ["Validazione ", validationResult.valid ? 'OK' : 'con errori'] }), validationResult.errors.length > 0 && (_jsx("div", { className: "mt-2 space-y-1 font-sans text-adminBody text-admin-danger", children: validationResult.errors.map((error) => (_jsx("div", { children: error }, error))) })), validationResult.warnings.length > 0 && (_jsx("div", { className: "mt-2 space-y-1 font-sans text-adminBody text-admin-muted", children: validationResult.warnings.map((warning) => (_jsx("div", { children: warning }, warning))) }))] })), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: () => void commitPreview(), disabled: !validationResult?.valid, children: "Salva come proposta nella ReviewQueue" }), _jsx(Button, { variant: "ghost", onClick: props.onOpenProposals, children: "Vai alla ReviewQueue" })] })] }))] }))] }) }));
}
