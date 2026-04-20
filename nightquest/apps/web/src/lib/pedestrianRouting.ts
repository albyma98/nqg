type PedestrianRoute = {
  coordinates: Array<[number, number]>;
  distanceMeters: number;
  durationSeconds: number;
};

const routeCache = new Map<string, PedestrianRoute | null>();

function createCacheKey(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  return [fromLat.toFixed(5), fromLng.toFixed(5), toLat.toFixed(5), toLng.toFixed(5)].join(':');
}

export async function fetchPedestrianRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<PedestrianRoute | null> {
  const cacheKey = createCacheKey(fromLat, fromLng, toLat, toLng);
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey) ?? null;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`,
      {
        signal: controller.signal
      }
    );

    if (!response.ok) {
      routeCache.set(cacheKey, null);
      return null;
    }

    const data = (await response.json()) as {
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates?: Array<[number, number]> };
      }>;
    };

    const route = data.routes?.[0];
    if (!route?.geometry?.coordinates?.length) {
      routeCache.set(cacheKey, null);
      return null;
    }

    const normalized: PedestrianRoute = {
      coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration)
    };

    routeCache.set(cacheKey, normalized);
    return normalized;
  } catch {
    routeCache.set(cacheKey, null);
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}
