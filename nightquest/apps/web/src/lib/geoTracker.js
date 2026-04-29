import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import {
    ACCURACY_HARD_GATE_METERS,
    GpsKalmanFilter,
    headingFromMovement,
    isAccuracyAcceptable,
    isVelocityCoherent,
    snapToPath
} from './geoFilters';
import { enqueueGeoUpdate, flushOutbox } from './outbox';

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
    const paramsRef = useRef(params);
    const filterRef = useRef(new GpsKalmanFilter());
    const lastRawSample = useRef(null);
    const lastFilteredForHeading = useRef(null);
    const lastHeading = useRef(null);
    const errorDebounceRef = useRef(0);
    useEffect(() => {
        paramsRef.current = params;
    }, [params]);
    useEffect(() => {
        const sessionId = params.session?.id;
        if (!params.enabled || !sessionId) {
            if (watchId.current != null) {
                navigator.geolocation.clearWatch(watchId.current);
                watchId.current = null;
            }
            return;
        }
        if (!('geolocation' in navigator)) {
            paramsRef.current.onError?.('La geolocalizzazione non e disponibile su questo dispositivo.');
            return;
        }
        lastSentAt.current = 0;
        lastDistance.current = null;
        filterRef.current.reset();
        lastRawSample.current = null;
        lastFilteredForHeading.current = null;
        lastHeading.current = null;
        errorDebounceRef.current = 0;

        const sendGeoUpdate = (payload) => api.geoUpdate(sessionId, payload);

        watchId.current = navigator.geolocation.watchPosition(async (position) => {
            const latestParams = paramsRef.current;
            const raw = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
            };
            if (!isAccuracyAcceptable(raw, ACCURACY_HARD_GATE_METERS)) {
                return;
            }
            if (!isVelocityCoherent(lastRawSample.current, raw)) {
                return;
            }
            lastRawSample.current = raw;

            const filtered = filterRef.current.filter(raw);

            let smoothedLat = filtered.latitude;
            let smoothedLng = filtered.longitude;
            const path = latestParams.recommendedPath;
            if (path && path.length > 1) {
                const result = snapToPath(filtered.latitude, filtered.longitude, path);
                if (result.snapped) {
                    smoothedLat = result.lat;
                    smoothedLng = result.lng;
                }
            }

            const filteredForHeading = { latitude: smoothedLat, longitude: smoothedLng, timestamp: raw.timestamp };
            const movementHeading = headingFromMovement(lastFilteredForHeading.current, filteredForHeading);
            if (movementHeading != null) lastHeading.current = movementHeading;
            lastFilteredForHeading.current = filteredForHeading;

            const sensorHeading = position.coords.heading != null && !Number.isNaN(position.coords.heading)
                ? position.coords.heading
                : null;

            const sample = {
                latitude: smoothedLat,
                longitude: smoothedLng,
                accuracy: filtered.accuracy,
                timestamp: raw.timestamp,
                heading: sensorHeading ?? lastHeading.current ?? undefined
            };

            latestParams.onSample?.(sample);
            const forceSend = latestParams.shouldSendImmediately?.(sample) ?? false;
            const interval = getInterval(lastDistance.current, Boolean(latestParams.batterySaver));
            if (!forceSend && Date.now() - lastSentAt.current < interval) {
                return;
            }
            lastSentAt.current = Date.now();
            const payload = {
                latitude: sample.latitude,
                longitude: sample.longitude,
                accuracy: sample.accuracy,
                heading: sample.heading,
                speed: position.coords.speed ?? undefined,
                timestamp: sample.timestamp
            };
            try {
                const response = await sendGeoUpdate(payload);
                lastDistance.current = response.distanceToTarget;
                paramsRef.current.onGeoResponse(response);
                void flushOutbox(sessionId, sendGeoUpdate);
            }
            catch {
                await enqueueGeoUpdate(sessionId, payload).catch(() => undefined);
                const now = Date.now();
                if (now - errorDebounceRef.current >= 30000) {
                    errorDebounceRef.current = now;
                    paramsRef.current.onError?.('La notte si interrompe. Torna quando puoi.');
                }
            }
        }, () => {
            const now = Date.now();
            if (now - errorDebounceRef.current < 15000) return;
            errorDebounceRef.current = now;
            paramsRef.current.onError?.('Ti sto perdendo. Cerca il cielo.');
        }, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000
        });
        return () => {
            if (watchId.current != null) {
                navigator.geolocation.clearWatch(watchId.current);
                watchId.current = null;
            }
        };
    }, [params.enabled, params.session?.id, params.session?.currentMissionId]);
}

export async function requestCompassPermission() {
    if (typeof window === 'undefined') return false;
    const ctor = typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : null;
    if (!ctor) return false;
    if (typeof ctor.requestPermission !== 'function') return true;
    try {
        const result = await ctor.requestPermission();
        return result === 'granted';
    }
    catch {
        return false;
    }
}

export function compassPermissionRequiresPrompt() {
    if (typeof window === 'undefined') return false;
    const ctor = typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : null;
    return Boolean(ctor && typeof ctor.requestPermission === 'function');
}

export function useCompass(enabled = true) {
    const [alpha, setAlpha] = useState(null);
    const [beta, setBeta] = useState(null);
    useEffect(() => {
        if (!enabled) return;
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
    }, [enabled]);
    return useMemo(() => ({ alpha, beta }), [alpha, beta]);
}
