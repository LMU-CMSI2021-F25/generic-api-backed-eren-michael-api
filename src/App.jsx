import { useEffect, useState } from 'react'
import GateOverlay from './components/GateOverlay'
import MainMenu from './components/MainMenu'
import { SettingsProvider } from './components/SettingsContext'
import { pingApi } from './api/pokeapi'
import { useGameLoop } from './components/useGameLoop'
import BattleView from './components/BattleView'
import './styles/globals.css'

const EXIT_FADE_MS = 400;
const EXIT_SLIDE_MS = 900;
const EXIT_BUFFER_MS = 300;
const EXIT_TOTAL_MS = EXIT_FADE_MS + EXIT_SLIDE_MS + EXIT_BUFFER_MS;

// Provider wrapper so hooks run under context
export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

function AppContent() {
  const [fxKey, setFxKey] = useState(0);
  const onFxIntro = () => setFxKey(k => k + 1);

  const [overlayStatus, setOverlayStatus] = useState('checking');
  const [overlayExiting, setOverlayExiting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [netMode, setNetMode] = useState('online');

  const [selectedGens, setSelectedGens] = useState(new Set());

  const loop = useGameLoop({ onFxIntro });

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
      {showOverlay && (
        <GateOverlay status={overlayStatus} exiting={overlayExiting} playInKey={fxKey} />
      )}

      <main className="app-shell">
        <header className="app-header">
          <h1 className="app-title">Poké Randomizer</h1>
          <p className="app-subtitle">phase: {loop.phase}</p>
        </header>

        {loop.phase === 'idle' ? (
          <MainMenu
            netMode={netMode}
            onRetry={retryGate}
            onGoOffline={() => setNetMode('offline')}
            onFight={async () => {
              setOverlayStatus('checking');
              setShowOverlay(true);
              setOverlayExiting(false);
              setFxKey(k => k + 1);

              try {
                await loop.start({ selectedGens, offline: netMode === 'offline' });
                setOverlayStatus('online');
              } finally {
                setTimeout(() => {
                  setOverlayExiting(true);
                  setTimeout(() => setShowOverlay(false), 1600); }, 800)
              }
            }}
            selectedGens={selectedGens}
            setSelectedGens={setSelectedGens}
          />
        ) : (
          <BattleView loop={loop} />
        )}
      </main>
    </>
  );
}