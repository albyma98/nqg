const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
async function request(path, init) {
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
    return response.json();
}
export const api = {
    getCities: () => request('/api/cities'),
    createSession: (body) => request('/api/sessions', {
        method: 'POST',
        body: JSON.stringify(body)
    }),
    getSession: (id) => request(`/api/sessions/${id}`),
    getState: (id) => request(`/api/sessions/${id}/state`),
    answer: (id, body) => request(`/api/sessions/${id}/answer`, {
        method: 'POST',
        body: JSON.stringify(body)
    }),
    hint: (id) => request(`/api/sessions/${id}/hint`, {
        method: 'POST',
        body: JSON.stringify({})
    }),
    narrator: (id, eventType) => request(`/api/sessions/${id}/narrator`, {
        method: 'POST',
        body: JSON.stringify({ eventType })
    }),
    geoUpdate: (id, body) => request(`/api/sessions/${id}/geo`, {
        method: 'POST',
        body: JSON.stringify(body)
    }),
    arrive: (id, reason) => request(`/api/sessions/${id}/arrive`, {
        method: 'POST',
        body: JSON.stringify({ reason })
    }),
    compassPermission: (id, granted) => request(`/api/sessions/${id}/compass-permission`, {
        method: 'POST',
        body: JSON.stringify({ granted })
    }),
    geoPermission: (id, granted) => request(`/api/sessions/${id}/geo-permission`, {
        method: 'POST',
        body: JSON.stringify({ granted })
    })
};
