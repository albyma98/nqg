import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { TypingText } from '../components/ui/TypingText';
function haversineDistance(lat1, lng1, lat2, lng2) {
    const toRadians = (value) => (value * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    if (!minutes)
        return `${remainder} secondi`;
    if (!remainder)
        return `${minutes} minuti`;
    return `${minutes} min ${remainder}s`;
}
export function WalkBlindScreen(props) {
    const [startedAt, setStartedAt] = useState(null);
    const [now, setNow] = useState(Date.now());
    const [hiddenSeconds, setHiddenSeconds] = useState(0);
    const [distanceMeters, setDistanceMeters] = useState(0);
    const [running, setRunning] = useState(false);
    const [finished, setFinished] = useState(false);
    const [resumedEarly, setResumedEarly] = useState(false);
    const hiddenStartedAt = useRef(null);
    const lastPoint = useRef(null);
    const watchId = useRef(null);
    useEffect(() => {
        if (!running || startedAt == null || finished)
            return;
        const timer = window.setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => window.clearInterval(timer);
    }, [finished, running, startedAt]);
    useEffect(() => {
        if (!running || finished || startedAt == null)
            return;
        const completeIfDue = () => {
            if (Date.now() - startedAt >= props.durationSeconds * 1000) {
                if (hiddenStartedAt.current != null) {
                    const hiddenStarted = hiddenStartedAt.current;
                    setHiddenSeconds((current) => current + Math.max(0, Math.round((Date.now() - hiddenStarted) / 1000)));
                    hiddenStartedAt.current = null;
                }
                setFinished(true);
                setRunning(false);
                if (watchId.current != null) {
                    navigator.geolocation.clearWatch(watchId.current);
                    watchId.current = null;
                }
                window.navigator.vibrate?.([80, 60, 120]);
            }
        };
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') {
                hiddenStartedAt.current = Date.now();
            }
            else {
                if (hiddenStartedAt.current != null) {
                    const delta = Math.max(0, Math.round((Date.now() - hiddenStartedAt.current) / 1000));
                    setHiddenSeconds((current) => current + delta);
                    if (Date.now() - startedAt < props.durationSeconds * 1000) {
                        setResumedEarly(true);
                    }
                    hiddenStartedAt.current = null;
                }
                completeIfDue();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [finished, props.durationSeconds, running, startedAt]);
    useEffect(() => {
        if (!running || finished || !('geolocation' in navigator))
            return;
        watchId.current = navigator.geolocation.watchPosition((position) => {
            const next = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            if (lastPoint.current) {
                const previous = lastPoint.current;
                setDistanceMeters((current) => current + haversineDistance(previous.latitude, previous.longitude, next.latitude, next.longitude));
            }
            lastPoint.current = next;
        }, () => undefined, {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 20000
        });
        return () => {
            if (watchId.current != null) {
                navigator.geolocation.clearWatch(watchId.current);
                watchId.current = null;
            }
        };
    }, [finished, running]);
    const elapsedSeconds = startedAt == null ? 0 : Math.min(props.durationSeconds, Math.max(0, Math.round((now - startedAt) / 1000)));
    const outcome = useMemo(() => {
        if (!finished)
            return 'partial';
        const distanceReached = distanceMeters >= props.requiredMinDistanceMeters;
        const hiddenEnough = hiddenSeconds >= props.durationSeconds * 0.8;
        if (distanceReached && hiddenEnough && !resumedEarly) {
            return 'success';
        }
        if (distanceMeters < props.requiredMinDistanceMeters * 0.5 && hiddenSeconds < props.durationSeconds * 0.3) {
            return 'failure';
        }
        return 'partial';
    }, [distanceMeters, finished, hiddenSeconds, props.durationSeconds, props.requiredMinDistanceMeters, resumedEarly]);
    function startChallenge() {
        setStartedAt(Date.now());
        setNow(Date.now());
        setHiddenSeconds(0);
        setDistanceMeters(0);
        setResumedEarly(false);
        setFinished(false);
        hiddenStartedAt.current = null;
        lastPoint.current = null;
        setRunning(true);
    }
    function submit() {
        props.onComplete({
            completed: true,
            elapsedSeconds: Math.max(elapsedSeconds, props.durationSeconds),
            hiddenSeconds,
            distanceMeters: Math.round(distanceMeters),
            resumedEarly,
            outcome
        });
    }
    if (running) {
        return (_jsx("section", { className: "fixed inset-0 z-20 flex min-h-[100dvh] flex-col items-center justify-center bg-night-void px-6 text-center", children: _jsxs("div", { className: "max-w-sm space-y-5", children: [_jsx("div", { className: "font-sans text-whisper uppercase text-ink-tertiary", children: "Cammina senza guardare" }), _jsx(TypingText, { text: "Metti via il telefono. Io conto il passo, non lo schermo.", speed: 40, className: "font-serif text-ombra-l italic text-ink-primary" }), _jsxs("p", { className: "font-sans text-caption text-ink-secondary", children: ["Torna tra ", formatDuration(props.durationSeconds), ". Se riapri prima, lo noto."] })] }) }));
    }
    if (finished) {
        const summary = outcome === 'success'
            ? 'Hai lasciato spazio alla notte abbastanza a lungo.'
            : outcome === 'failure'
                ? 'Ti sei ripreso troppo presto.'
                : 'Hai obbedito solo in parte.';
        return (_jsxs("section", { className: "flex flex-1 flex-col justify-center gap-8", children: [_jsxs("div", { className: "space-y-3 text-center", children: [_jsx("div", { className: "font-sans text-whisper uppercase text-ink-tertiary", children: "Ritorno" }), _jsx(TypingText, { text: summary, className: "font-serif text-ombra-l italic text-ink-primary" })] }), _jsxs("div", { className: "space-y-2 border border-night-border bg-night-surface/50 px-5 py-5 font-sans text-caption text-ink-secondary", children: [_jsxs("div", { children: ["Tempo trascorso: ", formatDuration(Math.max(elapsedSeconds, props.durationSeconds))] }), _jsxs("div", { children: ["Schermo nascosto: ", formatDuration(hiddenSeconds)] }), _jsxs("div", { children: ["Distanza registrata: ", Math.round(distanceMeters), " metri"] })] }), _jsx(Button, { onClick: submit, loading: props.loading, children: "Consegna il silenzio" })] }));
    }
    return (_jsxs("section", { className: "flex flex-1 flex-col justify-center gap-8", children: [_jsxs("div", { className: "space-y-4 text-center", children: [_jsx("div", { className: "font-sans text-whisper uppercase text-ink-tertiary", children: "Walk blind" }), _jsx(TypingText, { text: props.ombraText, className: "font-serif text-ombra-l italic text-ink-primary" }), _jsx("p", { className: "font-sans text-body text-ink-secondary", children: props.prompt })] }), _jsxs("div", { className: "space-y-2 border border-night-border bg-night-surface/50 px-5 py-5 font-sans text-caption text-ink-secondary", children: [_jsxs("div", { children: ["Durata: ", formatDuration(props.durationSeconds)] }), _jsxs("div", { children: ["Distanza minima: ", props.requiredMinDistanceMeters, " metri"] }), _jsx("div", { children: "Per riuscirci davvero, lo schermo deve sparire quasi del tutto." })] }), _jsx(Button, { onClick: startChallenge, children: "Comincio" })] }));
}
