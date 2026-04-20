import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense, lazy, useMemo } from 'react';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import { TypingText } from '../components/ui/TypingText';
function parseRecommendedPath(value) {
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
const LazyTransitMap = lazy(async () => {
    const module = await import('../components/experience/TransitMap');
    return { default: module.TransitMap };
});
const LazyLostModeMap = lazy(async () => {
    const module = await import('../components/experience/LostModeMap');
    return { default: module.LostModeMap };
});
export function OmbraLineDisplay({ text }) {
    return _jsx(TypingText, { text: text, speed: 32, className: "mx-auto max-w-sm font-serif text-ombra-m italic text-ink-primary text-center" });
}
export function DistanceLabel({ value }) {
    return _jsx("div", { className: "font-serif text-ombra-s italic text-ink-secondary", children: value });
}
export function TimerLabel({ value }) {
    return _jsx("div", { className: "font-sans text-caption lowercase tracking-[0.1em] text-ink-tertiary", children: value });
}
export function LostModeLink({ disabled, onClick }) {
    return (_jsx("button", { type: "button", onClick: onClick, disabled: disabled, className: "self-end font-sans text-whisper uppercase text-ink-whisper transition-opacity duration-300 ease-base disabled:opacity-30", children: "sono perso" }));
}
export function LostMap(props) {
    const center = props.userPosition ?? props.destination;
    if (!props.visible)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-30 flex flex-col bg-night-deep/95 p-6", children: _jsxs("div", { className: "mx-auto flex w-full max-w-shell flex-1 flex-col", children: [_jsx("div", { className: "mb-6", children: _jsx(TypingText, { text: "Ti sei smarrito. Va bene, stanotte e concesso. Ma una sola volta.", speed: 32, className: "font-serif text-ombra-s italic text-ink-primary" }) }), _jsx(Suspense, { fallback: _jsx("div", { className: "relative flex-1 overflow-hidden rounded-xs border border-night-border bg-night-surface" }), children: _jsx(LazyLostModeMap, { center: center, destination: props.destination, destinationName: props.destinationName, userPosition: props.userPosition, recommendedPath: props.recommendedPath }) }), _jsxs("div", { className: "mt-6 flex flex-col gap-3", children: [_jsx(Button, { onClick: props.onConfirmArrival, children: "Confermo di essere arrivato" }), _jsx(Button, { variant: "ghost", onClick: props.onClose, children: "Torna alla traccia" })] })] }) }));
}
export function TransitScreen(props) {
    const parsedRecommendedPath = useMemo(() => parseRecommendedPath(props.recommendedPath), [props.recommendedPath]);
    return (_jsxs("section", { className: "flex flex-1 flex-col gap-6", children: [_jsx(ProgressBar, { total: props.total, completed: props.completed }), _jsxs("div", { className: "pt-2 text-center", children: [_jsx("div", { className: "font-sans text-whisper uppercase text-ink-tertiary", children: "Diretto a" }), _jsx("div", { className: "mt-2 font-serif text-body italic text-ink-secondary", children: props.destination })] }), _jsxs("div", { className: "space-y-6", children: [_jsx(OmbraLineDisplay, { text: props.ombraLine }), _jsx(Suspense, { fallback: _jsx("div", { className: "transit-map-shell relative h-[320px] overflow-hidden rounded-xs border border-night-border bg-night-surface/70", children: _jsx("div", { className: "transit-map-vignette pointer-events-none absolute inset-0" }) }), children: _jsx(LazyTransitMap, { userLat: props.userLat, userLng: props.userLng, userAccuracy: props.userAccuracy, destinationLat: props.destinationLat, destinationLng: props.destinationLng, destinationName: props.destination, recommendedPath: parsedRecommendedPath, batterySaverMode: props.batterySaverMode, signalLost: props.signalLost }) }), _jsxs("div", { className: "space-y-2 text-center", children: [_jsx(DistanceLabel, { value: props.humanDistance }), _jsx(TimerLabel, { value: props.humanElapsed })] })] }), _jsx(LostModeLink, { disabled: props.lostModeDisabled, onClick: props.onLostMode })] }));
}
