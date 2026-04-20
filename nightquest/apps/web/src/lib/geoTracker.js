import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
function getInterval(distance, batterySaver) {
    if (batterySaver)
        return 30000;
    if (distance == null)
        return 10000;
    if (distance > 200)
        return 20000;
    if (distance > 100)
        return 10000;
    if (distance > 50)
        return 5000;
    return 2000;
}
export function useGeoTracker(params) {
    const lastSentAt = useRef(0);
    const lastDistance = useRef(null);
    const watchId = useRef(null);
    useEffect(() => {
        if (!params.enabled || !params.session) {
            if (watchId.current != null) {
                navigator.geolocation.clearWatch(watchId.current);
                watchId.current = null;
            }
            return;
        }
        if (!('geolocation' in navigator)) {
            params.onError?.('La geolocalizzazione non è disponibile su questo dispositivo.');
            return;
        }
        watchId.current = navigator.geolocation.watchPosition(async (position) => {
            params.onSample?.({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
            });
            const interval = getInterval(lastDistance.current, Boolean(params.batterySaver));
            if (Date.now() - lastSentAt.current < interval) {
                return;
            }
            lastSentAt.current = Date.now();
            try {
                const response = await api.geoUpdate(params.session.id, {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    heading: position.coords.heading ?? undefined,
                    speed: position.coords.speed ?? undefined,
                    timestamp: position.timestamp
                });
                lastDistance.current = response.distanceToTarget;
                params.onGeoResponse(response);
            }
            catch {
                params.onError?.('La notte si interrompe. Torna quando puoi.');
            }
        }, () => {
            params.onError?.('Ti sto perdendo. Cerca il cielo.');
        }, {
            enableHighAccuracy: true,
            maximumAge: 2000,
            timeout: 15000
        });
        return () => {
            if (watchId.current != null) {
                navigator.geolocation.clearWatch(watchId.current);
                watchId.current = null;
            }
        };
    }, [params]);
}
export function useCompass() {
    const [alpha, setAlpha] = useState(null);
    const [beta, setBeta] = useState(null);
    useEffect(() => {
        const handler = (event) => {
            if (typeof event.alpha === 'number') {
                setAlpha(event.alpha);
            }
            if (typeof event.beta === 'number') {
                setBeta(event.beta);
            }
        };
        window.addEventListener('deviceorientation', handler);
        return () => window.removeEventListener('deviceorientation', handler);
    }, []);
    return useMemo(() => ({ alpha, beta }), [alpha, beta]);
}
