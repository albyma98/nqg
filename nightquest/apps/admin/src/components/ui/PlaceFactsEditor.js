import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Plus, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { Input, Select, Textarea } from './Input';
function asRecord(value) {
    return value && typeof value === 'object' ? value : {};
}
export function createEmptyPlaceFactsDraft() {
    return {
        visualElements: [{ category: '', description: '', countable: false, exactCount: '' }],
        sensoryElements: [{ sense: 'sound', description: '' }],
        historicalFacts: [{ fact: '', source: '' }],
        notableDetails: [{ detail: '', verifiableByUser: true }],
        adminNotes: ''
    };
}
export function placeFactsDraftFromApi(facts) {
    const visualElements = Array.isArray(facts?.visualElements)
        ? facts.visualElements.map((item) => {
            const record = asRecord(item);
            return {
                category: String(record.category ?? ''),
                description: String(record.description ?? ''),
                countable: Boolean(record.countable ?? false),
                exactCount: record.exactCount != null ? String(record.exactCount) : ''
            };
        })
        : [];
    const sensoryElements = Array.isArray(facts?.sensoryElements)
        ? facts.sensoryElements.map((item) => {
            const record = asRecord(item);
            const sense = String(record.sense ?? 'sound');
            return {
                sense: (['sight', 'sound', 'smell', 'touch'].includes(sense) ? sense : 'sound'),
                description: String(record.description ?? '')
            };
        })
        : [];
    const historicalFacts = Array.isArray(facts?.historicalFacts)
        ? facts.historicalFacts.map((item) => {
            const record = asRecord(item);
            return {
                fact: String(record.fact ?? ''),
                source: String(record.source ?? '')
            };
        })
        : [];
    const notableDetails = Array.isArray(facts?.notableDetails)
        ? facts.notableDetails.map((item) => {
            const record = asRecord(item);
            return {
                detail: String(record.detail ?? ''),
                verifiableByUser: Boolean(record.verifiableByUser ?? true)
            };
        })
        : [];
    return {
        visualElements: visualElements.length > 0 ? visualElements : createEmptyPlaceFactsDraft().visualElements,
        sensoryElements: sensoryElements.length > 0 ? sensoryElements : createEmptyPlaceFactsDraft().sensoryElements,
        historicalFacts: historicalFacts.length > 0 ? historicalFacts : createEmptyPlaceFactsDraft().historicalFacts,
        notableDetails: notableDetails.length > 0 ? notableDetails : createEmptyPlaceFactsDraft().notableDetails,
        adminNotes: String(facts?.adminNotes ?? '')
    };
}
export function placeFactsDraftToApi(draft) {
    return {
        visualElements: draft.visualElements
            .filter((item) => item.category.trim() || item.description.trim())
            .map((item) => ({
            category: item.category.trim(),
            description: item.description.trim(),
            countable: item.countable,
            ...(item.countable && item.exactCount.trim() ? { exactCount: Number(item.exactCount) } : {})
        })),
        sensoryElements: draft.sensoryElements
            .filter((item) => item.description.trim())
            .map((item) => ({
            sense: item.sense,
            description: item.description.trim()
        })),
        historicalFacts: draft.historicalFacts
            .filter((item) => item.fact.trim())
            .map((item) => ({
            fact: item.fact.trim(),
            ...(item.source.trim() ? { source: item.source.trim() } : {})
        })),
        notableDetails: draft.notableDetails
            .filter((item) => item.detail.trim())
            .map((item) => ({
            detail: item.detail.trim(),
            verifiableByUser: item.verifiableByUser
        })),
        adminNotes: draft.adminNotes.trim()
    };
}
export function countFilledVisualElements(draft) {
    return draft.visualElements.filter((item) => item.category.trim() && item.description.trim()).length;
}
export function PlaceFactsEditor(props) {
    const { value, onChange, compact = false } = props;
    function updateSection(key, next) {
        onChange({ ...value, [key]: next });
    }
    function updateArrayItem(key, index, patch) {
        const next = value[key].map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
        updateSection(key, next);
    }
    function removeArrayItem(key, index) {
        const next = value[key].filter((_, itemIndex) => itemIndex !== index);
        updateSection(key, next.length > 0 ? next : createEmptyPlaceFactsDraft()[key]);
    }
    function addArrayItem(key) {
        const empty = createEmptyPlaceFactsDraft()[key][0];
        updateSection(key, [...value[key], empty]);
    }
    const gapClass = compact ? 'space-y-3' : 'space-y-4';
    return (_jsxs("div", { className: gapClass, children: [_jsxs(Card, { className: "p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: "Elementi visivi" }), _jsx("div", { className: "font-sans text-adminLabel text-admin-muted", children: "Cose che l'utente puo vedere davvero e, se serve, contare." })] }), _jsxs(Button, { type: "button", variant: "outline", onClick: () => addArrayItem('visualElements'), children: [_jsx(Plus, { size: 14, className: "mr-2" }), " Aggiungi"] })] }), _jsx("div", { className: "space-y-3", children: value.visualElements.map((item, index) => (_jsxs("div", { className: "rounded-sm border border-admin-border p-3", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsx(Input, { value: item.category, onChange: (event) => updateArrayItem('visualElements', index, { category: event.target.value }), placeholder: "Categoria: archi, statue, iscrizioni..." }), _jsx(Input, { value: item.description, onChange: (event) => updateArrayItem('visualElements', index, { description: event.target.value }), placeholder: "Descrizione osservabile" })] }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-3", children: [_jsxs("label", { className: "flex items-center gap-2 font-sans text-adminBody text-admin-text", children: [_jsx("input", { type: "checkbox", checked: item.countable, onChange: (event) => updateArrayItem('visualElements', index, { countable: event.target.checked, exactCount: event.target.checked ? item.exactCount : '' }) }), "E conteggiabile"] }), item.countable && (_jsx(Input, { type: "number", min: 0, value: item.exactCount, onChange: (event) => updateArrayItem('visualElements', index, { exactCount: event.target.value }), placeholder: "Conteggio esatto", className: "w-40" })), _jsxs(Button, { type: "button", variant: "ghost", onClick: () => removeArrayItem('visualElements', index), children: [_jsx(Trash2, { size: 14, className: "mr-2" }), " Rimuovi"] })] })] }, `visual-${index}`))) })] }), _jsxs(Card, { className: "p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: "Elementi sensoriali" }), _jsx("div", { className: "font-sans text-adminLabel text-admin-muted", children: "Suoni, odori, luce, tatto, atmosfera percepibile sul posto." })] }), _jsxs(Button, { type: "button", variant: "outline", onClick: () => addArrayItem('sensoryElements'), children: [_jsx(Plus, { size: 14, className: "mr-2" }), " Aggiungi"] })] }), _jsx("div", { className: "space-y-3", children: value.sensoryElements.map((item, index) => (_jsxs("div", { className: "rounded-sm border border-admin-border p-3", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-[180px_1fr]", children: [_jsxs(Select, { value: item.sense, onChange: (event) => updateArrayItem('sensoryElements', index, { sense: event.target.value }), children: [_jsx("option", { value: "sight", children: "Vista" }), _jsx("option", { value: "sound", children: "Suono" }), _jsx("option", { value: "smell", children: "Odore" }), _jsx("option", { value: "touch", children: "Tatto" })] }), _jsx(Input, { value: item.description, onChange: (event) => updateArrayItem('sensoryElements', index, { description: event.target.value }), placeholder: "Descrizione sensoriale concreta" })] }), _jsx("div", { className: "mt-3", children: _jsxs(Button, { type: "button", variant: "ghost", onClick: () => removeArrayItem('sensoryElements', index), children: [_jsx(Trash2, { size: 14, className: "mr-2" }), " Rimuovi"] }) })] }, `sensory-${index}`))) })] }), _jsxs(Card, { className: "p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: "Fatti storici" }), _jsx("div", { className: "font-sans text-adminLabel text-admin-muted", children: "Solo fatti reali e utili al contesto, non trivia gratuita." })] }), _jsxs(Button, { type: "button", variant: "outline", onClick: () => addArrayItem('historicalFacts'), children: [_jsx(Plus, { size: 14, className: "mr-2" }), " Aggiungi"] })] }), _jsx("div", { className: "space-y-3", children: value.historicalFacts.map((item, index) => (_jsxs("div", { className: "rounded-sm border border-admin-border p-3", children: [_jsxs("div", { className: "grid gap-3", children: [_jsx(Input, { value: item.fact, onChange: (event) => updateArrayItem('historicalFacts', index, { fact: event.target.value }), placeholder: "Fatto storico confermato" }), _jsx(Input, { value: item.source, onChange: (event) => updateArrayItem('historicalFacts', index, { source: event.target.value }), placeholder: "Fonte opzionale" })] }), _jsx("div", { className: "mt-3", children: _jsxs(Button, { type: "button", variant: "ghost", onClick: () => removeArrayItem('historicalFacts', index), children: [_jsx(Trash2, { size: 14, className: "mr-2" }), " Rimuovi"] }) })] }, `historical-${index}`))) })] }), _jsxs(Card, { className: "p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: "Dettagli notevoli" }), _jsx("div", { className: "font-sans text-adminLabel text-admin-muted", children: "Dettagli piccoli ma caratteristici, meglio se verificabili dal giocatore." })] }), _jsxs(Button, { type: "button", variant: "outline", onClick: () => addArrayItem('notableDetails'), children: [_jsx(Plus, { size: 14, className: "mr-2" }), " Aggiungi"] })] }), _jsx("div", { className: "space-y-3", children: value.notableDetails.map((item, index) => (_jsxs("div", { className: "rounded-sm border border-admin-border p-3", children: [_jsx(Textarea, { value: item.detail, onChange: (event) => updateArrayItem('notableDetails', index, { detail: event.target.value }), placeholder: "Dettaglio osservabile o utile alla missione", className: "h-20" }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-3", children: [_jsxs("label", { className: "flex items-center gap-2 font-sans text-adminBody text-admin-text", children: [_jsx("input", { type: "checkbox", checked: item.verifiableByUser, onChange: (event) => updateArrayItem('notableDetails', index, { verifiableByUser: event.target.checked }) }), "Verificabile dal giocatore"] }), _jsxs(Button, { type: "button", variant: "ghost", onClick: () => removeArrayItem('notableDetails', index), children: [_jsx(Trash2, { size: 14, className: "mr-2" }), " Rimuovi"] })] })] }, `detail-${index}`))) })] }), _jsxs(Card, { className: "p-4", children: [_jsx("div", { className: "mb-3 font-sans text-adminHeading font-semibold text-admin-text", children: "Note admin" }), _jsx(Textarea, { value: value.adminNotes, onChange: (event) => updateSection('adminNotes', event.target.value), placeholder: "Note pratiche per la generazione o per il sopralluogo", className: "h-24" })] })] }));
}
