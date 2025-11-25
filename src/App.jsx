// src/App.jsx
import React, { useMemo, useState } from 'react';
import NavigationRail from './components/NavigationRail.jsx';
import KLineInboundTime from './components/KLineInboundTime.jsx';
//import KLineInboundTime from './components/KLineInboundTime.jsx';
//import KLineOutboundSpeed from './components/KLineOutboundSpeed.jsx';
//import KLineInboundSpeed from './components/KLineInboundSpeed.jsx';

import './App.css'; // optional: if you want to put the layout CSS here

function App() {
  const [activeView, setActiveView] = useState('inboundTime');

  const views = useMemo(
    () => ({
      inboundTime: KLineInboundTime,
      //inboundTime: KLineInboundTime,
      //outboundSpeed: KLineOutboundSpeed,
      //inboundSpeed: KLineInboundSpeed,
    }),
    [],
  );

  const CurrentComponent = views[activeView] ?? KLineInboundTime;

  return (
    <div className="app-layout">
      <NavigationRail
        activeView={activeView}
        onSelectView={setActiveView}
      />
      <main className="content">
        <CurrentComponent />
      </main>
    </div>
  );
}

export default App;
