import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Button } from '../components/ui/Button';
export function PermissionFlow({ onComplete }) {
    const [step, setStep] = useState('geo');
    const [geoGranted, setGeoGranted] = useState(false);
    const [initialPosition, setInitialPosition] = useState();
    async function requestGeo() {
        if (!('geolocation' in navigator)) {
            setGeoGranted(false);
            setStep('battery');
            return;
        }
        navigator.geolocation.getCurrentPosition((position) => {
            setGeoGranted(true);
            setInitialPosition({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            });
            setStep('battery');
        }, () => {
            setGeoGranted(false);
            setStep('battery');
        }, { enableHighAccuracy: true, timeout: 10000 });
    }
    if (step === 'geo') {
        return (_jsxs("section", { className: "flex flex-1 flex-col justify-center gap-6 text-center", children: [_jsx("p", { className: "font-serif text-ombra-l italic text-ink-primary", children: "Per sentirti camminare, devo sapere dove sei. Non e sorveglianza. E presenza." }), _jsx(Button, { onClick: () => void requestGeo(), children: "Lo concedo" }), _jsx(Button, { variant: "ghost", onClick: () => {
                        setGeoGranted(false);
                        setStep('battery');
                    }, children: "Allora cammineremo diversamente" })] }));
    }
    return (_jsxs("section", { className: "flex flex-1 flex-col justify-center gap-6 text-center", children: [_jsx("p", { className: "font-serif text-ombra-l italic text-ink-primary", children: "Il tuo telefono e gia stanco. Sicuro di voler cominciare?" }), _jsxs("div", { className: "flex flex-col gap-3", children: [_jsx(Button, { onClick: () => onComplete({ geoGranted, batteryLow: false, initialPosition }), children: "Comincia lo stesso" }), _jsx(Button, { variant: "ghost", onClick: () => onComplete({ geoGranted, batteryLow: true, initialPosition }), children: "Aspetto" })] })] }));
}
