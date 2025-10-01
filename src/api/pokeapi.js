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

// Fetching a list of generations from the API and formatting them in Roman numerals
export async function listGenerations() {
    try {
        const data = await fetchJson(`${API_BASE}/generation?limit=40`, { useCache: true});
        const roman = n => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n] || String(n);
        return data.results.map((result, i) => {
            const idMatch = result.url.match(/\/generation\/(\d+)\//);
            const id = idMatch ? Number(idMatch[1]) : i + 1;
            return { id, key: result.name, label: `Gen ${roman(id)}` };
        });
    } catch {
        return Array.from({ length: 9 }, (_, i) => ({ id: i + 1, key: `generation-${i + 1}`, label: `Gen ${i + 1}` })); // Fallback if API boof.
    }
}

export { API_BASE };