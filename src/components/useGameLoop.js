import { useCallback, useMemo, useRef, useState } from "react";
import { 
    pickBossFromGenerations, pickRandomPlayable, loadTypeChart, effectivenessFor,
    pickBossFromOffline, pickRandomPlayableOffline, loadOfflineGen1
} from "../api/pokeapi";
import { useSettings } from "./SettingsContext";

const REROLLS_BY_DIFFICULTY = { casual: 6, standard: 4, elite: 2 };
const ROUNDS_BY_DIFFICULTY  = { casual: 6, standard: 8, elite: 10 };

const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];

function metaForMove(name, metaList) {
  return metaList?.find?.(m => m.name === name);
}

/* Merge: keep locked fields from A, fill others from B (one Pokemon source) */
function composeCandidateFrom(current, locks, source) {
  return {
    display: source.name,
    types:   locks.type     ? current.types : source.types,
    hp:      locks.hp       ? current.hp    : source.hp,
    atk:     locks.offenses ? current.atk   : source.atk,
    spAtk:   locks.offenses ? current.spAtk : source.spAtk,
    def:     locks.defenses ? current.def   : source.def,
    spDef:   locks.defenses ? current.spDef : source.spDef,
    speed:   locks.speed    ? current.speed : source.speed,
    moves:     locks.moves ? current.moves     : source.moves,
    movesFrom: locks.moves ? current.movesFrom : source.name,
  };
}

const allLocked = (L) => L.type && L.offenses && L.defenses && L.hp && L.moves && L.speed;

/* Battle helpers */
function chooseMove(list) { 
    return list[(Math.random() * list.length) | 0]; 
}
function applySupport(effect, self, foe) {
  switch (effect) {
    case "heal":        self.hp = Math.min(self.hpMax, Math.round(self.hp + self.hpMax * 0.3)); break;
    case "spd_up":      self.speed = Math.round(self.speed * 1.2); break;
    case "def_up":      self.def = Math.round(self.def * 1.2); self.spDef = Math.round(self.spDef * 1.2); break;
    case "atk_spd_up":  self.atk = Math.round(self.atk * 1.1); self.spAtk = Math.round(self.spAtk * 1.1); self.speed = Math.round(self.speed * 1.1); break;
    case "paralyze":    foe.speed = Math.max(1, Math.round(foe.speed * 0.7)); break;
    case "sleep":       foe.skipNext = Math.random() < 0.5; break;
    case "confuse":     foe.selfHitChance = 0.25; break;
    default: break;
  }
}

function damageFor(moveName, attacker, defender, typeChart, moveMetaList) {
  // meta from candidate/boss, fallback to a safe default
  const m = metaForMove(moveName, moveMetaList) || { type: "normal", power: 60, class: "physical" };
  if (m.class === "status" || m.support) return 0;

  const isSpecial = m.class === "special" || m.special === true;
  const atkStat   = isSpecial ? attacker.spAtk : attacker.atk;
  const defStat   = isSpecial ? defender.spDef : defender.def;

  const moveType  = (m.type || "normal").toLowerCase();
  const atkTypes  = (attacker.types || []).map(t => t.toLowerCase());
  const defTypes  = (defender.types || []).map(t => t.toLowerCase());
  const stabM     = atkTypes.includes(moveType) ? 1.2 : 1.0;
  const typM      = effectivenessFor(moveType, defTypes, typeChart) || 1;

  const power = m.power ?? 60;
  const raw   = power * (atkStat / Math.max(1, defStat)) * stabM * typM * 0.25;
  return Math.max(1, Math.round(raw));
}

