import { useEffect, useState } from 'react';

export type BatteryStatus = {
  level: number | null;
  charging: boolean;
  dischargingTimeSeconds: number | null;
  supported: boolean;
};

type BatteryManagerLike = {
  level: number;
  charging: boolean;
  dischargingTime: number;
  addEventListener(event: string, handler: () => void): void;
  removeEventListener(event: string, handler: () => void): void;
};

type BatteryNavigator = Navigator & {
  getBattery?: () => Promise<BatteryManagerLike>;
};

const INITIAL: BatteryStatus = {
  level: null,
  charging: false,
  dischargingTimeSeconds: null,
  supported: false
};

export function useBatteryStatus(): BatteryStatus {
  const [status, setStatus] = useState<BatteryStatus>(INITIAL);

  useEffect(() => {
    const nav = navigator as BatteryNavigator;
    if (typeof nav.getBattery !== 'function') {
      setStatus({ ...INITIAL, supported: false });
      return;
    }

    let manager: BatteryManagerLike | null = null;
    let cancelled = false;

    const sync = () => {
      if (!manager || cancelled) return;
      setStatus({
        level: manager.level,
        charging: manager.charging,
        dischargingTimeSeconds: Number.isFinite(manager.dischargingTime) ? manager.dischargingTime : null,
        supported: true
      });
    };

    nav.getBattery!()
      .then((battery) => {
        if (cancelled) return;
        manager = battery;
        sync();
        battery.addEventListener('levelchange', sync);
        battery.addEventListener('chargingchange', sync);
        battery.addEventListener('dischargingtimechange', sync);
      })
      .catch(() => {
        setStatus({ ...INITIAL, supported: false });
      });

    return () => {
      cancelled = true;
      if (manager) {
        manager.removeEventListener('levelchange', sync);
        manager.removeEventListener('chargingchange', sync);
        manager.removeEventListener('dischargingtimechange', sync);
      }
    };
  }, []);

  return status;
}

export function shouldEnableBatterySaver(status: BatteryStatus, estimatedSessionSeconds = 45 * 60) {
  if (!status.supported || status.level == null) return null;
  if (status.charging) return false;
  if (status.level < 0.3) return true;
  if (status.dischargingTimeSeconds != null && status.dischargingTimeSeconds < estimatedSessionSeconds * 1.5) {
    return true;
  }
  return false;
}
