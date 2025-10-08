import { useEffect, useRef, useState } from 'react';
import { listGenerations } from '../api/pokeapi.js';
import { useSettings } from './SettingsContext.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import '../styles/menu.css';

export default function MainMenu({
  netMode,
  onRetry,
  onGoOffline,
  onFight,
  selectedGens,
  setSelectedGens,
}) {
  const [gens, setGens] = useState([]);
  const [blinkKey, setBlinkKey] = useState(0);
  const scrollRef = useRef(null);
  const { settings, set } = useSettings();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await listGenerations();
      if (alive) setGens(data);
      if (alive) setBlinkKey(k => k + 1);
    })();
    return () => { alive = false; };
  }, []);

  const toggleGen = (id) => {
    const next = new Set(selectedGens);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedGens(next);
  };

  return (
    <div className="main menu-grid">
      {/* LEFT SIDE: Gen selection */}
      <aside className="pane-left">
        <h2 className="panel-title">Generations</h2>

        <div className="gen-scroller" ref={scrollRef} aria-label="Select Pokémon generations">
          <ul className="gen-list" key={blinkKey}>
            {gens.map(gen => (
              <li key={gen.id}>
                <button
                  className="btn"
                  data-active={selectedGens.has(gen.id) ? "true" : "false"}
                  onClick={() => toggleGen(gen.id)}
                  title={gen.label}
                >
                  <span>{gen.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* RIGHT SIDE: Controls */}
      <section className="pane-right">
        <div className="status-row">
          <span className={`api-pill ${netMode}`}>API Status: {netMode === "online" ? "Online" : "Offline"}</span>
          {netMode === "offline" ? (
            <button className="mini-btn" onClick={onRetry} title="Retry connecting to the API">Retry</button>
          ) : (
            <button className="mini-btn" onClick={onGoOffline} title="Switch to offline mode">Go Offline</button>
          )}
        </div>

        <div className="cta-stack">
          <button className="btn big" onClick={onFight}>
            <span>FIGHT</span>
          </button>

          <div className="row-two">
            <button className="btn" onClick={() => setShowSettings(true)}>
              <span>Settings</span>
            </button>
            <button
              className="btn"
              data-active={settings.muted ? "true" : "false"}
              onClick={() => set({ muted: !settings.muted })}
            >
              <span>{settings.muted ? "Unmute" : "Mute"}</span>
            </button>
          </div>
        </div>
      </section>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
