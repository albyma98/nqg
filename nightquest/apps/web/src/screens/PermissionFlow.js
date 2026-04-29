import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { acquireInitialPosition } from '../lib/geoFilters';
import { compassPermissionRequiresPrompt, requestCompassPermission } from '../lib/geoTracker';
import { isSpeechAvailable, setVoiceEnabled, speak, warmupVoices } from '../lib/speech';
import { shouldEnableBatterySaver, useBatteryStatus } from '../lib/battery';

export function PermissionFlow({ onComplete }) {
    const [step, setStep] = useState('geo');
    const [geoGranted, setGeoGranted] = useState(false);
    const [compassGranted, setCompassGranted] = useState(false);
    const [voiceEnabled, setVoiceEnabledState] = useState(false);
    const [initialPosition, setInitialPosition] = useState();
    const battery = useBatteryStatus();

    useEffect(() => {
        warmupVoices();
    }, []);

    const advanceAfterGeo = () => {
        if (compassPermissionRequiresPrompt()) {
            setStep('compass');
        } else if (isSpeechAvailable()) {
            setStep('voice');
        } else {
            finalize({});
        }
    };

    function finalize(overrides) {
        const auto = shouldEnableBatterySaver(battery);
        if (auto != null) {
            onComplete({
                geoGranted,
                compassGranted: overrides.compassGrantedOverride ?? compassGranted,
                voiceEnabled: overrides.voiceEnabledOverride ?? voiceEnabled,
                batteryLow: auto,
                initialPosition
            });
            return;
        }
        setStep('battery');
    }

    async function requestGeo() {
        if (!('geolocation' in navigator)) {
            setGeoGranted(false);
            advanceAfterGeo();
            return;
        }
        setStep('acquiring');
        const result = await acquireInitialPosition({ targetAccuracyMeters: 25, maxWaitMs: 8000 });
        if (result.best) {
            setGeoGranted(true);
            setInitialPosition({
                latitude: result.best.latitude,
                longitude: result.best.longitude,
                accuracy: result.best.accuracy
            });
        }
        else {
            setGeoGranted(false);
        }
        advanceAfterGeo();
    }

    async function requestCompass() {
        const granted = await requestCompassPermission();
        setCompassGranted(granted);
        if (isSpeechAvailable()) {
            setStep('voice');
        } else {
            finalize({ compassGrantedOverride: granted });
        }
    }

    function chooseVoice(enabled) {
        setVoiceEnabledState(enabled);
        setVoiceEnabled(enabled);
        if (enabled) {
            speak('Ti accompagno con la voce.');
        }
        finalize({ voiceEnabledOverride: enabled });
    }

    if (step === 'geo') {
        return (_jsxs("section", { className: "flex flex-1 flex-col justify-center gap-6 text-center", children: [
            _jsx("p", { className: "font-serif text-ombra-l italic text-ink-primary", children: "Per sentirti camminare, devo sapere dove sei. Non e sorveglianza. E presenza." }),
            _jsx(Button, { onClick: () => void requestGeo(), children: "Lo concedo" }),
            _jsx(Button, { variant: "ghost", onClick: () => { setGeoGranted(false); advanceAfterGeo(); }, children: "Allora cammineremo diversamente" })
        ] }));
    }
    if (step === 'acquiring') {
        return (_jsxs("section", { className: "flex flex-1 flex-col justify-center gap-6 text-center", children: [
            _jsx("p", { className: "font-serif text-ombra-l italic text-ink-primary", children: "Ti sto trovando…" }),
            _jsx("p", { className: "font-sans text-caption text-ink-tertiary", children: "Resta fermo qualche secondo, il cielo ti riconosce." })
        ] }));
    }
    if (step === 'compass') {
        return (_jsxs("section", { className: "flex flex-1 flex-col justify-center gap-6 text-center", children: [
            _jsx("p", { className: "font-serif text-ombra-l italic text-ink-primary", children: "Lasciami sentire dove guardi." }),
            _jsx("p", { className: "font-sans text-caption text-ink-tertiary", children: "La bussola mi dice da che parte ti volti." }),
            _jsx(Button, { onClick: () => void requestCompass(), children: "Lo concedo" }),
            _jsx(Button, { variant: "ghost", onClick: () => {
                setCompassGranted(false);
                if (isSpeechAvailable()) setStep('voice');
                else finalize({ compassGrantedOverride: false });
            }, children: "Cammineremo senza bussola" })
        ] }));
    }
    if (step === 'voice') {
        return (_jsxs("section", { className: "flex flex-1 flex-col justify-center gap-6 text-center", children: [
            _jsx("p", { className: "font-serif text-ombra-l italic text-ink-primary", children: "Vuoi che ti parli?" }),
            _jsx("p", { className: "font-sans text-caption text-ink-tertiary", children: "Cosi puoi camminare a testa alta. Lo schermo resta solo per le risposte." }),
            _jsx(Button, { onClick: () => chooseVoice(true), children: "Si, parlami" }),
            _jsx(Button, { variant: "ghost", onClick: () => chooseVoice(false), children: "Preferisco leggere" })
        ] }));
    }
    return (_jsxs("section", { className: "flex flex-1 flex-col justify-center gap-6 text-center", children: [
        _jsx("p", { className: "font-serif text-ombra-l italic text-ink-primary", children: "Il tuo telefono e gia stanco. Sicuro di voler cominciare?" }),
        _jsxs("div", { className: "flex flex-col gap-3", children: [
            _jsx(Button, { onClick: () => onComplete({ geoGranted, compassGranted, voiceEnabled, batteryLow: false, initialPosition }), children: "Comincia lo stesso" }),
            _jsx(Button, { variant: "ghost", onClick: () => onComplete({ geoGranted, compassGranted, voiceEnabled, batteryLow: true, initialPosition }), children: "Aspetto" })
        ] })
    ] }));
}
