import { useEffect } from 'react';

export function useWakeLock(active) {
    useEffect(() => {
        if (!active) return;
        const nav = navigator;
        if (!nav.wakeLock || typeof nav.wakeLock.request !== 'function') {
            return;
        }
        let sentinel = null;
        let cancelled = false;
        const acquire = async () => {
            try {
                const granted = await nav.wakeLock.request('screen');
                if (cancelled) {
                    granted.release().catch(() => undefined);
                    return;
                }
                sentinel = granted;
            }
            catch {
                sentinel = null;
            }
        };
        void acquire();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) {
                void acquire();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (sentinel) {
                sentinel.release().catch(() => undefined);
                sentinel = null;
            }
        };
    }, [active]);
}
