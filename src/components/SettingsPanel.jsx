import { useSettings } from "./SettingsContext";
import "../styles/menu.css";

export default function SettingsPanel({ onClose }) {
  const { settings, set, reset } = useSettings();
  const save = () => onClose?.();

  return (
    <div className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="settings-card">
        <h3 className="panel-title">Settings</h3>

        <label className="settings-row">
          <span>Muted</span>
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={(e) => set({ muted: e.target.checked })}
          />
        </label>

        <label className="settings-row">
          <span>Battle speed</span>
          <select
            value={settings.battleSpeed}
            onChange={(e) => set({ battleSpeed: e.target.value })}
          >
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>
        </label>

        <label className="settings-row">
          <span>Difficulty</span>
          <select
            value={settings.difficulty}
            onChange={(e) => set({ difficulty: e.target.value })}
          >
            <option value="casual">Casual</option>
            <option value="standard">Standard</option>
            <option value="elite">Elite</option>
          </select>
        </label>

        <label className="settings-row">
          <span>Sprite style</span>
          <select
            value={settings.spriteStyle}
            onChange={(e) => set({ spriteStyle: e.target.value })}
          >
            <option value="gb">Game Boy</option>
            <option value="modern">Modern</option>
          </select>
        </label>

        <label className="settings-row">
            <span>Seed</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={settings.seed}
                placeholder="(e.g. 4F9ZK2)"
                onChange={(e) => {
                  const up = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
                  set({ seed: up });
                }}
                style={{ width: 140 }}
              />
              <button
                type="button"
                className="mini-btn"
                onClick={() => {
                  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                  let s = "";
                  for (let i = 0; i < 6; i++) s += chars[(Math.random() * chars.length) | 0];
                  set({ seed: s });
                }}
              >
                Randomize
              </button>
            </div>
        </label>


        <div className="settings-actions">
          <button type="button" className="mini-btn" onClick={reset}>Reset</button>
          <div className="spacer" />
          <button type="button" className="btn" onClick={save}>Save</button>
          <button type="button" className="mini-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
