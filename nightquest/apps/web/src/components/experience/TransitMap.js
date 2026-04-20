import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { fetchPedestrianRoute } from '../../lib/pedestrianRouting';
function useReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReduced(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);
    return reduced;
}
function haversineDistance(fromLat, fromLng, toLat, toLng) {
    const toRadians = (value) => (value * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRadians(toLat - fromLat);
    const dLng = toRadians(toLng - fromLng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function getZoomForDistance(distanceMeters) {
    if (distanceMeters > 500)
        return 16;
    if (distanceMeters > 200)
        return 17;
    if (distanceMeters > 100)
        return 18;
    if (distanceMeters > 30)
        return 18.5;
    return 19;
}
function getBiasedCenter(userLat, userLng, destinationLat, destinationLng) {
    return L.latLng(userLat + (destinationLat - userLat) * 0.4, userLng + (destinationLng - userLng) * 0.4);
}
function createUserIcon(reducedMotion, signalLost) {
    return L.divIcon({
        className: 'nightquest-map-icon',
        html: `
      <div class="user-location-marker ${reducedMotion ? 'reduced-motion' : ''} ${signalLost ? 'signal-lost' : ''}">
        <div class="user-location-pulse"></div>
        <div class="user-location-dot"></div>
      </div>
    `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
}
function createDestinationIcon(reducedMotion) {
    return L.divIcon({
        className: 'nightquest-map-icon',
        html: `<div class="destination-marker ${reducedMotion ? 'reduced-motion' : ''}">✻</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}
function MapDirector(props) {
    const map = useMap();
    const lastCenterRef = useRef(null);
    useEffect(() => {
        const distanceToDestination = haversineDistance(props.userLat, props.userLng, props.destinationLat, props.destinationLng);
        const nextCenter = getBiasedCenter(props.userLat, props.userLng, props.destinationLat, props.destinationLng);
        const nextZoom = getZoomForDistance(distanceToDestination);
        if (lastCenterRef.current) {
            const centerShift = lastCenterRef.current.distanceTo(nextCenter);
            const zoomChanged = Math.abs(map.getZoom() - nextZoom) > 0.01;
            if (centerShift < 5 && !zoomChanged) {
                return;
            }
        }
        lastCenterRef.current = nextCenter;
        if (props.reducedMotion || props.batterySaverMode) {
            map.setView(nextCenter, nextZoom, { animate: false });
            return;
        }
        map.flyTo(nextCenter, nextZoom, {
            animate: true,
            duration: 1.2,
            easeLinearity: 0.3
        });
    }, [
        map,
        props.batterySaverMode,
        props.destinationLat,
        props.destinationLng,
        props.reducedMotion,
        props.userLat,
        props.userLng
    ]);
    return null;
}
export function TransitMap(props) {
    const reducedMotion = useReducedMotion();
    const [routeType, setRouteType] = useState('direct');
    const [route, setRoute] = useState([
        [props.userLat, props.userLng],
        [props.destinationLat, props.destinationLng]
    ]);
    const [routeReady, setRouteReady] = useState(false);
    const distanceToDestination = useMemo(() => haversineDistance(props.userLat, props.userLng, props.destinationLat, props.destinationLng), [props.destinationLat, props.destinationLng, props.userLat, props.userLng]);
    const initialCenter = useMemo(() => getBiasedCenter(props.userLat, props.userLng, props.destinationLat, props.destinationLng), [props.destinationLat, props.destinationLng, props.userLat, props.userLng]);
    const zoom = useMemo(() => getZoomForDistance(distanceToDestination), [distanceToDestination]);
    const userIcon = useMemo(() => createUserIcon(reducedMotion || Boolean(props.batterySaverMode), Boolean(props.signalLost)), [props.batterySaverMode, props.signalLost, reducedMotion]);
    const destinationIcon = useMemo(() => createDestinationIcon(reducedMotion || Boolean(props.batterySaverMode)), [props.batterySaverMode, reducedMotion]);
    useEffect(() => {
        let cancelled = false;
        setRouteReady(false);
        const fallbackRoute = [
            [props.userLat, props.userLng],
            [props.destinationLat, props.destinationLng]
        ];
        async function resolveRoute() {
            if (props.recommendedPath && props.recommendedPath.length > 0) {
                setRouteType('recommended');
                setRoute(props.recommendedPath);
                setRouteReady(true);
                return;
            }
            const fetched = await fetchPedestrianRoute(props.userLat, props.userLng, props.destinationLat, props.destinationLng);
            if (cancelled)
                return;
            if (fetched?.coordinates?.length) {
                setRouteType('osrm');
                setRoute(fetched.coordinates);
            }
            else {
                setRouteType('direct');
                setRoute(fallbackRoute);
            }
            setRouteReady(true);
        }
        void resolveRoute();
        return () => {
            cancelled = true;
        };
    }, [props.destinationLat, props.destinationLng, props.recommendedPath]);
    const displayedRoute = routeType === 'direct'
        ? [
            [props.userLat, props.userLng],
            [props.destinationLat, props.destinationLng]
        ]
        : route;
    return (_jsx("div", { role: "img", "aria-label": `Mappa con la tua posizione e la direzione verso ${props.destinationName}.`, className: `transit-map-shell relative overflow-hidden rounded-xs border border-night-border bg-night-surface/70 ${routeReady ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'} transition-all duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)]`, children: _jsxs("div", { className: `transit-map-container relative h-[320px] w-full ${props.signalLost ? 'signal-lost' : ''}`, children: [_jsxs(MapContainer, { center: initialCenter, zoom: zoom, zoomSnap: 0, className: "h-full w-full", zoomControl: false, attributionControl: false, dragging: false, doubleClickZoom: false, scrollWheelZoom: false, touchZoom: false, boxZoom: false, keyboard: false, children: [_jsx(TileLayer, { url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", keepBuffer: props.batterySaverMode ? 1 : 3, updateWhenIdle: true }), !props.batterySaverMode ? (_jsx(TileLayer, { url: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", pane: "overlayPane", keepBuffer: 2, updateWhenIdle: true })) : null, _jsx(MapDirector, { userLat: props.userLat, userLng: props.userLng, destinationLat: props.destinationLat, destinationLng: props.destinationLng, batterySaverMode: Boolean(props.batterySaverMode), reducedMotion: reducedMotion }), _jsx(Polyline, { positions: displayedRoute, className: props.batterySaverMode || reducedMotion ? 'transit-route-path reduced-motion' : 'transit-route-path', pathOptions: {
                                color: '#b8b8b0',
                                weight: 2,
                                opacity: 0.7,
                                dashArray: '6 8'
                            } }), props.userAccuracy && props.userAccuracy > 30 ? (_jsx(Circle, { center: [props.userLat, props.userLng], radius: props.userAccuracy, pathOptions: {
                                stroke: false,
                                fillColor: 'rgba(245,245,240,0.04)',
                                fillOpacity: 1
                            } })) : null, _jsx(Marker, { position: [props.userLat, props.userLng], icon: userIcon }), _jsx(Marker, { position: [props.destinationLat, props.destinationLng], icon: destinationIcon, children: _jsx(Tooltip, { permanent: true, direction: "bottom", offset: [0, 12], className: "transit-destination-tooltip", children: props.destinationName }) })] }), _jsx("div", { className: "transit-map-vignette pointer-events-none absolute inset-0" }), _jsx("div", { className: "transit-map-attribution pointer-events-none absolute bottom-2 right-3", children: "CARTO \u00B7 OSM" }), props.signalLost ? _jsx("div", { className: "transit-map-signal-overlay pointer-events-none absolute inset-0" }) : null] }) }));
}
