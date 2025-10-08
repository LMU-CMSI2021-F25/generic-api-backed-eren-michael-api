import { createContext, useContext, useState, useEffect, useMemo } from "react";


const DEFAULTS = {
    muted: false,
    battleSpeed: "normal", // slow | normal | fast (Not sure if it will be relevant)
    difficulty: "standard", // casual | standard | elite
    spriteStyle: "gb", // modern | gb (This is extra after we get everything done)
    seed: "",
};

const KEY = "pr_settings_v1";
const SettingsCtx = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
    catch { return DEFAULTS; }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  const api = useMemo(() => ({
    settings,
    set: (patch) => setSettings(s => ({ ...s, ...patch })),
    reset: () => setSettings(DEFAULTS),
  }), [settings]);

  return <SettingsCtx.Provider value={api}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}