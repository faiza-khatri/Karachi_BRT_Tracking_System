import { useState, useEffect } from 'react';
import { getBusPositions } from '../api';

// Station layout positions on our schematic map (x%, y%)
const STATION_POSITIONS = {
  1: { x: 42, y: 60, name: 'Saddar' },
  2: { x: 38, y: 80, name: 'Clifton' },
  3: { x: 65, y: 45, name: 'Gulshan-e-Iqbal' },
  4: { x: 70, y: 70, name: 'Korangi' },
  5: { x: 82, y: 58, name: 'Landhi' },
  6: { x: 55, y: 20, name: 'North Nazimabad' },
};

// Route definitions: which stations connect, and what colour
const ROUTE_LINES = [
  { id: 1, name: 'R-1', color: '#ef4444', path: [1, 2, 4] },
  { id: 2, name: 'R-2', color: '#f59e0b', path: [6, 3, 5] },
  { id: 3, name: 'R-3', color: '#3b82f6', path: [1, 3, 4, 5] },
];

// Bus colors matching their routes
const BUS_COLORS = { 1: '#ef4444', 2: '#f59e0b', 3: '#3b82f6' };

export default function LiveMap() {
  const [positions, setPositions] = useState([]);
  const [error, setError]         = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selected, setSelected]   = useState(null); // selected bus id

  const fetchPositions = async () => {
    try {
      const data = await getBusPositions();
      setPositions(data.positions || []);
      setLastUpdate(new Date());
      setError('');
    } catch {
      setError('Cannot connect to server. Make sure Node.js is running on port 5000.');
    }
  };

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 5000); // refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const selectedBus = positions.find(p => p.bus_id === selected);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }

        .lm-page {
          min-height: 100vh;
          background: #0c0c0f;
          font-family: 'DM Sans', sans-serif;
          color: #fff;
          display: flex;
          flex-direction: column;
        }

        /* Header */
        .lm-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 1.1rem 2rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(12,12,15,0.95);
          position: sticky; top: 0; z-index: 10;
          backdrop-filter: blur(10px);
        }
        .lm-logo {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.4rem; letter-spacing: 0.05em;
          display: flex; align-items: center; gap: 0.5rem;
        }
        .lm-logo .red { color: #ef4444; }
        .nav-links { display: flex; gap: 0.5rem; }
        .nav-link {
          color: rgba(255,255,255,0.45); text-decoration: none;
          font-size: 0.83rem; padding: 0.4rem 0.9rem;
          border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);
          transition: all 0.2s;
        }
        .nav-link:hover { color: #fff; border-color: rgba(255,255,255,0.25); }

        /* Live badge */
        .live-badge {
          display: inline-flex; align-items: center; gap: 0.4rem;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 20px; padding: 0.3rem 0.75rem;
          font-size: 0.78rem; color: #ef4444; font-weight: 600;
        }
        .live-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #ef4444;
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,100% { opacity:1; transform: scale(1); }
          50%      { opacity:0.4; transform: scale(0.7); }
        }

        /* Main layout */
        .lm-body {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 0;
          max-height: calc(100vh - 60px);
        }
        @media (max-width: 800px) {
          .lm-body { grid-template-columns: 1fr; grid-template-rows: 1fr auto; }
          .lm-sidebar { max-height: 280px; overflow-y: auto; }
        }

        /* Map */
        .lm-map-wrap {
          position: relative;
          background:
            radial-gradient(ellipse at 30% 50%, rgba(185,28,28,0.06) 0%, transparent 60%),
            radial-gradient(ellipse at 70% 30%, rgba(59,130,246,0.05) 0%, transparent 60%),
            #0c0c0f;
          overflow: hidden;
        }

        /* Map header */
        .map-header {
          position: absolute; top: 1.5rem; left: 1.5rem; z-index: 5;
        }
        .map-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.8rem; letter-spacing: 0.05em;
          line-height: 1;
        }
        .map-sub {
          font-size: 0.78rem; color: rgba(255,255,255,0.35);
          margin-top: 0.2rem;
        }

        .map-svg {
          width: 100%; height: 100%;
          min-height: 400px;
        }

        /* Station node */
        .station-node { cursor: pointer; }
        .station-node circle { transition: r 0.2s; }
        .station-node:hover circle { r: 12; }
        .station-label { font-family: 'DM Sans', sans-serif; pointer-events: none; }

        /* Bus marker */
        .bus-marker {
          cursor: pointer;
          transition: transform 0.5s ease;
          animation: busAppear 0.3s ease;
        }
        @keyframes busAppear {
          from { opacity:0; transform: scale(0.5); }
          to   { opacity:1; transform: scale(1); }
        }

        /* Refresh time */
        .refresh-info {
          position: absolute; bottom: 1rem; left: 1.5rem;
          font-size: 0.75rem; color: rgba(255,255,255,0.2);
        }

        /* Sidebar */
        .lm-sidebar {
          border-left: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          padding: 1.5rem;
          overflow-y: auto;
        }
        .sidebar-title {
          font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(255,255,255,0.3);
          margin-bottom: 1rem;
        }

        /* Legend */
        .legend { margin-bottom: 1.5rem; }
        .legend-item {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .legend-line {
          width: 28px; height: 3px; border-radius: 2px; flex-shrink: 0;
        }
        .legend-name { font-size: 0.85rem; font-weight: 600; }
        .legend-desc { font-size: 0.75rem; color: rgba(255,255,255,0.35); }

        /* Bus cards */
        .bus-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 0.9rem;
          margin-bottom: 0.6rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .bus-card:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.15); }
        .bus-card.selected { border-color: #ef4444; background: rgba(239,68,68,0.07); }

        .bus-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
        .bus-number { font-weight: 700; font-size: 0.92rem; }
        .bus-dot { width: 10px; height: 10px; border-radius: 50%; }
        .bus-location { font-size: 0.8rem; color: rgba(255,255,255,0.45); }
        .bus-route-tag {
          font-size: 0.7rem; color: rgba(255,255,255,0.3);
          margin-top: 0.2rem;
        }

        .error-box {
          background: rgba(185,28,28,0.1); border: 1px solid rgba(185,28,28,0.3);
          border-radius: 8px; padding: 0.75rem; font-size: 0.82rem;
          color: #fca5a5; margin-bottom: 1rem;
        }
        .empty-msg {
          text-align: center; color: rgba(255,255,255,0.2);
          font-size: 0.85rem; padding: 1.5rem 0;
        }
      `}</style>

      <div className="lm-page">
        <header className="lm-header">
          <div className="lm-logo">🚌 Karachi <span className="red">Red</span> Bus</div>
          <div className="nav-links">
            <div className="live-badge"><div className="live-dot" /> Live</div>
            <a href="/" className="nav-link">Route Finder</a>
            <a href="/login" className="nav-link">Admin →</a>
          </div>
        </header>

        <div className="lm-body">
          {/* ── Map ── */}
          <div className="lm-map-wrap">
            <div className="map-header">
              <div className="map-title">Live Bus Map</div>
              <div className="map-sub">Karachi Red Bus Network · Simulated positions</div>
            </div>

            <svg className="map-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              {/* Grid lines for atmosphere */}
              {[20,40,60,80].map(v => (
                <g key={v}>
                  <line x1={v} y1="0" x2={v} y2="100" stroke="rgba(255,255,255,0.03)" strokeWidth="0.2" />
                  <line x1="0" y1={v} x2="100" y2={v} stroke="rgba(255,255,255,0.03)" strokeWidth="0.2" />
                </g>
              ))}

              {/* Route lines */}
              {ROUTE_LINES.map(route => (
                <g key={route.id}>
                  {route.path.slice(0,-1).map((stId, i) => {
                    const a = STATION_POSITIONS[stId];
                    const b = STATION_POSITIONS[route.path[i+1]];
                    return (
                      <line key={i}
                        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke={route.color} strokeWidth="0.6"
                        strokeOpacity="0.5" strokeDasharray="none"
                      />
                    );
                  })}
                </g>
              ))}

              {/* Station nodes */}
              {Object.entries(STATION_POSITIONS).map(([id, st]) => (
                <g key={id} className="station-node">
                  <circle cx={st.x} cy={st.y} r="2" fill="#0c0c0f" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" />
                  <circle cx={st.x} cy={st.y} r="1" fill="rgba(255,255,255,0.7)" />
                  <text
                    x={st.x + (st.x > 60 ? -3 : 3)}
                    y={st.y - 3}
                    fontSize="2.2"
                    fill="rgba(255,255,255,0.7)"
                    textAnchor={st.x > 60 ? 'end' : 'start'}
                    className="station-label"
                  >
                    {st.name}
                  </text>
                </g>
              ))}

              {/* Bus markers */}
              {positions.map(bus => {
                const st = STATION_POSITIONS[bus.station_id];
                if (!st) return null;
                const color = BUS_COLORS[bus.bus_id] || '#fff';
                const isSelected = selected === bus.bus_id;
                // Offset buses slightly so they don't overlap at same station
                const offset = (bus.bus_id - 2) * 2.5;
                return (
                  <g key={bus.bus_id}
                    className="bus-marker"
                    transform={`translate(${st.x + offset}, ${st.y - 5})`}
                    onClick={() => setSelected(isSelected ? null : bus.bus_id)}
                  >
                    <circle r={isSelected ? 4 : 3} fill={color} opacity="0.25" />
                    <circle r={isSelected ? 2.5 : 2} fill={color} />
                    <text x="0" y="-3.5" fontSize="2" fill="#fff" textAnchor="middle" fontWeight="bold">
                      {bus.bus_number}
                    </text>
                    {isSelected && (
                      <circle r="5" fill="none" stroke={color} strokeWidth="0.5" opacity="0.6">
                        <animate attributeName="r" from="3" to="7" dur="1s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.6" to="0" dur="1s" repeatCount="indefinite" />
                      </circle>
                    )}
                  </g>
                );
              })}
            </svg>

            {lastUpdate && (
              <div className="refresh-info">
                Last updated {lastUpdate.toLocaleTimeString()} · refreshes every 5s
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="lm-sidebar">
            {error && <div className="error-box">{error}</div>}

            <div className="sidebar-title">Route Legend</div>
            <div className="legend">
              {ROUTE_LINES.map(r => (
                <div key={r.id} className="legend-item">
                  <div className="legend-line" style={{ background: r.color }} />
                  <div>
                    <div className="legend-name">{r.name}</div>
                    <div className="legend-desc">{r.path.map(id => STATION_POSITIONS[id]?.name).join(' → ')}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="sidebar-title">Active Buses</div>
            {positions.length === 0 && !error && (
              <div className="empty-msg">Connecting to server…</div>
            )}
            {positions.map(bus => (
              <div key={bus.bus_id}
                className={`bus-card ${selected === bus.bus_id ? 'selected' : ''}`}
                onClick={() => setSelected(selected === bus.bus_id ? null : bus.bus_id)}
              >
                <div className="bus-card-top">
                  <div className="bus-number">🚌 {bus.bus_number}</div>
                  <div className="bus-dot" style={{ background: BUS_COLORS[bus.bus_id] || '#fff' }} />
                </div>
                <div className="bus-location">📍 {bus.station_name}</div>
                <div className="bus-route-tag">Route ID: {bus.route_id}</div>
              </div>
            ))}

            <div className="sidebar-title" style={{ marginTop: '1.5rem' }}>Stations</div>
            {Object.entries(STATION_POSITIONS).map(([id, st]) => (
              <div key={id} style={{ padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.83rem', color: 'rgba(255,255,255,0.5)' }}>
                {st.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}