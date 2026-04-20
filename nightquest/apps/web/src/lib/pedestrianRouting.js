const routeCache = new Map();
function createCacheKey(fromLat, fromLng, toLat, toLng) {
    return [fromLat.toFixed(5), fromLng.toFixed(5), toLat.toFixed(5), toLng.toFixed(5)].join(':');
}
export async function fetchPedestrianRoute(fromLat, fromLng, toLat, toLng) {
    const cacheKey = createCacheKey(fromLat, fromLng, toLat, toLng);
    if (routeCache.has(cacheKey)) {
        return routeCache.get(cacheKey) ?? null;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`, {
            signal: controller.signal
        });
        if (!response.ok) {
            routeCache.set(cacheKey, null);
            return null;
        }
        const data = (await response.json());
        const route = data.routes?.[0];
        if (!route?.geometry?.coordinates?.length) {
            routeCache.set(cacheKey, null);
            return null;
        }
        const normalized = {
            coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
            distanceMeters: Math.round(route.distance),
            durationSeconds: Math.round(route.duration)
        };
        routeCache.set(cacheKey, normalized);
        return normalized;
    }
    catch {
        routeCache.set(cacheKey, null);
        return null;
    }
    finally {
        window.clearTimeout(timeout);
    }
}
