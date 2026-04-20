const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'nightquest.admin.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function decodeToken(token: string): { role: 'admin' | 'editor'; email: string } | null {
  try {
    return JSON.parse(atob(token.split('.')[1])) as { role: 'admin' | 'editor'; email: string };
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit, auth = true): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(auth && getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const adminApi = {
  login: (body: { email: string; password: string }) =>
    request<{ token: string }>('/api/admin/login', { method: 'POST', body: JSON.stringify(body) }, false),

  dashboard: () => request<Record<string, unknown>>('/api/admin/dashboard'),

  // Cities
  cities: () => request<Array<Record<string, any>>>('/api/admin/cities'),
  createCity: (body: Record<string, unknown>) =>
    request<Record<string, any>>('/api/admin/cities', { method: 'POST', body: JSON.stringify(body) }),
  updateCity: (id: string, body: Record<string, unknown>) =>
    request<Record<string, any>>(`/api/admin/cities/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCity: (id: string) => request<void>(`/api/admin/cities/${id}`, { method: 'DELETE' }),

  // Places
  places: (cityId: string) => request<Array<Record<string, any>>>(`/api/admin/places?cityId=${cityId}`),
  createPlace: (body: Record<string, unknown>) =>
    request<Record<string, any>>('/api/admin/places', { method: 'POST', body: JSON.stringify(body) }),
  updatePlace: (id: string, body: Record<string, unknown>) =>
    request<Record<string, any>>(`/api/admin/places/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deletePlace: (id: string) => request<void>(`/api/admin/places/${id}`, { method: 'DELETE' }),
  placeFacts: (placeId: string) => request<Record<string, any> | null>(`/api/admin/place-facts/${placeId}`),
  upsertPlaceFacts: (body: Record<string, unknown>) =>
    request<Record<string, any>>('/api/admin/place-facts', { method: 'POST', body: JSON.stringify(body) }),
  updatePlaceFacts: (placeId: string, body: Record<string, unknown>) =>
    request<Record<string, any>>(`/api/admin/place-facts/${placeId}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Tones
  tones: () => request<Array<Record<string, any>>>('/api/admin/tones'),
  createTone: (body: Record<string, unknown>) =>
    request<Record<string, any>>('/api/admin/tones', { method: 'POST', body: JSON.stringify(body) }),
  updateTone: (id: string, body: Record<string, unknown>) =>
    request<Record<string, any>>(`/api/admin/tones/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Missions
  missions: (cityId: string) => request<Array<Record<string, any>>>(`/api/admin/missions?cityId=${cityId}`),
  createMission: (body: Record<string, unknown>) =>
    request<Record<string, any>>('/api/admin/missions', { method: 'POST', body: JSON.stringify(body) }),
  updateMission: (id: string, body: Record<string, unknown>) =>
    request<Record<string, any>>(`/api/admin/missions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteMission: (id: string) => request<void>(`/api/admin/missions/${id}`, { method: 'DELETE' }),
  transit: (missionId: string) => request<Record<string, any> | null>(`/api/admin/transits/${missionId}`),
  createTransit: (missionId: string, body: Record<string, unknown>) =>
    request<Record<string, any>>(`/api/admin/transits/${missionId}`, { method: 'POST', body: JSON.stringify(body) }),
  updateTransit: (missionId: string, body: Record<string, unknown>) =>
    request<Record<string, any>>(`/api/admin/transits/${missionId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTransit: (missionId: string) => request<void>(`/api/admin/transits/${missionId}`, { method: 'DELETE' }),
  ambientLines: (transitId: string) => request<Array<Record<string, any>>>(`/api/admin/ambient-lines?transitId=${transitId}`),
  createAmbientLine: (body: Record<string, unknown>) =>
    request<Record<string, any>>('/api/admin/ambient-lines', { method: 'POST', body: JSON.stringify(body) }),
  updateAmbientLine: (id: string, body: Record<string, unknown>) =>
    request<Record<string, any>>(`/api/admin/ambient-lines/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAmbientLine: (id: string) => request<void>(`/api/admin/ambient-lines/${id}`, { method: 'DELETE' }),
  generateAmbientLines: (body: Record<string, unknown>) =>
    request<{ items: Array<Record<string, any>> }>('/api/admin/ambient-lines/generate', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  generationPreview: (body: Record<string, unknown>) =>
    request<Record<string, any>>('/api/admin/generation/missions/preview', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  generationCommit: (body: Record<string, unknown>) =>
    request<Record<string, any>>('/api/admin/generation/missions/commit', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  generationProposals: (params?: { cityId?: string; status?: string }) =>
    request<Array<Record<string, any>>>(
      `/api/admin/generation/proposals?${new URLSearchParams(
        Object.entries(params ?? {}).filter(([, value]) => Boolean(value)) as Array<[string, string]>
      ).toString()}`
    ),
  generationProposalDetail: (id: string) => request<Record<string, any>>(`/api/admin/generation/proposals/${id}`),
  patchGenerationProposal: (id: string, body: Record<string, unknown>) =>
    request<Record<string, any>>(`/api/admin/generation/proposals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }),
  approveGenerationProposal: (id: string, body?: Record<string, unknown>) =>
    request<Record<string, any>>(`/api/admin/generation/proposals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(body ?? {})
    }),
  rejectGenerationProposal: (id: string, body: { reason: string }) =>
    request<Record<string, any>>(`/api/admin/generation/proposals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),

  // System Prompt
  systemPrompt: () =>
    request<{
      current: { id: string; content: string; createdAt: string } | null;
      versions: Array<{ id: string; content: string; createdAt: string }>;
    }>('/api/admin/system-prompt'),
  updateSystemPrompt: (content: string) =>
    request<Record<string, any>>('/api/admin/system-prompt', { method: 'PATCH', body: JSON.stringify({ content }) }),
  sandboxSystemPrompt: (content: string) =>
    request<{ prompt: string; briefing: unknown }>('/api/admin/system-prompt/sandbox', {
      method: 'POST',
      body: JSON.stringify({ content })
    }),

  // Sessions
  sessions: () => request<Array<Record<string, any>>>('/api/admin/sessions'),
  sessionDetail: (id: string) => request<Record<string, any>>(`/api/admin/sessions/${id}`),

  // Users
  users: () => request<Array<Record<string, any>>>('/api/admin/users'),
  createUser: (body: Record<string, unknown>) =>
    request<Record<string, any>>('/api/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: Record<string, unknown>) =>
    request<Record<string, any>>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};
