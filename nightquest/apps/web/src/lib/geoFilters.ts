import { haversineDistance } from '@nightquest/shared';

export type RawSample = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export type FilteredSample = RawSample;

const METERS_PER_DEGREE_LAT = 111320;

export const ACCURACY_HARD_GATE_METERS = 80;
export const MAX_PEDESTRIAN_SPEED_MPS = 8;
export const SNAP_TO_PATH_THRESHOLD_METERS = 25;

export function isAccuracyAcceptable(sample: RawSample, gate = ACCURACY_HARD_GATE_METERS) {
  return Number.isFinite(sample.accuracy) && sample.accuracy <= gate;
}

export function isVelocityCoherent(prev: RawSample | null, curr: RawSample, maxSpeedMps = MAX_PEDESTRIAN_SPEED_MPS) {
  if (!prev) return true;
  const dtSeconds = (curr.timestamp - prev.timestamp) / 1000;
  if (dtSeconds <= 0) return true;
  const dist = haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
  return dist / dtSeconds <= maxSpeedMps;
}

export function bearingBetween(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
) {
  const phi1 = (fromLat * Math.PI) / 180;
  const phi2 = (toLat * Math.PI) / 180;
  const dLambda = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function headingFromMovement(
  prev: { latitude: number; longitude: number; timestamp: number } | null,
  curr: { latitude: number; longitude: number; timestamp: number },
  minMovementMeters = 3
): number | null {
  if (!prev) return null;
  const distance = haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
  if (distance < minMovementMeters) return null;
  return bearingBetween(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
}

export class GpsKalmanFilter {
  private lat: number | null = null;
  private lng: number | null = null;
  private varianceMeters2 = -1;
  private lastTimestamp = 0;
  private readonly processNoiseMps: number;

  constructor(processNoiseMps = 1.5) {
    this.processNoiseMps = processNoiseMps;
  }

  reset() {
    this.lat = null;
    this.lng = null;
    this.varianceMeters2 = -1;
    this.lastTimestamp = 0;
  }

  filter(sample: RawSample): FilteredSample {
    const measurementVariance = Math.max(sample.accuracy, 1) ** 2;

    if (this.varianceMeters2 < 0 || this.lat == null || this.lng == null) {
      this.lat = sample.latitude;
      this.lng = sample.longitude;
      this.varianceMeters2 = measurementVariance;
      this.lastTimestamp = sample.timestamp;
      return { ...sample };
    }

    const dt = Math.max(0, (sample.timestamp - this.lastTimestamp) / 1000);
    this.varianceMeters2 += dt * this.processNoiseMps ** 2;
    this.lastTimestamp = sample.timestamp;

    const k = this.varianceMeters2 / (this.varianceMeters2 + measurementVariance);
    this.lat = this.lat + k * (sample.latitude - this.lat);
    this.lng = this.lng + k * (sample.longitude - this.lng);
    this.varianceMeters2 = (1 - k) * this.varianceMeters2;

    return {
      latitude: this.lat,
      longitude: this.lng,
      accuracy: Math.sqrt(this.varianceMeters2),
      timestamp: sample.timestamp
    };
  }
}

type LatLng = [number, number];

function projectOntoSegment(lat: number, lng: number, a: LatLng, b: LatLng) {
  const refLat = (a[0] + b[0]) / 2;
  const cosLat = Math.cos((refLat * Math.PI) / 180);

  const bx = (b[1] - a[1]) * METERS_PER_DEGREE_LAT * cosLat;
  const by = (b[0] - a[0]) * METERS_PER_DEGREE_LAT;
  const px = (lng - a[1]) * METERS_PER_DEGREE_LAT * cosLat;
  const py = (lat - a[0]) * METERS_PER_DEGREE_LAT;

  const segLenSq = bx * bx + by * by;
  if (segLenSq < 1e-6) {
    return { lat: a[0], lng: a[1], t: 0 };
  }

  const t = Math.max(0, Math.min(1, (px * bx + py * by) / segLenSq));
  return {
    lat: a[0] + t * (b[0] - a[0]),
    lng: a[1] + t * (b[1] - a[1]),
    t
  };
}

export function snapToPath(
  lat: number,
  lng: number,
  path: LatLng[],
  thresholdMeters = SNAP_TO_PATH_THRESHOLD_METERS
) {
  if (!path || path.length < 2) {
    return { lat, lng, snapped: false, distanceFromPathMeters: Infinity };
  }

  let bestDistance = Infinity;
  let bestLat = lat;
  let bestLng = lng;

  for (let i = 0; i < path.length - 1; i += 1) {
    const projection = projectOntoSegment(lat, lng, path[i], path[i + 1]);
    const distance = haversineDistance(lat, lng, projection.lat, projection.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestLat = projection.lat;
      bestLng = projection.lng;
    }
  }

  if (bestDistance > thresholdMeters) {
    return { lat, lng, snapped: false, distanceFromPathMeters: bestDistance };
  }

  return { lat: bestLat, lng: bestLng, snapped: true, distanceFromPathMeters: bestDistance };
}

export type WarmupSample = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export type WarmupResult = {
  best: WarmupSample | null;
  granted: boolean;
};

export function acquireInitialPosition(options: {
  targetAccuracyMeters?: number;
  maxWaitMs?: number;
}): Promise<WarmupResult> {
  const targetAccuracy = options.targetAccuracyMeters ?? 25;
  const maxWait = options.maxWaitMs ?? 8000;

  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ best: null, granted: false });
      return;
    }

    let best: WarmupSample | null = null;
    let watchId: number | null = null;
    let settled = false;

    const settle = (granted: boolean) => {
      if (settled) return;
      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      window.clearTimeout(timer);
      resolve({ best, granted });
    };

    const timer = window.setTimeout(() => settle(best != null), maxWait);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const sample: WarmupSample = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };
        if (!best || sample.accuracy < best.accuracy) {
          best = sample;
        }
        if (sample.accuracy <= targetAccuracy) {
          settle(true);
        }
      },
      () => settle(false),
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWait }
    );
  });
}
