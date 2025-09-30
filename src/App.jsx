import { use, useEffect, useState } from 'react'
import GateOverlay from './components/GateOverlay'
import { pingApi } from './api/pokeapi'
import './styles/global.css'

export default function App() {
  const [overlayStatus, setOverlayStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const [overlayExiting, setOverlayExiting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [netMode, setNetMode] = useState('online'); // 'online' | 'offline'

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await pingApi({ timeoutMs: 5000 });
      if (cancelled) return;

      if (result.ok) {
        setOverlayStatus('online');
        setNetMode('online');
      } else {
        setOverlayStatus('offline');
        setNetMode('offline');
      }

      // Wait a moment to show the "online" status
      setTimeout(() => setOverlayExiting(true), 2000);

      // Remove overlay after exit animation
      setTimeout(() => setShowOverlay(false), 2700);
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <>
      {showOverlay && <GateOverlay status={overlayStatus} exiting={overlayExiting} />}

      {netMode === 'offline' && (
        <div className="offline-banner" role="alert">
          Using offline data. API is unreachable.
        </div>
      )}

      <main className="app-shell">
        <header className="app-header">
          <h1 className="app-title">Poké Randomizer</h1>
          <p className="app-subtitle">prototyping</p>
        </header>

        <section className="menu-card">
          {/* Menu content placeholder */}
          <button className="btn" disabled> 
            Play (not implemented)
          </button>
        </section>
      </main>
    </>
  );
}

