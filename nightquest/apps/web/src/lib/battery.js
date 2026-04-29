import { useEffect, useState } from 'react';

const INITIAL = {
    level: null,
    charging: false,
    dischargingTimeSeconds: null,
    supported: false
};

export function useBatteryStatus() {
    const [status, setStatus] = useState(INITIAL);
    useEffect(() => {
        const nav = navigator;
        if (typeof nav.getBattery !== 'function') {
            setStatus({ ...INITIAL, supported: false });
            return;
        }
        let manager = null;
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
        nav.getBattery()
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

export function shouldEnableBatterySaver(status, estimatedSessionSeconds = 45 * 60) {
    if (!status.supported || status.level == null) return null;
    if (status.charging) return false;
    if (status.level < 0.3) return true;
    if (status.dischargingTimeSeconds != null && status.dischargingTimeSeconds < estimatedSessionSeconds * 1.5) {
        return true;
    }
    return false;
}
