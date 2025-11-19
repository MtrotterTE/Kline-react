// src/components/NavigationRail.jsx
import React from 'react';
import './NavigationRail.css';

function NavigationRail({ activeView, onSelectView }) {
  const isActive = (view) => activeView === view;

  return (
    <div className="rail navigation-rail pa-4">
      <div className="nav-buttons">
        <h1>Choose a Graph:</h1>

        <h2>Distance vs Time</h2>
        <button
          type="button"
          className={`nav-btn ${isActive('outboundTime') ? 'active' : ''}`}
          onClick={() => onSelectView('outboundTime')}
        >
          K Line Outbound
        </button>
        <button
          type="button"
          className={`nav-btn ${isActive('inboundTime') ? 'active' : ''}`}
          onClick={() => onSelectView('inboundTime')}
        >
          K Line Inbound
        </button>

        <h2>Distance vs Speed</h2>
        <button
          type="button"
          className={`nav-btn ${isActive('outboundSpeed') ? 'active' : ''}`}
          onClick={() => onSelectView('outboundSpeed')}
        >
          K Line Outbound
        </button>
        <button
          type="button"
          className={`nav-btn ${isActive('inboundSpeed') ? 'active' : ''}`}
          onClick={() => onSelectView('inboundSpeed')}
        >
          K Line Inbound
        </button>
      </div>
    </div>
  );
}

export default NavigationRail;
