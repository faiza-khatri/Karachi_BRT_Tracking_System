import { useState, useEffect, useRef } from 'react';
import { getBusPositions } from '../api';

// ── Add two new fetchers inline (or move to api.js if you prefer) ─────────────
const BASE = 'http://localhost:5000/api';
const getStops       = () => fetch(`${BASE}/stops`).then(r => r.json());
const getArrivals    = (stopId) => fetch(`${BASE}/stop/${stopId}/arrivals`).then(r => r.json());

// Route colours matching your backend routes
const ROUTE_COLORS = {
  'R-1':  '#ef4444',
  'R-3':  '#f59e0b',
  'R-6':  '#22c55e',
  'K-4':  '#8b5cf6',
  'P-1':  '#ec4899',
  'EV-1': '#06b6d4',
};
// Fallback by route_id index
const COLOR_PALETTE = ['#ef4444','#f59e0b','#22c55e','#8b5cf6','#ec4899','#06b6d4','#f97316'];
const routeColor = (routeId) => COLOR_PALETTE[(routeId - 1) % COLOR_PALETTE.length];

export default function LiveMap() {
  const mapRef        = useRef(null);   // leaflet map instance
  const mapDivRef     = useRef(null);   // DOM node
  const markersRef    = useRef({});     // busId → L.marker
  const stopMarkersRef= useRef([]);     // stop circle markers
  const LRef          = useRef(null);   // leaflet lib

  const [positions,   setPositions]   = useState([]);
  const [stops,       setStops]       = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);
  const [selectedStop,setSelectedStop]= useState(null);
  const [arrivals,    setArrivals]    = useState([]);
  const [lastUpdate,  setLastUpdate]  = useState(null);
  const [error,       setError]       = useState('');
  const [mapReady,    setMapReady]    = useState(false);

  // ── 1. Load Leaflet dynamically (no npm install needed if not present) ───────
  useEffect(() => {
    // Inject Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id   = 'leaflet-css';
      link.rel  = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    // Inject Leaflet JS
    if (window.L) { LRef.current = window.L; initMap(); return; }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => { LRef.current = window.L; initMap(); };
    document.head.appendChild(script);
  }, []);

  function initMap() {
    if (mapRef.current || !mapDivRef.current) return;
    const L = LRef.current;

    const map = L.map(mapDivRef.current, {
      center: [24.9008, 67.0700], // Karachi centre
      zoom:   12,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;
    setMapReady(true);
  }

  // ── 2. Load stops once map is ready ──────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    getStops().then(data => {
      const stopList = data.stops || [];
      setStops(stopList);
      renderStopMarkers(stopList);
    }).catch(() => setError('Could not load stops from server.'));
  }, [mapReady]);

  function renderStopMarkers(stopList) {
    const L   = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    // Clear old stop markers
    stopMarkersRef.current.forEach(m => map.removeLayer(m));
    stopMarkersRef.current = [];

    stopList.forEach(stop => {
      if (!stop.latitude || !stop.longitude) return;
      const circle = L.circleMarker([stop.latitude, stop.longitude], {
        radius:      6,
        color:       '#fff',
        weight:      1.5,
        fillColor:   '#1e293b',
        fillOpacity: 0.9,
      }).addTo(map);

      circle.bindTooltip(stop.stop_name, {
        permanent:  false,
        direction:  'top',
        className:  'krb-tooltip',
      });

      circle.on('click', () => {
        setSelectedStop(stop);
        setSelectedBus(null);
        getArrivals(stop.stop_id).then(d => setArrivals(d.arrivals || []));
      });

      stopMarkersRef.current.push(circle);
    });
  }

  // ── 3. Bus icon factory ───────────────────────────────────────────────────────
  function makeBusIcon(L, color, busNumber, isSelected) {
    const size = isSelected ? 36 : 28;
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <circle cx="18" cy="18" r="17" fill="${color}" opacity="${isSelected ? 1 : 0.85}" stroke="#fff" stroke-width="2"/>
        ${isSelected ? `<circle cx="18" cy="18" r="17" fill="none" stroke="${color}" stroke-width="3" opacity="0.4">
          <animate attributeName="r" from="17" to="26" dur="1.2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.4" to="0" dur="1.2s" repeatCount="indefinite"/>
        </circle>` : ''}
        <text x="18" y="22" text-anchor="middle" fill="#fff" font-size="9" font-weight="700" font-family="monospace">${busNumber.slice(-4)}</text>
      </svg>`;
    return L.divIcon({
      html:        svg,
      className:   '',
      iconSize:    [size, size],
      iconAnchor:  [size/2, size/2],
    });
  }

  // ── 4. Fetch & update bus positions every 3s ──────────────────────────────────
  const fetchPositions = async () => {
    try {
      const data = await getBusPositions();
      setPositions(data.positions || []);
      setLastUpdate(new Date());
      setError('');
      updateBusMarkers(data.positions || []);
    } catch {
      setError('Cannot reach server on port 5000.');
    }
  };

  function updateBusMarkers(posList) {
    const L   = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const seen = new Set();

    posList.forEach(bus => {
      if (!bus.lat || !bus.lng) return;
      seen.add(bus.bus_id);
      const color    = routeColor(bus.route_id);
      const isSelected = selectedBus?.bus_id === bus.bus_id;
      const icon     = makeBusIcon(L, color, bus.bus_number, isSelected);
      const latlng   = [bus.lat, bus.lng];

      if (markersRef.current[bus.bus_id]) {
        // Smooth move
        markersRef.current[bus.bus_id].setLatLng(latlng);
        markersRef.current[bus.bus_id].setIcon(icon);
      } else {
        const marker = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(map);
        marker.on('click', () => {
          setSelectedBus(bus);
          setSelectedStop(null);
          setArrivals([]);
        });
        markersRef.current[bus.bus_id] = marker;
      }

      // Tooltip
      markersRef.current[bus.bus_id].bindTooltip(
        `<b>${bus.bus_number}</b><br/>At: ${bus.current_stop_name}<br/>Next: ${bus.next_stop_name || '—'}`,
        { className: 'krb-tooltip', direction: 'top' }
      );
    });

    // Remove stale markers
    Object.keys(markersRef.current).forEach(id => {
      if (!seen.has(parseInt(id))) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });
  }

  useEffect(() => {
    if (!mapReady) return;
    fetchPositions();
    const interval = setInterval(fetchPositions, 3000);
    return () => clearInterval(interval);
  }, [mapReady, selectedBus]);

  // ── 5. Re-render arrivals when selected stop changes ─────────────────────────
  useEffect(() => {
    if (!selectedStop) return;
    const interval = setInterval(() => {
      getArrivals(selectedStop.stop_id).then(d => setArrivals(d.arrivals || []));
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedStop]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }

        .krb-root {
          height: 100vh; width: 100vw;
          display: flex; flex-direction: column;
          background: #080b12;
          font-family: 'DM Sans', sans-serif;
          color: #e2e8f0;
          overflow: hidden;
        }

        /* ── Header ── */
        .krb-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.75rem 1.5rem;
          background: rgba(8,11,18,0.95);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(12px);
          z-index: 1000; flex-shrink: 0;
        }
        .krb-logo {
          font-family: 'Space Mono', monospace;
          font-size: 1rem; font-weight: 700;
          letter-spacing: 0.05em;
          display: flex; align-items: center; gap: 0.5rem;
        }
        .krb-logo .red { color: #ef4444; }
        .krb-badge {
          display: flex; align-items: center; gap: 0.4rem;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 20px; padding: 0.25rem 0.65rem;
          font-size: 0.72rem; font-weight: 700;
          color: #ef4444; letter-spacing: 0.08em;
        }
        .krb-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #ef4444;
          animation: blink 1.4s ease-in-out infinite;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .krb-nav { display: flex; gap: 0.5rem; }
        .krb-navlink {
          color: rgba(255,255,255,0.4); text-decoration: none;
          font-size: 0.8rem; padding: 0.35rem 0.8rem;
          border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);
          transition: all 0.15s;
        }
        .krb-navlink:hover { color:#fff; border-color:rgba(255,255,255,0.2); }

        /* ── Body ── */
        .krb-body {
          flex: 1; display: flex; min-height: 0;
        }

        /* ── Map ── */
        .krb-map {
          flex: 1; position: relative;
        }
        .krb-map-el {
          width: 100%; height: 100%;
        }
        .krb-map-loading {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          background: #080b12; z-index: 5;
          font-family: 'Space Mono', monospace;
          font-size: 0.85rem; color: rgba(255,255,255,0.3);
          letter-spacing: 0.1em;
        }
        .krb-timestamp {
          position: absolute; bottom: 1rem; left: 1rem; z-index: 500;
          font-size: 0.72rem; color: rgba(255,255,255,0.25);
          font-family: 'Space Mono', monospace;
          background: rgba(8,11,18,0.7);
          padding: 0.3rem 0.6rem; border-radius: 4px;
          pointer-events: none;
        }
        .krb-error {
          position: absolute; top: 1rem; left: 50%; transform: translateX(-50%);
          z-index: 600;
          background: rgba(185,28,28,0.9); border: 1px solid #ef4444;
          border-radius: 6px; padding: 0.5rem 1rem;
          font-size: 0.8rem; color: #fca5a5;
        }

        /* ── Sidebar ── */
        .krb-sidebar {
          width: 300px; flex-shrink: 0;
          background: #0d1117;
          border-left: 1px solid rgba(255,255,255,0.06);
          display: flex; flex-direction: column;
          overflow: hidden;
        }
        .krb-sidebar-tabs {
          display: flex; border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .krb-tab {
          flex: 1; padding: 0.75rem;
          font-size: 0.75rem; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          cursor: pointer; border: none; background: none;
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
        }
        .krb-tab.active { color: #ef4444; border-bottom-color: #ef4444; }

        .krb-sidebar-body { flex: 1; overflow-y: auto; padding: 1rem; }
        .krb-sidebar-body::-webkit-scrollbar { width: 4px; }
        .krb-sidebar-body::-webkit-scrollbar-track { background: transparent; }
        .krb-sidebar-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius:2px; }

        .krb-section-label {
          font-size: 0.68rem; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(255,255,255,0.25);
          margin-bottom: 0.75rem;
        }

        /* ── Bus cards ── */
        .krb-bus-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px; padding: 0.8rem;
          margin-bottom: 0.5rem; cursor: pointer;
          transition: all 0.15s;
        }
        .krb-bus-card:hover { background: rgba(255,255,255,0.06); }
        .krb-bus-card.active { border-color: #ef4444; background: rgba(239,68,68,0.06); }
        .krb-bus-top {
          display: flex; justify-content: space-between;
          align-items: center; margin-bottom: 0.35rem;
        }
        .krb-bus-num {
          font-family: 'Space Mono', monospace;
          font-size: 0.85rem; font-weight: 700;
        }
        .krb-bus-pip {
          width: 9px; height: 9px; border-radius: 50%;
        }
        .krb-bus-loc { font-size: 0.78rem; color: rgba(255,255,255,0.5); margin-bottom: 0.2rem; }
        .krb-bus-next { font-size: 0.73rem; color: rgba(255,255,255,0.3); }
        .krb-bus-prog {
          height: 2px; background: rgba(255,255,255,0.07);
          border-radius: 2px; margin-top: 0.5rem; overflow: hidden;
        }
        .krb-bus-prog-fill {
          height: 100%; border-radius: 2px;
          transition: width 1s linear;
        }

        /* ── Detail panel ── */
        .krb-detail {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px; padding: 0.9rem;
          margin-bottom: 1rem;
        }
        .krb-detail-title {
          font-family: 'Space Mono', monospace;
          font-size: 0.9rem; font-weight: 700;
          margin-bottom: 0.15rem;
        }
        .krb-detail-sub { font-size: 0.75rem; color: rgba(255,255,255,0.4); margin-bottom: 0.75rem; }
        .krb-detail-row {
          display: flex; justify-content: space-between;
          font-size: 0.78rem; padding: 0.3rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.6);
        }
        .krb-detail-row:last-child { border-bottom: none; }
        .krb-detail-row span:last-child { color: #e2e8f0; font-weight: 600; }

        /* ── Arrivals ── */
        .krb-arrival {
          display: flex; align-items: center;
          gap: 0.75rem; padding: 0.6rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .krb-arrival:last-child { border-bottom: none; }
        .krb-arrival-eta {
          font-family: 'Space Mono', monospace;
          font-size: 0.8rem; font-weight: 700;
          color: #22c55e; min-width: 40px;
        }
        .krb-arrival-eta.soon { color: #ef4444; }
        .krb-arrival-info { flex: 1; }
        .krb-arrival-bus { font-size: 0.82rem; font-weight: 600; }
        .krb-arrival-route { font-size: 0.72rem; color: rgba(255,255,255,0.35); }

        .krb-empty {
          text-align: center; color: rgba(255,255,255,0.2);
          font-size: 0.82rem; padding: 2rem 0;
        }

        /* ── Leaflet tooltip override ── */
        .krb-tooltip {
          background: rgba(13,17,23,0.95) !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          color: #e2e8f0 !important;
          font-family: 'DM Sans', sans-serif !important;
          font-size: 0.78rem !important;
          padding: 0.35rem 0.6rem !important;
          border-radius: 5px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
        }
        .krb-tooltip::before { display: none !important; }

        /* ── Legend ── */
        .krb-legend-item {
          display: flex; align-items: center;
          gap: 0.6rem; padding: 0.4rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          font-size: 0.8rem;
        }
        .krb-legend-swatch {
          width: 24px; height: 3px; border-radius: 2px; flex-shrink: 0;
        }

        @media (max-width: 700px) {
          .krb-sidebar { width: 100%; max-height: 260px; border-left: none; border-top: 1px solid rgba(255,255,255,0.06); }
          .krb-body { flex-direction: column; }
        }
      `}</style>

      <div className="krb-root">
        {/* Header */}
        <header className="krb-header">
          <div className="krb-logo">🚌 Karachi <span className="red">Red</span> Bus</div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <div className="krb-badge"><div className="krb-dot"/>LIVE</div>
            <nav className="krb-nav">
              <a href="/" className="krb-navlink">Route Finder</a>
              <a href="/login" className="krb-navlink">Admin →</a>
            </nav>
          </div>
        </header>

        <div className="krb-body">
          {/* Map */}
          <div className="krb-map">
            {!mapReady && (
              <div className="krb-map-loading">LOADING MAP…</div>
            )}
            {error && <div className="krb-error">⚠ {error}</div>}
            <div ref={mapDivRef} className="krb-map-el" />
            {lastUpdate && (
              <div className="krb-timestamp">
                Updated {lastUpdate.toLocaleTimeString()} · refreshes every 3s
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="krb-sidebar">
            <div className="krb-sidebar-tabs">
              <button className="krb-tab active">Buses & Stops</button>
            </div>
            <div className="krb-sidebar-body">

              {/* Selected bus detail */}
              {selectedBus && (
                <>
                  <div className="krb-section-label">Selected Bus</div>
                  <div className="krb-detail" style={{ borderColor: `${routeColor(selectedBus.route_id)}44` }}>
                    <div className="krb-detail-title">{selectedBus.bus_number}</div>
                    <div className="krb-detail-sub">Route ID {selectedBus.route_id}</div>
                    <div className="krb-detail-row"><span>At stop</span><span>{selectedBus.current_stop_name}</span></div>
                    <div className="krb-detail-row"><span>Next stop</span><span>{selectedBus.next_stop_name || '—'}</span></div>
                    <div className="krb-detail-row"><span>Direction</span><span>{selectedBus.direction}</span></div>
                    <div className="krb-detail-row"><span>Progress</span><span>{selectedBus.progress_pct}%</span></div>
                  </div>
                </>
              )}

              {/* Selected stop arrivals */}
              {selectedStop && (
                <>
                  <div className="krb-section-label">📍 {selectedStop.stop_name}</div>
                  <div className="krb-detail">
                    <div className="krb-detail-title">{selectedStop.stop_name}</div>
                    <div className="krb-detail-sub">{selectedStop.landmark}</div>
                    {arrivals.length === 0
                      ? <div className="krb-empty">No buses arriving soon</div>
                      : arrivals.map(a => (
                          <div key={a.bus_id} className="krb-arrival">
                            <div className={`krb-arrival-eta ${a.eta_minutes <= 3 ? 'soon' : ''}`}>
                              {a.eta_minutes === 0 ? 'NOW' : `${a.eta_minutes}m`}
                            </div>
                            <div className="krb-arrival-info">
                              <div className="krb-arrival-bus">{a.bus_number}</div>
                              <div className="krb-arrival-route">Route {a.route_id}</div>
                            </div>
                            <div style={{ width:9, height:9, borderRadius:'50%', background: routeColor(a.route_id), flexShrink:0 }}/>
                          </div>
                        ))
                    }
                  </div>
                </>
              )}

              {/* Active buses list */}
              <div className="krb-section-label" style={{ marginTop: selectedBus || selectedStop ? '1rem' : 0 }}>
                Active Buses ({positions.length})
              </div>
              {positions.length === 0 && !error && (
                <div className="krb-empty">Connecting to server…</div>
              )}
              {positions.map(bus => {
                const color = routeColor(bus.route_id);
                return (
                  <div
                    key={bus.bus_id}
                    className={`krb-bus-card ${selectedBus?.bus_id === bus.bus_id ? 'active' : ''}`}
                    onClick={() => { setSelectedBus(bus); setSelectedStop(null); setArrivals([]); }}
                  >
                    <div className="krb-bus-top">
                      <div className="krb-bus-num">{bus.bus_number}</div>
                      <div className="krb-bus-pip" style={{ background: color }} />
                    </div>
                    <div className="krb-bus-loc">📍 {bus.current_stop_name}</div>
                    {bus.next_stop_name && (
                      <div className="krb-bus-next">→ {bus.next_stop_name}</div>
                    )}
                    <div className="krb-bus-prog">
                      <div className="krb-bus-prog-fill"
                        style={{ width: `${bus.progress_pct || 0}%`, background: color }} />
                    </div>
                  </div>
                );
              })}

              {/* Route legend */}
              <div className="krb-section-label" style={{ marginTop:'1.5rem' }}>Route Legend</div>
              {Object.entries(ROUTE_COLORS).map(([code, color]) => (
                <div key={code} className="krb-legend-item">
                  <div className="krb-legend-swatch" style={{ background: color }} />
                  <span style={{ fontWeight:600, fontSize:'0.82rem' }}>{code}</span>
                </div>
              ))}

            </div>
          </aside>
        </div>
      </div>
    </>
  );
}