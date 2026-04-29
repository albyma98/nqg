import { useEffect } from 'react';

type WakeLockSentinelLike = { release(): Promise<void>; released?: boolean };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
};

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock || typeof nav.wakeLock.request !== 'function') {
      return;
    }

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const granted = await nav.wakeLock!.request('screen');
        if (cancelled) {
          await granted.release().catch(() => undefined);
          return;
        }
        sentinel = granted;
      } catch {
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
