import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type SessionState } from '../api';

type GeoResponse = Awaited<ReturnType<typeof api.geoUpdate>>;
type GeoSample = { latitude: number; longitude: number; accuracy: number; timestamp: number };

function getInterval(distance: number | null, batterySaver: boolean) {
  if (batterySaver) return 30000;
  if (distance == null) return 10000;
  if (distance > 200) return 20000;
  if (distance > 100) return 10000;
  if (distance > 50) return 5000;
  return 2000;
}

export function useGeoTracker(params: {
  session: SessionState | null;
  enabled: boolean;
  batterySaver?: boolean;
  onGeoResponse: (response: GeoResponse) => void;
  onSample?: (sample: GeoSample) => void;
  shouldSendImmediately?: (sample: GeoSample) => boolean;
  onError?: (message: string) => void;
}) {
  const lastSentAt = useRef(0);
  const lastDistance = useRef<number | null>(null);
  const watchId = useRef<number | null>(null);
  const paramsRef = useRef(params);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    const sessionId = params.session?.id;

    if (!params.enabled || !sessionId) {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      paramsRef.current.onError?.('La geolocalizzazione non e disponibile su questo dispositivo.');
      return;
    }

    lastSentAt.current = 0;
    lastDistance.current = null;

    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        const latestParams = paramsRef.current;
        const sample: GeoSample = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };

        latestParams.onSample?.(sample);

        const forceSend = latestParams.shouldSendImmediately?.(sample) ?? false;
        const interval = getInterval(lastDistance.current, Boolean(latestParams.batterySaver));
        if (!forceSend && Date.now() - lastSentAt.current < interval) {
          return;
        }

        lastSentAt.current = Date.now();
        try {
          const response = await api.geoUpdate(sessionId, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading ?? undefined,
            speed: position.coords.speed ?? undefined,
            timestamp: position.timestamp
          });
          lastDistance.current = response.distanceToTarget;
          paramsRef.current.onGeoResponse(response);
        } catch {
          paramsRef.current.onError?.('La notte si interrompe. Torna quando puoi.');
        }
      },
      () => {
        paramsRef.current.onError?.('Ti sto perdendo. Cerca il cielo.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000
      }
    );

    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [params.enabled, params.session?.id, params.session?.currentMissionId]);
}

export function useCompass() {
  const [alpha, setAlpha] = useState<number | null>(null);
  const [beta, setBeta] = useState<number | null>(null);

  useEffect(() => {
    const handler = (event: DeviceOrientationEvent) => {
      if (typeof event.alpha === 'number') {
        setAlpha(event.alpha);
      }
      if (typeof event.beta === 'number') {
        setBeta(event.beta);
      }
    };

    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, []);

  return useMemo(() => ({ alpha, beta }), [alpha, beta]);
}
