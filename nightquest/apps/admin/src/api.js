const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'nightquest.admin.token';
export function getToken() {
    return localStorage.getItem(TOKEN_KEY) ?? '';
}
export function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}
export function decodeToken(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    }
    catch {
        return null;
    }
}
async function request(path, init, auth = true) {
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
        return undefined;
    }
    return response.json();
}
export const adminApi = {
    login: (body) => request('/api/admin/login', { method: 'POST', body: JSON.stringify(body) }, false),
    dashboard: () => request('/api/admin/dashboard'),
    // Cities
    cities: () => request('/api/admin/cities'),
    createCity: (body) => request('/api/admin/cities', { method: 'POST', body: JSON.stringify(body) }),
    updateCity: (id, body) => request(`/api/admin/cities/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteCity: (id) => request(`/api/admin/cities/${id}`, { method: 'DELETE' }),
    // Places
    places: (cityId) => request(`/api/admin/places?cityId=${cityId}`),
    createPlace: (body) => request('/api/admin/places', { method: 'POST', body: JSON.stringify(body) }),
    updatePlace: (id, body) => request(`/api/admin/places/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deletePlace: (id) => request(`/api/admin/places/${id}`, { method: 'DELETE' }),
    placeFacts: (placeId) => request(`/api/admin/place-facts/${placeId}`),
    upsertPlaceFacts: (body) => request('/api/admin/place-facts', { method: 'POST', body: JSON.stringify(body) }),
    updatePlaceFacts: (placeId, body) => request(`/api/admin/place-facts/${placeId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    // Tones
    tones: () => request('/api/admin/tones'),
    createTone: (body) => request('/api/admin/tones', { method: 'POST', body: JSON.stringify(body) }),
    updateTone: (id, body) => request(`/api/admin/tones/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    // Missions
    missions: (cityId) => request(`/api/admin/missions?cityId=${cityId}`),
    createMission: (body) => request('/api/admin/missions', { method: 'POST', body: JSON.stringify(body) }),
    updateMission: (id, body) => request(`/api/admin/missions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteMission: (id) => request(`/api/admin/missions/${id}`, { method: 'DELETE' }),
    transit: (missionId) => request(`/api/admin/transits/${missionId}`),
    createTransit: (missionId, body) => request(`/api/admin/transits/${missionId}`, { method: 'POST', body: JSON.stringify(body) }),
    updateTransit: (missionId, body) => request(`/api/admin/transits/${missionId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteTransit: (missionId) => request(`/api/admin/transits/${missionId}`, { method: 'DELETE' }),
    ambientLines: (transitId) => request(`/api/admin/ambient-lines?transitId=${transitId}`),
    createAmbientLine: (body) => request('/api/admin/ambient-lines', { method: 'POST', body: JSON.stringify(body) }),
    updateAmbientLine: (id, body) => request(`/api/admin/ambient-lines/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteAmbientLine: (id) => request(`/api/admin/ambient-lines/${id}`, { method: 'DELETE' }),
    generateAmbientLines: (body) => request('/api/admin/ambient-lines/generate', {
        method: 'POST',
        body: JSON.stringify(body)
    }),
    generationPreview: (body) => request('/api/admin/generation/missions/preview', {
        method: 'POST',
        body: JSON.stringify(body)
    }),
    generationCommit: (body) => request('/api/admin/generation/missions/commit', {
        method: 'POST',
        body: JSON.stringify(body)
    }),
    generationProposals: (params) => request(`/api/admin/generation/proposals?${new URLSearchParams(Object.entries(params ?? {}).filter(([, value]) => Boolean(value))).toString()}`),
    generationProposalDetail: (id) => request(`/api/admin/generation/proposals/${id}`),
    patchGenerationProposal: (id, body) => request(`/api/admin/generation/proposals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
    }),
    approveGenerationProposal: (id, body) => request(`/api/admin/generation/proposals/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(body ?? {})
    }),
    rejectGenerationProposal: (id, body) => request(`/api/admin/generation/proposals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify(body)
    }),
    // System Prompt
    systemPrompt: () => request('/api/admin/system-prompt'),
    updateSystemPrompt: (content) => request('/api/admin/system-prompt', { method: 'PATCH', body: JSON.stringify({ content }) }),
    sandboxSystemPrompt: (content) => request('/api/admin/system-prompt/sandbox', {
        method: 'POST',
        body: JSON.stringify({ content })
    }),
    // Sessions
    sessions: () => request('/api/admin/sessions'),
    sessionDetail: (id) => request(`/api/admin/sessions/${id}`),
    // Users
    users: () => request('/api/admin/users'),
    createUser: (body) => request('/api/admin/users', { method: 'POST', body: JSON.stringify(body) }),
    updateUser: (id, body) => request(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};
