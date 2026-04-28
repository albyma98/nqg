import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronRight, RotateCcw, Sparkles } from 'lucide-react';
import { getTransitState, haversineDistance, humanizeDistance } from '@nightquest/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { MissionCard } from './components/experience/MissionCard';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import { TypingText } from './components/ui/TypingText';
import { useGeoTracker } from './lib/geoTracker';
import { PermissionFlow } from './screens/PermissionFlow';
import { LostMap, TransitScreen } from './screens/TransitScreen';
import { WalkBlindScreen } from './screens/WalkBlindScreen';
const STORAGE_KEY = 'nightquest.session.id';
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
function useTypingText(text) {
    const [visible, setVisible] = useState('');
    useEffect(() => {
        setVisible('');
        if (!text)
            return;
        let index = 0;
        const timer = window.setInterval(() => {
            index += 1;
            setVisible(text.slice(0, index));
            if (index >= text.length) {
                window.clearInterval(timer);
            }
        }, 28);
        return () => window.clearInterval(timer);
    }, [text]);
    return visible;
}
export default function App() {
    const [phase, setPhase] = useState('loading');
    const [cities, setCities] = useState([]);
    const [selectedCityId, setSelectedCityId] = useState('');
    const [alias, setAlias] = useState('');
    const [session, setSession] = useState(null);
    const [ombraLine, setOmbraLine] = useState('');
    const [input, setInput] = useState('');
    const [hint, setHint] = useState('');
    const [errorFlash, setErrorFlash] = useState(false);
    const [loading, setLoading] = useState(false);
    const [networkError, setNetworkError] = useState('');
    const [humanDistance, setHumanDistance] = useState('cammina ancora parecchio');
    const [humanElapsed, setHumanElapsed] = useState('siamo qui da poco');
    const [uncertainZone, setUncertainZone] = useState(false);
    const [batterySaver, setBatterySaver] = useState(false);
    const [lostMapVisible, setLostMapVisible] = useState(false);
    const [lostModeUsedForMission, setLostModeUsedForMission] = useState({});
    const typedText = useTypingText(ombraLine);
    const transitionedMissionId = useRef(null);
    function selectCity(cityId) {
        setSelectedCityId(cityId);
        window.setTimeout(() => setPhase('alias'), 0);
    }
    useGeoTracker({
        session,
        enabled: phase === 'transit' && Boolean(session?.geoPermissionGranted),
        batterySaver,
        onGeoResponse: (response) => {
            setHumanDistance(response.humanDistance);
            setHumanElapsed(response.timerSnapshot.humanElapsed);
            setUncertainZone(response.uncertainZone);
            if (response.ombraLine) {
                setOmbraLine(response.ombraLine);
            }
            setSession((current) => (current ? { ...current, geoState: response.geoState } : current));
            if (response.arrivalDetected) {
                setPhase('mission');
            }
        },
        onSample: (sample) => {
            const targetPlace = session?.currentMission?.place;
            if (targetPlace) {
                const distanceToTarget = Math.round(haversineDistance(sample.latitude, sample.longitude, targetPlace.latitude, targetPlace.longitude));
                const localGeoState = getTransitState({
                    geoState: session.geoState,
                    lastKnownLatitude: sample.latitude,
                    lastKnownLongitude: sample.longitude
                }, targetPlace);
                setHumanDistance(humanizeDistance(distanceToTarget));
                setUncertainZone(localGeoState === 'uncertain_zone');
            }
            setSession((current) => current
                ? {
                    ...current,
                    lastKnownLatitude: sample.latitude,
                    lastKnownLongitude: sample.longitude,
                    lastKnownAccuracy: sample.accuracy,
                    geoState: targetPlace
                        ? getTransitState({
                            geoState: current.geoState,
                            lastKnownLatitude: sample.latitude,
                            lastKnownLongitude: sample.longitude
                        }, targetPlace)
                        : current.geoState
                }
                : current);
        },
        shouldSendImmediately: (sample) => {
            const targetPlace = session?.currentMission?.place;
            if (!targetPlace)
                return false;
            return haversineDistance(sample.latitude, sample.longitude, targetPlace.latitude, targetPlace.longitude) <= targetPlace.gpsRadius;
        },
        onError: (message) => {
            setNetworkError(message);
            setOmbraLine(message);
        }
    });
    useEffect(() => {
        void api.getCities().then((data) => {
            setCities(data);
            setSelectedCityId(data[0]?.id ?? '');
        });
        const savedSessionId = localStorage.getItem(STORAGE_KEY);
        if (!savedSessionId) {
            setPhase('city');
            return;
        }
        void api
            .getState(savedSessionId)
            .then(({ session: state, ombraLine: resumeLine, timerSnapshot }) => {
            setSession(state);
            setAlias(state.alias);
            setOmbraLine(resumeLine);
            setHumanElapsed(timerSnapshot.humanElapsed);
            setPhase(state.finishedAt ? 'finale' : state.geoState === 'at_place' ? 'mission' : 'transit');
        })
            .catch(() => {
            localStorage.removeItem(STORAGE_KEY);
            setNetworkError('La notte si interrompe. Torna quando puoi.');
            setPhase('city');
        });
    }, []);
    const completedMissionIds = useMemo(() => parseJson(session?.completedMissionIds, []), [session]);
    const narrativeState = useMemo(() => parseJson(session?.narrativeState, {}), [session]);
    const checkpointOptions = useMemo(() => {
        const rule = parseJson(session?.currentCheckpoint?.validationRule, {});
        return rule.options ?? [];
    }, [session]);
    useEffect(() => {
        if (!session?.currentMission || !session.currentMissionId)
            return;
        if (transitionedMissionId.current === session.currentMissionId)
            return;
        transitionedMissionId.current = session.currentMissionId;
        if (phase === 'mission') {
            void api.narrator(session.id, 'mission_intro').then((response) => setOmbraLine(response.ombraLine));
        }
    }, [phase, session]);
    useEffect(() => {
        if (!lostMapVisible)
            return;
        const timer = window.setTimeout(() => setLostMapVisible(false), 30000);
        return () => window.clearTimeout(timer);
    }, [lostMapVisible]);
    async function startSession() {
        if (!selectedCityId || !alias.trim())
            return;
        setLoading(true);
        setNetworkError('');
        try {
            const created = await api.createSession({ cityId: selectedCityId, alias: alias.trim() });
            localStorage.setItem(STORAGE_KEY, created.session.id);
            setSession(created.session);
            setOmbraLine(created.ombraLine);
            setPhase('evocation');
        }
        catch {
            setNetworkError('La notte si interrompe. Torna quando puoi.');
        }
        finally {
            setLoading(false);
        }
    }
    async function submitAnswer(value) {
        if (!session?.currentCheckpoint)
            return;
        const payload = typeof value === 'undefined' ? input.trim() : value;
        if ((typeof payload === 'string' && !payload) || payload == null)
            return;
        setLoading(true);
        setNetworkError('');
        try {
            const response = await api.answer(session.id, {
                checkpointId: session.currentCheckpoint.id,
                input: payload
            });
            setSession(response.nextState);
            setOmbraLine(response.ombraLine);
            setInput('');
            setHint('');
            if (!response.valid) {
                window.navigator.vibrate?.(40);
                setErrorFlash(true);
                window.setTimeout(() => setErrorFlash(false), 600);
                return;
            }
            window.navigator.vibrate?.([80, 40, 80]);
            if (response.nextState.finishedAt) {
                setPhase('finale');
                return;
            }
            const movedToNextMission = response.nextState.currentMissionId !== session.currentMissionId;
            if (movedToNextMission) {
                setPhase('transit');
                setHumanDistance('cammina ancora parecchio');
                setLostMapVisible(false);
            }
        }
        catch {
            setNetworkError('La notte si interrompe. Torna quando puoi.');
            setOmbraLine('La notte si interrompe. Torna quando puoi.');
        }
        finally {
            setLoading(false);
        }
    }
    async function requestHint() {
        if (!session)
            return;
        setLoading(true);
        try {
            const response = await api.hint(session.id);
            setHint(response.hintText);
            setOmbraLine(response.ombraLine);
        }
        catch {
            setNetworkError('Qualcosa mi sta trattenendo. Aspetta.');
            setOmbraLine('Qualcosa mi sta trattenendo. Aspetta.');
        }
        finally {
            setLoading(false);
        }
    }
    function resetSession() {
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
    }
    async function handlePermissionComplete(result) {
        if (!session)
            return;
        setBatterySaver(result.batteryLow);
        await api.geoPermission(session.id, result.geoGranted);
        setSession({
            ...session,
            compassPermissionGranted: false,
            geoPermissionGranted: result.geoGranted,
            lastKnownLatitude: result.initialPosition?.latitude ?? session.lastKnownLatitude,
            lastKnownLongitude: result.initialPosition?.longitude ?? session.lastKnownLongitude,
            lastKnownAccuracy: result.initialPosition?.accuracy ?? session.lastKnownAccuracy
        });
        setPhase('transit');
        setOmbraLine(session.currentMission?.transit?.ambientLines.find((line) => line.trigger === 'start')?.text ?? ombraLine);
    }
    async function handleManualArrival(reason) {
        if (!session)
            return;
        const response = await api.arrive(session.id, reason);
        setHumanDistance(response.humanDistance);
        setHumanElapsed(response.timerSnapshot.humanElapsed);
        setOmbraLine(response.ombraLine ?? ombraLine);
        setPhase('mission');
        setLostMapVisible(false);
        setLostModeUsedForMission((current) => ({ ...current, [session.currentMissionId ?? 'unknown']: true }));
    }
    const currentValidationRule = useMemo(() => parseJson(session?.currentCheckpoint?.validationRule, {}), [session]);
    return (_jsxs("div", { className: "min-h-[100dvh] bg-night-deep text-ink-primary", children: [_jsx(LostMap, { visible: lostMapVisible, destinationName: session?.currentMission?.place.name ?? 'Destinazione', destination: {
                    lat: session?.currentMission?.place.latitude ?? 40.0562,
                    lng: session?.currentMission?.place.longitude ?? 17.9925
                }, userPosition: session?.lastKnownLatitude != null && session?.lastKnownLongitude != null
                    ? { lat: session.lastKnownLatitude, lng: session.lastKnownLongitude }
                    : null, recommendedPath: session?.currentMission?.transit?.recommendedPath, onClose: () => setLostMapVisible(false), onConfirmArrival: () => void handleManualArrival('lost_mode') }), _jsxs("div", { className: "safe-shell mx-auto flex min-h-[100dvh] max-w-shell flex-col px-5", children: [_jsxs("header", { className: "mb-8 flex items-center justify-between", children: [_jsx("div", { className: "font-sans text-whisper uppercase text-ink-tertiary", children: "NightQuest" }), phase !== 'city' && phase !== 'loading' ? (_jsx("button", { onClick: resetSession, className: "text-ink-tertiary transition-colors duration-300 ease-base hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-tertiary", "aria-label": "Ricomincia", children: _jsx(RotateCcw, { size: 15 }) })) : null] }), phase === 'loading' ? _jsx("div", { className: "flex flex-1 items-center justify-center font-sans text-whisper uppercase text-ink-tertiary", children: "Attesa" }) : null, phase === 'city' ? (_jsxs("section", { className: "flex flex-1 flex-col justify-center gap-8", children: [_jsxs("div", { className: "space-y-4 text-center", children: [_jsx("div", { className: "font-sans text-whisper uppercase text-ink-tertiary", children: "Citta attive" }), _jsx("h1", { className: "font-serif text-display italic text-ink-primary", children: "La notte sceglie il suo teatro." }), _jsx("p", { className: "font-sans text-body text-ink-secondary", children: "Per ora Gallipoli e l'unica soglia aperta." })] }), _jsx("div", { className: "space-y-3", children: cities.map((city) => (_jsxs("button", { type: "button", onClick: () => selectCity(city.id), className: "relative z-10 w-full cursor-pointer border border-night-border bg-night-surface/70 px-5 py-5 text-left transition-colors duration-600 ease-slow hover:border-ink-whisper hover:bg-night-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-tertiary", children: [_jsx("div", { className: "font-sans text-whisper uppercase text-ink-tertiary", children: city.slug }), _jsx("div", { className: "mt-2 font-serif text-ombra-s italic text-ink-primary", children: city.name }), _jsx("div", { className: "mt-3 font-sans text-body text-ink-secondary", children: city.openingLine })] }, city.id))) }), networkError ? _jsx("p", { className: "font-serif text-ombra-s italic text-ink-secondary", children: networkError }) : null] })) : null, phase === 'alias' ? (_jsxs("section", { className: "flex flex-1 flex-col justify-center gap-6", children: [_jsxs("div", { className: "space-y-3 text-center", children: [_jsx("div", { className: "font-sans text-whisper uppercase text-ink-tertiary", children: "Evocazione" }), _jsx("h2", { className: "font-serif text-ombra-l italic text-ink-primary", children: "Prima volta? Bene. Scrivi un nome. Inventalo." })] }), _jsx(Input, { value: alias, onChange: (event) => setAlias(event.target.value), maxLength: 24, placeholder: "Alias", className: "text-center", poeticPlaceholder: true, autoCapitalize: "off" }), _jsx(Button, { onClick: () => void startSession(), disabled: !alias.trim(), loading: loading, children: "Evoca L'Ombra" }), networkError ? _jsx("p", { className: "font-serif text-ombra-s italic text-ink-secondary", children: networkError }) : null] })) : null, phase === 'evocation' ? (_jsxs("section", { className: "flex flex-1 flex-col justify-center gap-10", children: [_jsxs("div", { className: "space-y-4 text-center", children: [_jsx("div", { className: "font-sans text-whisper uppercase text-ink-tertiary", children: "L'Ombra" }), _jsx("div", { className: "min-h-32 rounded-xs border border-night-border bg-night-surface/40 p-6 shadow-glow", children: _jsx(TypingText, { text: ombraLine, speed: 40, className: "font-serif text-display italic text-ink-primary" }) })] }), _jsx(Button, { onClick: () => setPhase('permissions'), disabled: typedText.length < ombraLine.length, variant: "ghost", icon: _jsx(ChevronRight, { size: 16 }), children: "Entra nella notte" })] })) : null, phase === 'permissions' ? _jsx(PermissionFlow, { onComplete: (result) => void handlePermissionComplete(result) }) : null, phase === 'transit' && session?.currentMission ? (_jsx(TransitScreen, { destination: session.currentMission.place.name, ombraLine: ombraLine, humanDistance: humanDistance, humanElapsed: humanElapsed, userLat: session.lastKnownLatitude ?? session.currentMission.place.latitude, userLng: session.lastKnownLongitude ?? session.currentMission.place.longitude, userAccuracy: session.lastKnownAccuracy ?? undefined, destinationLat: session.currentMission.place.latitude, destinationLng: session.currentMission.place.longitude, recommendedPath: session.currentMission.transit?.recommendedPath, batterySaverMode: batterySaver, signalLost: session.geoState === 'lost_signal', completed: completedMissionIds.length, total: 5, lostModeDisabled: Boolean(lostModeUsedForMission[session.currentMission.id]), onLostMode: () => setLostMapVisible(true) })) : null, phase === 'mission' && session?.currentMission && session.currentCheckpoint && session.currentCheckpoint.type === 'walk_blind' ? (_jsx(WalkBlindScreen, { ombraText: ombraLine, prompt: session.currentCheckpoint.prompt, durationSeconds: Number(currentValidationRule.durationSeconds ?? 180), requiredMinDistanceMeters: Number(currentValidationRule.requiredMinDistanceMeters ?? 100), loading: loading, onComplete: (payload) => void submitAnswer(payload) })) : null, phase === 'mission' && session?.currentMission && session.currentCheckpoint && session.currentCheckpoint.type !== 'walk_blind' ? (_jsx(MissionCard, { zone: session.currentMission.place.zone, place: session.currentMission.place.name, ombraText: ombraLine, prompt: completedMissionIds.length === 0
                            ? `${session.currentCheckpoint.prompt} Guarda il luogo. Rispondi sotto. Se non sai, chiedi — ma sappi che lo noterò.`
                            : session.currentCheckpoint.prompt, completed: completedMissionIds.length, total: 5, hint: hint, loading: loading, error: errorFlash, children: _jsxs("div", { className: "space-y-3", children: [session.currentCheckpoint.type === 'multiple_choice' ? (checkpointOptions.map((option) => (_jsx("button", { onClick: () => void submitAnswer(option), className: "w-full border border-night-border bg-night-surface px-4 py-[14px] text-left font-sans text-body text-ink-secondary transition-all duration-300 ease-base hover:border-ink-whisper hover:bg-night-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-tertiary active:scale-[0.99]", children: option }, option)))) : (_jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { value: input, onChange: (event) => setInput(event.target.value), onKeyDown: (event) => {
                                                if (event.key === 'Enter')
                                                    void submitAnswer();
                                            }, className: "flex-1", placeholder: "Scrivi...", autoCapitalize: "off", inputMode: "text", invalid: errorFlash, "aria-invalid": errorFlash }), _jsx(Button, { onClick: () => void submitAnswer(), className: "px-4", "aria-label": "Invia", children: _jsx(ChevronRight, { size: 18 }) })] })), _jsx(Button, { onClick: () => void requestHint(), variant: "whisper", icon: _jsx(Sparkles, { size: 12 }), className: `mx-auto ${completedMissionIds.length === 0 ? 'opacity-50' : 'opacity-30'}`, "aria-expanded": Boolean(hint), children: "Chiedi un indizio" }), uncertainZone ? (_jsx(Button, { variant: "ghost", onClick: () => void handleManualArrival('fallback_uncertain'), children: "Confermo di essere arrivato" })) : null, networkError ? (_jsxs("div", { className: "space-y-3 pt-2", children: [_jsx("p", { className: "font-serif text-ombra-s italic text-ink-secondary", children: networkError }), _jsx(Button, { variant: "ghost", onClick: () => setNetworkError(''), children: "Riprova" })] })) : null] }) })) : null, phase === 'finale' && session ? (_jsxs("section", { className: "flex flex-1 flex-col justify-center gap-8 text-center", children: [_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "font-sans text-whisper uppercase text-ink-tertiary", children: "Epilogo" }), _jsx(TypingText, { text: ombraLine, speed: 40, className: "font-serif text-ombra-l italic text-ink-primary" })] }), _jsxs("div", { className: "space-y-1 font-sans text-caption text-ink-secondary", children: [_jsxs("div", { children: [completedMissionIds.length, " missioni attraversate"] }), _jsxs("div", { children: [narrativeState.totalHints ?? 0, " indizi richiesti"] }), _jsxs("div", { children: [narrativeState.hesitations ?? 0, " esitazioni"] }), _jsx("div", { children: humanElapsed })] }), _jsx(Button, { onClick: resetSession, variant: "ghost", children: "Un'altra notte" })] })) : null] })] }));
}
