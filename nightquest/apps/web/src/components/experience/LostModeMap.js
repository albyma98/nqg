import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
const userIcon = L.divIcon({
    className: 'nightquest-map-icon',
    html: '<div style="width:12px;height:12px;border-radius:9999px;background:#f5f5f0;box-shadow:0 0 0 8px rgba(245,245,240,0.12);"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6]
});
const destinationIcon = L.divIcon({
    className: 'nightquest-map-icon',
    html: '<div class="destination-marker">✻</div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});
export function parseRecommendedPath(value) {
    if (!value)
        return [];
    try {
        const parsed = JSON.parse(value);
        return parsed
            .map((item) => Array.isArray(item)
            ? [Number(item[0]), Number(item[1])]
            : [Number(item.lat ?? item.latitude), Number(item.lng ?? item.longitude)])
            .filter((item) => Number.isFinite(item[0]) && Number.isFinite(item[1]));
    }
    catch {
        return [];
    }
}
export function LostModeMap(props) {
    const route = props.userPosition
        ? [props.userPosition, ...parseRecommendedPath(props.recommendedPath).map(([lat, lng]) => ({ lat, lng })), props.destination]
        : [props.destination];
    return (_jsxs("div", { className: "relative flex-1 overflow-hidden rounded-xs border border-night-border bg-night-surface", children: [_jsxs(MapContainer, { center: [props.center.lat, props.center.lng], zoom: 18, className: "h-full w-full", zoomControl: false, attributionControl: false, children: [_jsx(TileLayer, { url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" }), _jsx(TileLayer, { url: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", pane: "overlayPane" }), route.length > 1 ? _jsx(Polyline, { positions: route.map((point) => [point.lat, point.lng]), pathOptions: { color: '#b8b8b0', dashArray: '4 4', weight: 3, opacity: 0.75 } }) : null, props.userPosition ? _jsx(Marker, { position: [props.userPosition.lat, props.userPosition.lng], icon: userIcon }) : null, _jsx(Marker, { position: [props.destination.lat, props.destination.lng], icon: destinationIcon })] }), _jsxs("div", { className: "pointer-events-none absolute left-4 top-4 border border-night-border bg-night-deep/85 px-3 py-2", children: [_jsx("div", { className: "font-sans text-whisper uppercase text-ink-tertiary", children: "Destinazione" }), _jsx("div", { className: "mt-1 font-serif text-body italic text-ink-secondary", children: props.destinationName })] })] }));
}
