const EARTH_RADIUS_METERS = 6371000;

export type TransitState = 'in_transit' | 'approaching' | 'uncertain_zone' | 'arrived' | 'deviating';

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type TransitSample = GeoPoint & {
  timestamp: number;
  accuracy: number;
};

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));

  return (Math.atan2(y, x) * 180) / Math.PI + 360 % 360;
}

export function isWithinRadius(lat1: number, lng1: number, lat2: number, lng2: number, radiusMeters: number) {
  return haversineDistance(lat1, lng1, lat2, lng2) <= radiusMeters;
}

export function getTransitState(
  session: { geoState?: string; lastKnownLatitude?: number | null; lastKnownLongitude?: number | null },
  targetPlace: { latitude: number; longitude: number; gpsRadius: number; gpsUncertaintyRadius: number; approachHintRadius: number }
): TransitState {
  if (session.lastKnownLatitude == null || session.lastKnownLongitude == null) {
    return 'in_transit';
  }

  const distance = haversineDistance(session.lastKnownLatitude, session.lastKnownLongitude, targetPlace.latitude, targetPlace.longitude);
  if (distance <= targetPlace.gpsRadius) {
    return 'arrived';
  }
  if (distance <= targetPlace.gpsUncertaintyRadius) {
    return 'uncertain_zone';
  }
  if (distance <= targetPlace.approachHintRadius) {
    return 'approaching';
  }
  if (session.geoState === 'deviating') {
    return 'deviating';
  }
  return 'in_transit';
}

export function detectDeviation(transitPath: TransitSample[], targetPlace: { latitude: number; longitude: number }, windowSize = 3) {
  if (transitPath.length < windowSize) {
    return false;
  }

  const recent = transitPath.slice(-windowSize);
  const distances = recent.map((sample) => haversineDistance(sample.lat, sample.lng, targetPlace.latitude, targetPlace.longitude));
  let increases = 0;
  for (let index = 1; index < distances.length; index += 1) {
    if (distances[index] - distances[index - 1] > 20) {
      increases += 1;
    }
  }
  return increases >= windowSize - 1;
}

export function detectIdle(transitPath: TransitSample[], thresholdSeconds = 180) {
  if (transitPath.length < 2) {
    return false;
  }

  const latest = transitPath[transitPath.length - 1];
  const thresholdTimestamp = latest.timestamp - thresholdSeconds * 1000;
  const recent = transitPath.filter((sample) => sample.timestamp >= thresholdTimestamp);
  if (recent.length < 2) {
    return false;
  }

  const anchor = recent[0];
  return recent.every((sample) => haversineDistance(anchor.lat, anchor.lng, sample.lat, sample.lng) <= 15);
}

export function humanizeDistance(meters: number) {
  const safe = clamp(meters, 0, Number.MAX_SAFE_INTEGER);
  if (safe > 800) return 'cammina ancora parecchio';
  if (safe > 500) return 'sette minuti buoni';
  if (safe > 300) return `circa ${Math.max(100, Math.round((safe / 1.3) / 100) * 100)} passi`;
  if (safe > 150) return `poco piu di ${Math.max(2, Math.round(safe / 80))} minuti`;
  if (safe > 80) return 'una piazza lontana';
  if (safe > 50) return 'un soffio';
  if (safe > 30) return 'sei vicino';
  return 'sei arrivato — guardati intorno';
}

export function humanizeTime(seconds: number) {
  if (seconds < 120) return 'da poco';
  if (seconds < 1800) return `${Math.round(seconds / 60)} minuti`;
  if (seconds < 3600) return seconds < 2400 ? 'e passata mezz ora' : 'quasi un ora';
  if (seconds < 5400) return 'un ora';
  if (seconds < 7200) return 'piu di un ora';
  return 'la notte e larga, ma non infinita';
}
