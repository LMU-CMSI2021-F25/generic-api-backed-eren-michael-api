// tools/build-gen1-offline.mjs
import fs from "node:fs/promises";

const API = "https://pokeapi.co/api/v2";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function j(u){ const r=await fetch(u); if(!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); }

const statKey = (n) => ({
  "hp":"hp","attack":"atk","defense":"def","special-attack":"spAtk","special-defense":"spDef","speed":"speed",
}[n]);

async function moveMeta(name){
  const m = await j(`${API}/move/${name}`);
  return { name: m.name, type: m.type?.name ?? "normal", power: m.power ?? 0, class: m.damage_class?.name ?? "status" };
}

function pick(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

async function buildTypeChart() {
  const list = await j(`${API}/type`);
  const names = list.results.map(t => t.name).filter(n => n !== "unknown" && n !== "shadow");
  const chart = {};
  for (const atk of names) {
    const t = await j(`${API}/type/${atk}`);
    const row = {};
    const app = (arr, m) => arr.forEach(x => row[x.name] = m);
    app(t.damage_relations.double_damage_to || [], 2.0);
    app(t.damage_relations.half_damage_to   || [], 0.5);
    app(t.damage_relations.no_damage_to     || [], 0.0);
    chart[atk] = row;
  }
  return chart;
}

async function playableFromSpecies(name){
  const sp = await j(`${API}/pokemon-species/${name}`);
  const def = sp.varieties.find(v=>v.is_default)?.pokemon?.name;
  if(!def) return null;
  const p = await j(`${API}/pokemon/${def}`);

  const core = {
    id: p.id, name: p.name,
    types: p.types.sort((a,b)=>a.slot-b.slot).map(t=>t.type.name),
    stats: p.stats.reduce((a,s)=>{ const k=statKey(s.stat.name); if(k) a[k]=s.base_stat; return a; },{}),
    moveRefs: [...new Set(p.moves.map(m=>m.move.name))],
  };

  // Build a richer pool:
  //  - sample up to 24 unique moves from the Pokémon's full list
  //  - enrich all
  //  - prefer damaging; keep a mix; cap pool size to 8 (configurable)
  const SAMPLE = 24;
  const POOL_SIZE = 8;

  const sample = core.moveRefs.sort(()=>Math.random()-0.5).slice(0, SAMPLE);
  const metas = [];
  for (const mv of sample) { metas.push(await moveMeta(mv)); await sleep(35); } // be gentle

  const damaging = metas.filter(m => m.class !== "status" && (m.power ?? 0) > 0);
  const status   = metas.filter(m => m.class === "status" || (m.power ?? 0) === 0);

  // Take as many damaging as possible, then top up with status
  const poolMeta = [...damaging.slice(0, POOL_SIZE), ...status].slice(0, POOL_SIZE);
  const pool     = poolMeta.map(m => m.name);

  // Keep 4 defaults for initial rolls if you want (first 4 of pool),
  // but the important part is we store the whole pool.
  const defaultFour = pool.slice(0, 4);

  return {
    id: core.id,
    name: core.name,
    types: core.types,
    hp: core.stats.hp, atk: core.stats.atk, spAtk: core.stats.spAtk,
    def: core.stats.def, spDef: core.stats.spDef, speed: core.stats.speed,
    // keep a default 4 for convenience
    moves: defaultFour,
    // NEW: a larger pool to choose from later
    movesPool: pool,
    movesMetaPool: poolMeta, // optional but handy for UI/battle
    isLegendary: sp.is_legendary, isMythical: sp.is_mythical,
  };
}

(async () => {
  console.log("Fetching Generation 1 species...");
  const gen1 = await j(`${API}/generation/1`);
  const names = gen1.pokemon_species.map(s=>s.name).sort();
  const chart = await buildTypeChart();
  const out = [];
  for (const name of names) {
    try {
      const playable = await playableFromSpecies(name);
      if (playable) out.push(playable);
      await sleep(50);
      process.stdout.write(".");
    } catch (e) {
      console.warn("\nSkip", name, e.message);
    }
  }

  await fs.mkdir("public", { recursive: true });
  await fs.writeFile("public/gen1-offline.json", JSON.stringify({
    typeChart: chart,
    mons: out}, 
    null, 2));
  console.log(`\nWrote public/gen1-offline.json (${out.length} entries)`);
})();
