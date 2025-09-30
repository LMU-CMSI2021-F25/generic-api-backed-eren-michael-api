const API_BASE = 'https://pokeapi.co/api/v2';

const cache = new Map();


export async function fetchJson(url, { timeoutMs = 5000, useCache = true } = {}) {
    if (useCache && cache.has(url)) {
        return cache.get(url);
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (useCache) {
            cache.set(url, data);
        }
        return data;
    } catch (error) {
        throw error; // Just pass through the error
    } finally {
        clearTimeout(t);
    }
}

// Simple liveness check for the start
export async function pingApi({ timeoutMs = 5000 } = {}) {
    try {
        await fetchJson(`${API_BASE}/pokemon?limit=1`, { timeoutMs, useCache: false });
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

export { API_BASE }