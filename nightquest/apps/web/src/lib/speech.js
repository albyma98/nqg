const STORAGE_KEY = 'nightquest.voice.enabled';

export function isSpeechAvailable() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function isVoiceEnabled() {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_KEY) === '1';
}

export function setVoiceEnabled(enabled) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    if (!enabled) cancelSpeech();
}

let cachedVoice = null;

function pickVoice(lang = 'it-IT') {
    if (!isSpeechAvailable()) return null;
    if (cachedVoice) return cachedVoice;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const exact = voices.find((voice) => voice.lang === lang);
    if (exact) {
        cachedVoice = exact;
        return exact;
    }
    const prefix = voices.find((voice) => voice.lang.startsWith(lang.split('-')[0]));
    if (prefix) {
        cachedVoice = prefix;
        return prefix;
    }
    cachedVoice = voices[0];
    return cachedVoice;
}

export function warmupVoices() {
    if (!isSpeechAvailable()) return;
    window.speechSynthesis.getVoices();
    if ('onvoiceschanged' in window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => {
            cachedVoice = null;
            pickVoice();
        };
    }
}

export function speak(text, options = {}) {
    if (!isSpeechAvailable() || !text) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang ?? 'it-IT';
    utterance.rate = options.rate ?? 0.92;
    utterance.pitch = options.pitch ?? 0.95;
    utterance.volume = options.volume ?? 1;
    const voice = pickVoice(utterance.lang);
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
}

export function cancelSpeech() {
    if (!isSpeechAvailable()) return;
    window.speechSynthesis.cancel();
}
