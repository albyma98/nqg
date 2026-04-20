import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer } from 'react-leaflet';
import { adminApi } from '../api';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
function safeParseJson(raw) {
    if (typeof raw !== 'string')
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function parseTransitPath(value) {
    if (typeof value !== 'string')
        return [];
    try {
        const parsed = JSON.parse(value);
        return parsed.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    }
    catch {
        return [];
    }
}
function distanceBetween(first, second) {
    const toRadians = (value) => (value * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRadians(second.lat - first.lat);
    const dLng = toRadians(second.lng - first.lng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(first.lat)) * Math.cos(toRadians(second.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function eventTone(type) {
    if (type === 'answer_valid' || type === 'arrival')
        return 'success';
    if (type === 'answer_invalid' || type === 'deviation_detected' || type === 'signal_lost')
        return 'danger';
    return 'muted';
}
export function SessionsPage() {
    const [sessions, setSessions] = useState([]);
    const [selected, setSelected] = useState(null);
    const [detail, setDetail] = useState(null);
    const [filter, setFilter] = useState('all');
    useEffect(() => {
        void adminApi.sessions().then((data) => setSessions(data));
    }, []);
    async function openDetail(session) {
        setSelected(session);
        const data = await adminApi.sessionDetail(String(session.id));
        setDetail(data);
    }
    const filtered = sessions.filter((session) => {
        if (filter === 'active')
            return !session.finishedAt;
        if (filter === 'finished')
            return Boolean(session.finishedAt);
        return true;
    });
    const path = useMemo(() => parseTransitPath(detail?.transitPath), [detail?.transitPath]);
    const eventMarkers = useMemo(() => (Array.isArray(detail?.events) ? detail.events : [])
        .map((event) => {
        const payload = safeParseJson(event.payload);
        const lat = Number(payload?.latitude ?? payload?.lat);
        const lng = Number(payload?.longitude ?? payload?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng))
            return null;
        return {
            id: event.id,
            type: event.type,
            timestamp: event.timestamp,
            lat,
            lng
        };
    })
        .filter(Boolean), [detail?.events]);
    const placeMarkers = useMemo(() => Array.isArray(detail?.city?.missions)
        ? detail.city.missions.map((mission) => ({
            id: String(mission.id),
            title: String(mission.title),
            lat: Number(mission.place?.latitude),
            lng: Number(mission.place?.longitude)
        }))
        : [], [detail?.city?.missions]);
    const totalDistance = useMemo(() => {
        return path.slice(1).reduce((sum, point, index) => sum + distanceBetween(path[index], point), 0);
    }, [path]);
    const elapsedSeconds = Number(detail?.elapsedSeconds ?? 0);
    const movingSeconds = Math.max(0, path.length - 1) * 10;
    const fallbackCount = (Array.isArray(detail?.events) ? detail.events : []).filter((event) => event.type === 'fallback_used').length;
    return (_jsxs("div", { className: "grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]", children: [_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "flex gap-2", children: ['all', 'active', 'finished'].map((value) => (_jsx("button", { onClick: () => setFilter(value), className: `rounded-sm px-3 py-1.5 font-sans text-adminLabel transition ${filter === value ? 'bg-admin-text text-white' : 'border border-admin-border text-admin-muted hover:bg-admin-bg'}`, children: value === 'all' ? 'Tutte' : value === 'active' ? 'Attive' : 'Concluse' }, value))) }), _jsx(Card, { className: "max-h-[70vh] overflow-hidden overflow-y-auto p-0", children: filtered.length === 0 ? (_jsx("div", { className: "p-4 font-sans text-adminBody text-admin-muted", children: "Nessuna sessione." })) : (filtered.map((session) => (_jsxs("button", { onClick: () => void openDetail(session), className: `w-full border-b border-admin-border px-4 py-3 text-left transition last:border-0 hover:bg-admin-bg ${selected?.id === session.id ? 'bg-admin-bg' : ''}`, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-sans text-adminBody font-medium text-admin-text", children: String(session.alias) }), _jsx(Badge, { tone: session.finishedAt ? 'muted' : 'success', children: session.finishedAt ? 'Conclusa' : 'Attiva' })] }), _jsxs("div", { className: "mt-1 font-sans text-adminLabel text-admin-muted", children: [String(session.city?.name ?? '-'), " \u00B7 ", new Date(String(session.startedAt)).toLocaleString('it-IT')] })] }, String(session.id))))) })] }), detail ? (_jsxs("div", { className: "space-y-4", children: [_jsx(Card, { className: "p-6", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-sans text-adminTitle font-semibold text-admin-text", children: String(detail.alias) }), _jsxs("div", { className: "mt-1 font-sans text-adminBody text-admin-muted", children: [String(detail.city?.name ?? '-'), " \u00B7 iniziata ", new Date(String(detail.startedAt)).toLocaleString('it-IT')] }), detail.finishedAt ? (_jsxs("div", { className: "mt-1 font-sans text-adminLabel text-admin-muted", children: ["conclusa ", new Date(String(detail.finishedAt)).toLocaleString('it-IT')] })) : null] }), _jsx(Badge, { tone: detail.finishedAt ? 'muted' : 'success', children: detail.finishedAt ? 'Conclusa' : 'Attiva' })] }) }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]", children: [_jsx(Card, { className: "p-0", children: _jsx("div", { className: "h-[420px] overflow-hidden rounded-md", children: path.length > 0 || placeMarkers.length > 0 ? (_jsxs(MapContainer, { center: [
                                            path[0]?.lat ?? placeMarkers[0]?.lat ?? 40.0562,
                                            path[0]?.lng ?? placeMarkers[0]?.lng ?? 17.9925
                                        ], zoom: 16, className: "h-full w-full", zoomControl: false, attributionControl: false, children: [_jsx(TileLayer, { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" }), path.length > 1 ? (_jsx(Polyline, { positions: path.map((point) => [point.lat, point.lng]), pathOptions: { color: '#1a1a1a', weight: 3, opacity: 0.85 } })) : null, placeMarkers.map((place) => (_jsx(CircleMarker, { center: [place.lat, place.lng], radius: 6, pathOptions: { color: '#8a6a20', fillColor: '#8a6a20', fillOpacity: 0.9 } }, place.id))), eventMarkers.map((event) => (_jsx(CircleMarker, { center: [event.lat, event.lng], radius: 5, pathOptions: {
                                                    color: event.type === 'deviation_detected' ? '#a82020' : '#1a1a1a',
                                                    fillColor: event.type === 'arrival' ? '#2a7a40' : '#ffffff',
                                                    fillOpacity: 0.95
                                                } }, event.id)))] })) : (_jsx("div", { className: "flex h-full items-center justify-center font-sans text-adminBody text-admin-muted", children: "Nessun dato GPS disponibile" })) }) }), _jsxs("div", { className: "space-y-4", children: [_jsxs(Card, { className: "p-4", children: [_jsx("div", { className: "font-sans text-adminLabel uppercase tracking-[0.18em] text-admin-muted", children: "Metriche" }), _jsxs("div", { className: "mt-3 space-y-2 font-sans text-adminBody text-admin-text", children: [_jsxs("div", { children: ["Distanza totale: ", (totalDistance / 1000).toFixed(2), " km"] }), _jsxs("div", { children: ["Tempo totale: ", Math.round(elapsedSeconds / 60), " min"] }), _jsxs("div", { children: ["Tempo in movimento stimato: ", Math.round(movingSeconds / 60), " min"] }), _jsxs("div", { children: ["Tempo fermo stimato: ", Math.max(0, Math.round((elapsedSeconds - movingSeconds) / 60)), " min"] }), _jsxs("div", { children: ["Fallback manuali: ", fallbackCount] })] })] }), _jsxs(Card, { className: "p-4", children: [_jsx("div", { className: "font-sans text-adminLabel uppercase tracking-[0.18em] text-admin-muted", children: "Eventi geospaziali" }), _jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: ['arrival', 'deviation_detected', 'idle_detected', 'fallback_used'].map((type) => (_jsxs(Badge, { tone: type === 'arrival' ? 'success' : type === 'fallback_used' ? 'muted' : 'danger', children: [type, ": ", (Array.isArray(detail.events) ? detail.events : []).filter((event) => event.type === type).length] }, type))) })] })] })] }), _jsxs(Card, { className: "p-6", children: [_jsxs("h3", { className: "mb-4 font-sans text-adminHeading font-semibold text-admin-text", children: ["Timeline eventi (", Array.isArray(detail.events) ? detail.events.length : 0, ")"] }), Array.isArray(detail.events) && detail.events.length > 0 ? (_jsx("div", { className: "space-y-4", children: detail.events.map((event) => {
                                    const parsed = safeParseJson(event.payload);
                                    return (_jsxs("div", { className: "flex gap-4", children: [_jsx("div", { className: "w-24 shrink-0 pt-0.5 font-sans text-adminLabel text-admin-muted", children: new Date(event.timestamp).toLocaleTimeString('it-IT') }), _jsxs("div", { className: "min-w-0", children: [_jsx(Badge, { tone: eventTone(event.type), children: event.type }), parsed && Object.keys(parsed).length > 0 ? (_jsx("pre", { className: "mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-admin-muted", children: JSON.stringify(parsed, null, 2) })) : null] })] }, event.id));
                                }) })) : (_jsx("div", { className: "font-sans text-adminBody text-admin-muted", children: "Nessun evento registrato." }))] })] })) : (_jsx(Card, { className: "flex items-center justify-center p-12", children: _jsx("span", { className: "font-sans text-adminBody text-admin-muted", children: "Seleziona una sessione per vederne il dettaglio" }) }))] }));
}