/* Hook */
export function useGameLoop({ onFxIntro }) {
  const { settings } = useSettings();
  const typeChartRef = useRef(null);

  const [phase, setPhase] = useState("idle"); // idle | prep | intro | battle | results
  const [result, setResult] = useState(null); // "Win" | "Tie" | "Lose"
  const [rerollsLeft, setRerollsLeft] = useState(0);
  const [tick, setTick] = useState(0);        // force render when mutating refs
  const bump = () => setTick(t => t + 1);

  const bossRef = useRef(null);
  const playerRef = useRef({
    candidate: null,
    locks: { type: false, offenses: false, defenses: false, hp: false, moves: false, speed: false },
  });
  const providerRef = useRef("online"); // "online" | "offline"

  const start = useCallback(async ({ selectedGens, offline = false }) => {
  setPhase("intro");
  onFxIntro?.();

  if (offline) await loadOfflineGen1(); // ensure offline file is warm

  // Ensure type chart is ready
  if (!typeChartRef.current) typeChartRef.current = await loadTypeChart();

  // fetch boss + first candidate in parallel
  const [boss, candidate] = await Promise.all([
    offline ? pickBossFromOffline() : pickBossFromGenerations(selectedGens),
    offline ? pickRandomPlayableOffline() : pickRandomPlayable(),
  ]);
  bossRef.current = boss;
  playerRef.current = {
    candidate: { ...candidate, display: candidate.name, movesFrom: candidate.name },
    locks: { type:false, offenses:false, defenses:false, hp:false, moves:false, speed:false }
  };
  const rer = REROLLS_BY_DIFFICULTY[settings.difficulty] ?? REROLLS_BY_DIFFICULTY.standard;
  setRerollsLeft(rer);

  providerRef.current = offline ? "offline" : "online";
  // move into battle phase (App will hide overlay afterwards)
  setPhase("battle");
}, [onFxIntro, settings.difficulty]);


  /* Reroll every field that is NOT locked */
  const reroll = useCallback(async () => {
    if (rerollsLeft <= 0) return;
    const P = playerRef.current;
    const srcRaw = providerRef.current === "offline"
        ? await pickRandomPlayableOffline()
        : await pickRandomPlayable();
    const src = { ...srcRaw, display: srcRaw.name, movesFrom: srcRaw.name}
    const next = { ...P.candidate };
    
    if (!P.locks.type)     next.types = src.types;
    if (!P.locks.hp)       next.hp = src.hp;
    if (!P.locks.offenses) { next.atk = src.atk; next.spAtk = src.spAtk; }
    if (!P.locks.defenses) { next.def = src.def; next.spDef = src.spDef; }
    if (!P.locks.speed)    next.speed = src.speed;
    if (!P.locks.moves)    { next.moves = src.moves; next.movesFrom = src.movesFrom; }

    next.display = src.name
    playerRef.current = { ...P, candidate: next };
    setRerollsLeft(v => v - 1);
    bump();
  }, [rerollsLeft]);

  /* Evaluate battle */
  const evaluate = useCallback(() => {
    const boss = bossRef.current;
    const pc   = playerRef.current.candidate;

    // User build
    const user = {
      name: pc.display, types: pc.types.slice(),
      hpMax: pc.hp, hp: pc.hp,
      atk: pc.atk, spAtk: pc.spAtk,
      def: pc.def, spDef: pc.spDef,
      speed: pc.speed, moves: pc.moves.slice(),
      movesMeta: pc.movesMeta,
      skipNext: false, selfHitChance: 0,
    };

    // Boss build
    const foe = {
      name: boss.name, types: boss.types.slice(),
      hpMax: boss.hp, hp: boss.hp,
      atk: boss.atk, spAtk: boss.spAtk,
      def: boss.def, spDef: boss.spDef,
      speed: boss.speed, moves: boss.moves.slice(),
      movesMeta: boss.movesMeta,
      skipNext: false, selfHitChance: 0,
    };

    const rounds = ROUNDS_BY_DIFFICULTY[settings.difficulty] ?? ROUNDS_BY_DIFFICULTY.standard;

    for (let r = 1; r <= rounds; r++) {
      const order = (user.speed > foe.speed) ? ["user","foe"]
                  : (user.speed < foe.speed) ? ["foe","user"]
                  : (Math.random() < 0.5) ? ["user","foe"] : ["foe","user"];

      for (const side of order) {
        const me   = side === "user" ? user : foe;
        const them = side === "user" ? foe  : user;
        if (me.hp <= 0 || them.hp <= 0) break;

        if (me.skipNext) { me.skipNext = false; continue; }
        if (me.selfHitChance && Math.random() < me.selfHitChance) {
          me.hp = Math.max(0, me.hp - Math.max(1, Math.round(0.05 * me.hpMax)));
          continue;
        }

        const mv = chooseMove(me.moves);
        const meta = metaForMove(mv, me.movesMeta);
        if (meta?.support || meta?.class === "status") {
          applySupport(meta.effect, me, them);
          continue;
        }
        const dmg       = damageFor(
                            mv,
                            me,
                            them,typeChartRef.current,
                            me.movesMeta
                        );
        them.hp = Math.max(0, them.hp - dmg);
      }
      if (user.hp <= 0 || foe.hp <= 0) break;
    }

    let verdict = "Tie";
    if (user.hp > 0 && foe.hp <= 0) verdict = "Win";
    else if (foe.hp > 0 && user.hp <= 0) verdict = "Lose";
    else if (user.hp > foe.hp) verdict = "Win";
    else if (foe.hp > user.hp) verdict = "Lose";

    setResult(verdict);
    setPhase("results");
  }, [settings.difficulty]);

  /* Toggle locks (one-way): lock -> auto-advance; when all locked → auto evaluate */
  const toggleLock = useCallback(async (key) => {
    const P = playerRef.current;
    if (!(key in P.locks)) return;
    if (P.locks[key] === true) return; // one-way

    const nextLocks = { ...P.locks, [key]: true };
    const srcRaw = providerRef.current === "offline"
        ? await pickRandomPlayableOffline()
        : await pickRandomPlayable();
    const newSource = { ...srcRaw, display: srcRaw.name, movesFrom: srcRaw.name };
    const merged = composeCandidateFrom(P.candidate, nextLocks, newSource);
    playerRef.current = { candidate: merged, locks: nextLocks };
    bump();

    if (allLocked(nextLocks)) {
      setTimeout(() => evaluate(), 0); // let UI paint final lock
    }
  }, [evaluate]);

  /* Ready when all fields are locked */
  const isReady = useCallback(() => allLocked(playerRef.current.locks), []);

  const retryBoss = useCallback(async () => {
      const srcRaw = providerRef.current === "offline"
        ? await pickRandomPlayableOffline()
        : await pickRandomPlayable();
      const candidate = { ...srcRaw, display: srcRaw.name, movesFrom: srcRaw.name };
      playerRef.current = {
        candidate,
        locks: { type:false, offenses:false, defenses:false, hp:false, moves:false, speed:false }
      };
      const rer = REROLLS_BY_DIFFICULTY[settings.difficulty] ?? REROLLS_BY_DIFFICULTY.standard;
      setRerollsLeft(rer);
      setResult(null);
      setPhase("battle");
    }, [settings.difficulty]);


  const exitToMenu = useCallback(() => {
    bossRef.current = null;
    setResult(null);
    setRerollsLeft(0);
    setPhase("idle");
  }, []);

  return useMemo(() => ({
    phase, result,
    boss: bossRef.current,
    player: playerRef.current,
    rerollsLeft,

    start, reroll, toggleLock, isReady, evaluate, retryBoss, exitToMenu,
  }), [phase, result, rerollsLeft, start, reroll, toggleLock, isReady, evaluate, retryBoss, exitToMenu, tick]);
}