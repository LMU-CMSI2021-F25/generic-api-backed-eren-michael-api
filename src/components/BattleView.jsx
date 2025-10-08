import "../styles/menu.css";

export default function BattleView({ loop }) {
  const boss = loop.boss;
  const p    = loop.player?.candidate;
  const L    = loop.player?.locks;
  if (!boss || !p || !L) return null;

  const icon = (locked) => (locked ? "🔒" : "🔓");
  const ready = loop.isReady();

  return (
    <div className="battle-wrap">
      {/* BOSS */}
      <div className="battle-col boss">
        <h3 className="panel-title">BOSS</h3>
        <div className="card">
          <div className="row"><strong>{boss.name}</strong></div>
          <div className="row">Type: {boss.types.join(" / ")}</div>
          <div className="row">HP: {boss.hp}</div>
          <div className="row">Attack: {boss.atk} • Sp.Atk: {boss.spAtk}</div>
          <div className="row">Defense: {boss.def} • Sp.Def: {boss.spDef}</div>
          <div className="row">Speed: {boss.speed}</div>
          <div className="row">Moves:</div>
          <ul className="moves">
            {boss.moves.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      </div>

      {/* PLAYER */}
      <div className="battle-col player">
        <h3 className="panel-title">YOUR BUILD</h3>
        <div className="row"><em>Current source: {p.display}</em></div>
        <div className="card">
          <div className="row lockline">
            <button className={`lock ${L.type ? "on" : ""}`} onClick={() => loop.toggleLock("type")} disabled={L.type}>
              {icon(L.type)}
            </button>
            Type: {p.types.join(" / ")}
          </div>

          <div className="row lockline">
            <button className={`lock ${L.offenses ? "on" : ""}`} onClick={() => loop.toggleLock("offenses")} disabled={L.offenses}>
              {icon(L.offenses)}
            </button>
            Attack: {p.atk} • Sp.Atk: {p.spAtk}
          </div>

          <div className="row lockline">
            <button className={`lock ${L.defenses ? "on" : ""}`} onClick={() => loop.toggleLock("defenses")} disabled={L.defenses}>
              {icon(L.defenses)}
            </button>
            Defense: {p.def} • Sp.Def: {p.spDef}
          </div>

          <div className="row lockline">
            <button className={`lock ${L.hp ? "on" : ""}`} onClick={() => loop.toggleLock("hp")} disabled={L.hp}>
              {icon(L.hp)}
            </button>
            HP: {p.hp}
          </div>

          <div className="row lockline">
            <button className={`lock ${L.speed ? "on" : ""}`} onClick={() => loop.toggleLock("speed")} disabled={L.speed}>
              {icon(L.speed)}
            </button>
            Speed: {p.speed}
          </div>

          <div className="row lockline">
            <button className={`lock ${L.moves ? "on" : ""}`} onClick={() => loop.toggleLock("moves")} disabled={L.moves}>
              {icon(L.moves)}
            </button>
            Moves (from {p.movesFrom}):
          </div>
          <ul className="moves">
            {p.moves.map((m, i) => <li key={`${m}-${i}`}>{m}</li>)}
          </ul>
        </div>

        <div className="battle-actions">
          <button
            className="mini-btn"
            onClick={loop.reroll}
            disabled={loop.rerollsLeft <= 0 || ready}
           >    
            Reroll ({loop.rerollsLeft})
           </button>
          <button className="btn" onClick={loop.evaluate} disabled={!ready}>
            Start Battle
          </button>
        </div>
      </div>

      {loop.result && (
        <div className="results-bar">
          <strong>Result:</strong> {loop.result}
          <div className="spacer" />
          <button className="mini-btn" onClick={loop.retryBoss}>Retry Boss</button>
          <button className="mini-btn" onClick={loop.exitToMenu}>Back to Menu</button>
        </div>
      )}
    </div>
  );
}
