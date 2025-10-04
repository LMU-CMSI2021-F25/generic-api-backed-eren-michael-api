import { useEffect, useRef } from 'react';
import '../styles/gate.css';

export default function GateOverlay({ status = 'checking', exiting = false, playInKey }) {
    const rootRef = useRef(null);
    
    useEffect(() => {
        if (!rootRef.current) return;
        const el = rootRef.current;
        el.classList.add('fx-in');
        const t = setTimeout(() => el.classList.remove('fx-in'), 1200);
        return () => clearTimeout(t);
    }, [playInKey]);

    const label =
        status === 'checking' ? 'Checking API status...'
        : status === 'online'
        ? 'API is online! Entering...'
        : 'Offline mode: API is unreachable';

    return (
        <div ref={rootRef} className={`GateOverlay ${exiting ? 'is-exiting' : ''}`} role="status" aria-live="polite">
            <div className="gate gate-left" />
            <div className="gate gate-right" />
            
            <div className="gate-center">
                <div className="pokeball" aria-hidden="true" />
                <div className="status-text">{label}</div>
            </div>
        </div>
    );
}