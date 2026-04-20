const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  getCities: () => request<Array<{ id: string; name: string; slug: string; openingLine: string }>>('/api/cities'),
  createSession: (body: { cityId: string; alias: string }) =>
    request<{ session: SessionState; ombraLine: string }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  getSession: (id: string) => request<SessionState>(`/api/sessions/${id}`),
  getState: (id: string) =>
    request<{ session: SessionState; ombraLine: string; timerSnapshot: { elapsedSeconds: number; humanElapsed: string } }>(`/api/sessions/${id}/state`),
  answer: (id: string, body: { checkpointId: string; input: string | number | boolean | Record<string, unknown> }) =>
    request<{ valid: boolean; ombraLine: string; nextState: SessionState }>(`/api/sessions/${id}/answer`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  hint: (id: string) =>
    request<{ hintText: string; level: number; ombraLine: string }>(`/api/sessions/${id}/hint`, {
      method: 'POST',
      body: JSON.stringify({})
    }),
  narrator: (id: string, eventType: string) =>
    request<{ ombraLine: string }>(`/api/sessions/${id}/narrator`, {
      method: 'POST',
      body: JSON.stringify({ eventType })
    }),
  geoUpdate: (
    id: string,
    body: { latitude: number; longitude: number; accuracy: number; heading?: number; speed?: number; timestamp: number }
  ) =>
    request<{
      geoState: string;
      distanceToTarget: number;
      humanDistance: string;
      bearingToTarget: number;
      arrivalDetected: boolean;
      uncertainZone: boolean;
      ombraLine?: string;
      ambientTrigger?: string;
      timerSnapshot: { elapsedSeconds: number; humanElapsed: string };
    }>(`/api/sessions/${id}/geo`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  arrive: (id: string, reason: 'manual' | 'fallback_uncertain' | 'lost_mode') =>
    request<{
      geoState: string;
      distanceToTarget: number;
      humanDistance: string;
      bearingToTarget: number;
      arrivalDetected: boolean;
      uncertainZone: boolean;
      ombraLine?: string;
      ambientTrigger?: string;
      timerSnapshot: { elapsedSeconds: number; humanElapsed: string };
    }>(`/api/sessions/${id}/arrive`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),
  compassPermission: (id: string, granted: boolean) =>
    request<{ ok: true }>(`/api/sessions/${id}/compass-permission`, {
      method: 'POST',
      body: JSON.stringify({ granted })
    }),
  geoPermission: (id: string, granted: boolean) =>
    request<{ ok: true }>(`/api/sessions/${id}/geo-permission`, {
      method: 'POST',
      body: JSON.stringify({ granted })
    })
};

export type SessionState = {
  id: string;
  alias: string;
  city: { name: string };
  currentMissionId: string | null;
  currentCheckpointId: string | null;
  finishedAt: string | null;
  geoState: string;
  lastKnownLatitude: number | null;
  lastKnownLongitude: number | null;
  lastKnownAccuracy: number | null;
  elapsedSeconds: number;
  transitPath: unknown;
  compassPermissionGranted: boolean;
  geoPermissionGranted: boolean;
  completedMissionIds: unknown;
  narrativeState: unknown;
  currentMission: null | {
    id: string;
    title: string;
    toneSlug: string;
    place: {
      name: string;
      zone: string;
      latitude: number;
      longitude: number;
      gpsRadius: number;
      gpsUncertaintyRadius: number;
      approachHintRadius: number;
    };
    transit: null | {
      id: string;
      estimatedMinutes: number;
      recommendedPath: string | null;
      ambientLines: Array<{
        id: string;
        trigger: string;
        text: string;
        order: number;
      }>;
    };
    checkpoints: Array<{
      id: string;
      prompt: string;
      type: string;
      validationRule: unknown;
      acceptAny: boolean;
    }>;
  };
  currentCheckpoint: null | {
    id: string;
    prompt: string;
    type: string;
    validationRule: unknown;
    acceptAny: boolean;
    hints?: unknown;
  };
};
