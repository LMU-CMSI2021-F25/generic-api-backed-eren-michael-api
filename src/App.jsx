import { useEffect, useState } from 'react'
import GateOverlay from './components/GateOverlay'
import MainMenu from './components/MainMenu'
import { pingApi } from './api/pokeapi'
import './styles/globals.css'

const EXIT_FADE_MS = 400;
const EXIT_SLIDE_MS = 900;
const EXIT_BUFFER_MS = 300;
const EXIT_TOTAL_MS = EXIT_FADE_MS + EXIT_SLIDE_MS + EXIT_BUFFER_MS;

export default function App() {
  const [fxKey, setFxKey] = useState(0); // to replay gate animation
  const [overlayStatus, setOverlayStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const [overlayExiting, setOverlayExiting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [netMode, setNetMode] = useState('online'); // 'online' | 'offline'

  const [muted, setMuted] = useState(false);
  const [selectedGens, setSelectedGens] = useState(new Set());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const response = await pingApi({ timeoutMs: 5000 });
      if (cancelled) return;

      if (response.ok) {
        setOverlayStatus('online');
        setNetMode('online');
      } else {
        setOverlayStatus('offline');
        setNetMode('offline');
      }

      setTimeout(() => {
        setOverlayExiting(true);
        setTimeout(() => setShowOverlay(false), EXIT_TOTAL_MS);
      }, 2000);
    })();

    return () => { cancelled = true; };
  }, []);

  const retryGate = async () => {
    // Reuse gate animation to retry API ping
    setFxKey(k => k + 1);
    setOverlayStatus('checking');
    setShowOverlay(true);
    setOverlayExiting(false);

    const response = await pingApi({ timeoutMs: 5000 });
    setOverlayStatus(response.ok ? 'online' : 'offline');
    setNetMode(response.ok ? 'online' : 'offline');
    
    setTimeout(() => {
      setOverlayExiting(true);
      setTimeout(() => setShowOverlay(false), EXIT_TOTAL_MS);
    }, 2000);
  };


  return (
    <>
      {showOverlay && 
        <GateOverlay 
          status={overlayStatus} 
          exiting={overlayExiting}
          playInKey={fxKey}
        />
      }

      <main className="app-shell">
        <header className="app-header">
          <h1 className="app-title">Poké Randomizer</h1>
          <p className="app-subtitle">menu prototype</p>
        </header>

        <MainMenu
          netMode={netMode}
          onRetry={retryGate}
          onGoOffline={() => setNetMode('offline')}
          onFight={() => alert('Not implemented')}
          muted={muted}
          setMuted={setMuted}
          selectedGens={selectedGens}
          setSelectedGens={setSelectedGens}
        />
      </main>
    </>
  );
}

