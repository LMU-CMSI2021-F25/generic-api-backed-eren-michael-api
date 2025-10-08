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
        const roman = (n) => (['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n - 1] ?? String(n));
        const list = data.results.map((result, i) => {
            const idMatch = result.url.match(/\/generation\/(\d+)\//);
            const id = idMatch ? Number(idMatch[1]) : i + 1;
            return { id, key: result.name, label: `Gen ${roman(id)}` };
        });

        list.sort((a, b) => a.id - b.id);
        return list;
    } catch {
        return Array.from({ length: 9 }, (_, i) => ({ id: i + 1, key: `generation-${i + 1}`, label: `Gen ${i + 1}` })); // Fallback if API boof.
    }
}

/* Extended PokéAPI helpers for gameplay (species/pokemon/moves) */

/* Lightweight keyed cache on top of the module-level cache map */
function getCache(key) {
  return cache.has(key) ? cache.get(key) : null;
}
function setCache(key, val) {
  cache.set(key, val);
  return val;
}

/* Concurrency limiter (avoid hammering the API) */
function limit(n) {
  let active = 0;
  const q = [];
  const run = async (fn, resolve, reject) => {
    active++;
    try { resolve(await fn()); }
    catch (e) { reject(e); }
    finally {
      active--;
      if (q.length) {
        const [fn2, res2, rej2] = q.shift();
        run(fn2, res2, rej2);
      }
    }
  };
  return (fn) => new Promise((resolve, reject) => {
    if (active < n) run(fn, resolve, reject);
    else q.push([fn, resolve, reject]);
  });
}
const with6 = limit(6);

/* Stat key mapping (PokeAPI -> our field names) */
const statKey = (n) => ({
  "hp": "hp",
  "attack": "atk",
  "defense": "def",
  "special-attack": "spAtk",
  "special-defense": "spDef",
  "speed": "speed",
}[n]);

/* generations -> species list */
export async function speciesByGeneration(genId) {
  const key = `gen:${genId}:species`;
  const c = getCache(key);
  if (c) return c;

  const gen = await fetchJson(`${API_BASE}/generation/${genId}`, { useCache: true });
  const species = gen.pokemon_species
    .map(s => ({ name: s.name, id: Number(s.url.match(/\/(\d+)\/$/)[1]) }))
    .sort((a, b) => a.id - b.id);

  return setCache(key, species);
}

/* species -> flags + default form */
export async function speciesMeta(nameOrId) {
  const key = `species:${nameOrId}`;
  const c = getCache(key);
  if (c) return c;

  const sp = await fetchJson(`${API_BASE}/pokemon-species/${nameOrId}`, { useCache: true });
  const def = sp.varieties.find(v => v.is_default)?.pokemon;
  const meta = {
    id: sp.id,
    name: sp.name,
    isLegendary: !!sp.is_legendary,
    isMythical:  !!sp.is_mythical,
    defaultPokemon: def ? { name: def.name, id: Number(def.url.match(/\/(\d+)\/$/)[1]) } : null,
  };
  return setCache(key, meta);
}

/* pokemon (default form) -> types + base stats + moves */
export async function pokemonCore(nameOrId) {
  const key = `pokemon:${nameOrId}:core`;
  const c = getCache(key);
  if (c) return c;

  const p = await fetchJson(`${API_BASE}/pokemon/${nameOrId}`, { useCache: true });
  const core = {
    id: p.id,
    name: p.name,
    types: p.types.sort((a,b)=>a.slot-b.slot).map(t => t.type.name), // 1–2
    stats: p.stats.reduce((acc, s) => {
      const k = statKey(s.stat.name);
      if (k) acc[k] = s.base_stat;
      return acc;
    }, {}),
    moveRefs: p.moves.map(m => ({ name: m.move.name, url: m.move.url })),
  };
  return setCache(key, core);
}

/* move meta */
export async function moveMeta(nameOrId) {
  const key = `move:${nameOrId}`;
  const c = getCache(key);
  if (c) return c;

  const m = await fetchJson(`${API_BASE}/move/${nameOrId}`, { useCache: true });
  const meta = {
    id: m.id,
    name: m.name,
    type: m.type?.name ?? "normal",
    power: m.power ?? 0,
    accuracy: m.accuracy ?? null,
    class: m.damage_class?.name ?? "status", // physical | special | status
  };
  return setCache(key, meta);
}

/* build a playable mon from species */
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export async function playableFromSpecies(speciesName) {
  const sp  = await speciesMeta(speciesName);
  const def = sp.defaultPokemon;
  if (!def) throw new Error(`No default form for ${speciesName}`);

  const core = await pokemonCore(def.name);

  // Sample 8 candidate moves, enrich, prefer damaging, select 4.
  const sample = [...core.moveRefs].sort(()=>Math.random()-0.5).slice(0, 8);
  const metas  = await Promise.all(sample.map(m => with6(() => moveMeta(m.name))));
  const damaging = metas.filter(m => m.class !== "status" && (m.power ?? 0) > 0);
  const status   = metas.filter(m => m.class === "status" || (m.power ?? 0) === 0);
  const chosen   = (damaging.length >= 4 ? damaging.slice(0,4) : [...damaging, ...status].slice(0,4));

  return {
    id: core.id,
    name: core.name,
    types: core.types,
    hp: core.stats.hp,
    atk: core.stats.atk,
    spAtk: core.stats.spAtk,
    def: core.stats.def,
    spDef: core.stats.spDef,
    speed: core.stats.speed,
    moves: chosen.map(m => m.name),
    movesMeta: chosen,
  };
}

/* pick a legendary/mythical boss from gens */
export async function pickBossFromGenerations(genIdsOrSet) {
  const gens = (genIdsOrSet && genIdsOrSet.size)
    ? Array.from(genIdsOrSet)
    : [1]; // fallback to Gen 1 if nothing is selected

  const lists = await Promise.all(gens.map(id => speciesByGeneration(id)));
  const allSpecies = lists.flat();

  // Flag species, keep legendary/mythical
  const infos = await Promise.all(allSpecies.map(s => with6(() => speciesMeta(s.name))));
  const pool  = infos.filter(s => s.isLegendary || s.isMythical);
  const chosen = pool.length ? pick(pool) : pick(infos);

  return playableFromSpecies(chosen.name);
}

/* random playable mon across any generation (quick) */
export async function pickRandomPlayable() {
  // heuristic: pick a random gen (1..9), then random species from it
  const randGen = Math.max(1, Math.floor(Math.random() * 9));
  const list = await speciesByGeneration(randGen);
  const s = pick(list);
  return playableFromSpecies(s.name);
}

/* ==================== Dynamic type chart ==================== */

let _typeChart = null;

export async function loadTypeChart() {
  if (_typeChart) return _typeChart;

  // 1) list types
  const list = await fetchJson(`${API_BASE}/type`, { useCache: true });
  const names = list.results
    .map(t => t.name)
    // PokeAPI includes "unknown" & "shadow", decided to drop.
    .filter(n => n !== "unknown" && n !== "shadow");

  // 2) build attack→defense multipliers
  const chart = {};
  for (const atk of names) {
    const t = await fetchJson(`${API_BASE}/type/${atk}`, { useCache: true });
    const row = Object.create(null); // defType -> multiplier (default 1)

    const apply = (arr, mult) => {
      for (const ent of arr) row[ent.name] = mult;
    };
    const rel = t.damage_relations;
    apply(rel.double_damage_to   || [], 2.0);
    apply(rel.half_damage_to     || [], 0.5);
    apply(rel.no_damage_to       || [], 0.0);

    chart[atk] = row;
  }

  _typeChart = chart;
  return chart;
}

/** Multiply effectiveness for a moveType against one or two defender types */
export function effectivenessFor(moveType, defenderTypes, chart) {
  const row = chart?.[moveType] || {};
  let m = 1.0;
  for (const d of defenderTypes || []) {
    const k = d.toLowerCase();
    const v = row[k];
    if (typeof v === "number") m *= v;
  }
  return m;
}


/* ====================== Offline Gen-1 loader & pickers ====================== */

let _offlineGen1 = null;

export async function loadOfflineGen1() {
  if (_offlineGen1) return _offlineGen1;
  const res = await fetch("/gen1-offline.json", { cache: "force-cache" });
  if (!res.ok) throw new Error("missing gen1-offline.json");
  const data = await res.json();
  _offlineGen1 = data;
  // If we don't have a live chart yet, hydrate it for the app:
  if (!_typeChart && data.typeChart) _typeChart = data.typeChart;
  return data;
}

// helper to sample k items
function sampleK(arr, k) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

export async function pickRandomPlayableOffline() {
  const data = await loadOfflineGen1();
  const mon = pick(data.mons || data); // backward compat
  const pool = mon.movesPool?.length ? mon.movesPool : mon.moves;
  const chosen = sampleK(pool, Math.min(4, pool.length));
  const chosenMeta = (mon.movesMetaPool || []).filter(m => chosen.includes(m.name));
  return {
    ...mon,
    moves: chosen,
    movesMeta: chosenMeta,
    display: mon.name,
    movesFrom: mon.name,
  };
}

export async function pickBossFromOffline() {
  const data = await loadOfflineGen1();
  const list = (data.mons || data);
  const pool = list.filter(d => d.isLegendary || d.isMythical);
  const mon = pick(pool.length ? pool : list);

  const mp = mon.movesPool?.length ? mon.movesPool : mon.moves;
  const chosen = sampleK(mp, Math.min(4, mp.length));
  const chosenMeta = (mon.movesMetaPool || []).filter(m => chosen.includes(m.name));
  return {
    ...mon,
    moves: chosen,
    movesMeta: chosenMeta,
    display: mon.name,
    movesFrom: mon.name,
  };
}

export { API_BASE };