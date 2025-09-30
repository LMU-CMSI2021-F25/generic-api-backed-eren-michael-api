import React from 'react';
import '../styles/gate.css';

export default function GateOverlay({ status = 'checking', exiting = false}) {
    const label =
        status === 'checking' ? 'Checking API status...'
        : status === 'online'
        ? 'API is online! Entering...'
        : 'Offline mode: API is unreachable';

    return (
        <div className={`GateOverlay ${exiting ? 'is-exiting' : ''}`} role="status" aria-live="polite">
            <div className="gate gate-left" />
            <div className="gate gate-right" />
            
            <div className="gate-center">
                <div className="pokeball" aria-hidden="true" />
                <div className="status-text">{label}</div>
            </div>
        </div>
    );
}