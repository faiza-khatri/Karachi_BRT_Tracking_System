import { useState, useEffect, useRef } from 'react';
import { getBusPositions } from '../api';

const BASE = 'http://localhost:5000/api';
const getStops        = () => fetch(`${BASE}/stops`).then(r => r.json());
const getArrivals     = (stopId) => fetch(`${BASE}/stop/${stopId}/arrivals`).then(r => r.json());
const getAllRouteStops = () => fetch(`${BASE}/routes/all-stops`).then(r => r.json());

const ROUTE_COLORS = {
  'R-1': '#ef4444', 'R-3': '#f59e0b', 'R-6': '#22c55e',
  'K-4': '#8b5cf6', 'P-1': '#ec4899', 'EV-1': '#06b6d4',
};
const COLOR_PALETTE = ['#ef4444','#f59e0b','#22c55e','#8b5cf6','#ec4899','#06b6d4','#f97316'];
const routeColor     = (routeId) => COLOR_PALETTE[(routeId - 1) % COLOR_PALETTE.length];
const routeCodeColor = (code) => ROUTE_COLORS[code] || '#94a3b8';

export default function LiveMap() {
  const mapRef         = useRef(null);
  const mapDivRef      = useRef(null);
  const markersRef     = useRef({});       // busId → {marker, bus}
  const stopMarkersRef = useRef({});       // stopId → {circle, label}
  const polylineRefs   = useRef({});       // routeId → L.polyline
  const LRef           = useRef(null);

  const [positions,     setPositions]     = useState([]);
  const [routeLines,    setRouteLines]    = useState([]);
  const [visibleRoutes, setVisibleRoutes] = useState({});
  const [selectedBus,   setSelectedBus]  = useState(null);
  const [selectedStop,  setSelectedStop] = useState(null);
  const [arrivals,      setArrivals]     = useState([]);
  const [lastUpdate,    setLastUpdate]   = useState(null);
  const [error,         setError]        = useState('');
  const [mapReady,      setMapReady]     = useState(false);
  const [activeTab,     setActiveTab]    = useState('buses');

  // ── 1. Load Leaflet ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css'; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
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
      center: [24.8900, 67.0600],
      zoom: 12,
      zoomControl: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;
    setMapReady(true);
  }

  // ── 2. Load routes + stops once map ready ─────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;

    // Load stops for markers
    getStops().then(data => {
      renderStopMarkers(data.stops || []);
    }).catch(e => console.error('Stops fetch failed:', e));

    // Load route polylines
    getAllRouteStops().then(data => {
      const routes = data.routes || [];
      setRouteLines(routes);
      const vis = {};
      routes.forEach(r => { vis[r.route_id] = true; });
      setVisibleRoutes(vis);
      drawRoutePolylines(routes, vis);
    }).catch(e => console.error('Route lines fetch failed:', e));
  }, [mapReady]);

  // ── 3. Draw route polylines ───────────────────────────────────────────────
  function drawRoutePolylines(routes, vis) {
    const L = LRef.current, map = mapRef.current;
    if (!L || !map) return;
    Object.values(polylineRefs.current).forEach(pl => {
      if (pl.decorator) map.removeLayer(pl.decorator);
      map.removeLayer(pl);
    });
    polylineRefs.current = {};

    routes.forEach(route => {
      const color   = routeCodeColor(route.route_code);
      const latlngs = route.stops
        .filter(s => s.lat && s.lng && isFinite(parseFloat(s.lat)) && isFinite(parseFloat(s.lng)))
        .map(s => [parseFloat(s.lat), parseFloat(s.lng)]);
      if (latlngs.length < 2) return;

      // Draw a subtle glow (wider, low opacity) + sharp line on top
      L.polyline(latlngs, {
        color, weight: 8, opacity: 0.08, smoothFactor: 1,
      }).addTo(map);

      const pl = L.polyline(latlngs, {
        color, weight: 2.5,
        opacity: vis[route.route_id] ? 0.75 : 0,
        smoothFactor: 1,
        dashArray: null,
      }).addTo(map);

      pl.bindTooltip(`<b>${route.route_code}</b> · ${route.category}<br/>${route.stops.length} stops`, {
        sticky: true, className: 'krb-tooltip',
      });

      polylineRefs.current[route.route_id] = pl;
    });
  }

  // ── 4. Stop markers ────────────────────────────────────────────────────────
  function renderStopMarkers(stopList) {
    const L = LRef.current, map = mapRef.current;
    if (!L || !map) return;

    // Clear old
    Object.values(stopMarkersRef.current).forEach(({ circle }) => map.removeLayer(circle));
    stopMarkersRef.current = {};

    stopList.forEach(stop => {
      const lat = parseFloat(stop.latitude);
      const lng = parseFloat(stop.longitude);
      if (!isFinite(lat) || !isFinite(lng)) return;

      // Outer ring
      const circle = L.circleMarker([lat, lng], {
        radius: 5, color: 'rgba(255,255,255,0.6)', weight: 1.5,
        fillColor: '#0d1117', fillOpacity: 1,
        interactive: true,
      }).addTo(map);

      // Inner dot
      L.circleMarker([lat, lng], {
        radius: 2, color: 'transparent', weight: 0,
        fillColor: 'rgba(255,255,255,0.5)', fillOpacity: 1,
        interactive: false,
      }).addTo(map);

      circle.bindTooltip(
        `<b>${stop.stop_name}</b><br/><span style="opacity:0.6">${stop.landmark || ''}</span>`,
        { permanent: false, direction: 'top', className: 'krb-tooltip' }
      );

      circle.on('click', () => {
        setSelectedStop(stop);
        setSelectedBus(null);
        setArrivals([]);
        setActiveTab('buses');
        getArrivals(stop.stop_id).then(d => setArrivals(d.arrivals || []));
        // Highlight the clicked stop
        Object.values(stopMarkersRef.current).forEach(({ circle: c }) =>
          c.setStyle({ color: 'rgba(255,255,255,0.6)', fillColor: '#0d1117' })
        );
        circle.setStyle({ color: '#ef4444', fillColor: '#ef4444' });
      });

      stopMarkersRef.current[stop.stop_id] = { circle, stop };
    });
  }

  // ── 5. Bus icon ────────────────────────────────────────────────────────────
  function makeBusIcon(L, color, busNumber, isSelected) {
    const size = isSelected ? 40 : 30;
    const label = busNumber.replace('BUS-', '');
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        ${isSelected ? `
        <circle cx="20" cy="20" r="19" fill="${color}" opacity="0.15">
          <animate attributeName="r" from="19" to="28" dur="1.4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.15" to="0" dur="1.4s" repeatCount="indefinite"/>
        </circle>` : ''}
        <circle cx="20" cy="20" r="${isSelected ? 17 : 13}" fill="${color}" stroke="#0d1117" stroke-width="2"/>
        <text x="20" y="${isSelected ? 25 : 24}" text-anchor="middle" fill="#fff"
          font-size="${isSelected ? 9 : 8}" font-weight="800" font-family="monospace"
          letter-spacing="-0.5">${label}</text>
      </svg>`;
    return L.divIcon({ html: svg, className: '', iconSize: [size, size], iconAnchor: [size/2, size/2] });
  }

  // ── 6. Update bus markers ──────────────────────────────────────────────────
  function updateBusMarkers(posList) {
    const L = LRef.current, map = mapRef.current;
    if (!L || !map) return;
    const seen = new Set();

    posList.forEach(bus => {
      if (!bus.lat || !bus.lng) return;
      seen.add(bus.bus_id);
      const color      = routeCodeColor(
        routeLines.find(r => r.route_id === bus.route_id)?.route_code || ''
      ) || routeColor(bus.route_id);
      const isSelected = selectedBus?.bus_id === bus.bus_id;
      const icon       = makeBusIcon(L, color, bus.bus_number, isSelected);
      const latlng     = [parseFloat(bus.lat), parseFloat(bus.lng)];
      const isVisible  = visibleRoutes[bus.route_id] !== false;

      if (markersRef.current[bus.bus_id]) {
        markersRef.current[bus.bus_id].marker.setLatLng(latlng);
        markersRef.current[bus.bus_id].marker.setIcon(icon);
        if (!isVisible) map.removeLayer(markersRef.current[bus.bus_id].marker);
        else if (!map.hasLayer(markersRef.current[bus.bus_id].marker))
          markersRef.current[bus.bus_id].marker.addTo(map);
      } else {
        const marker = L.marker(latlng, { icon, zIndexOffset: 1000 });
        if (isVisible) marker.addTo(map);
        marker.on('click', () => {
          setSelectedBus(bus);
          setSelectedStop(null);
          setArrivals([]);
          setActiveTab('buses');
        });
        markersRef.current[bus.bus_id] = { marker, bus };
      }

      markersRef.current[bus.bus_id].bus = bus;
      markersRef.current[bus.bus_id].marker.bindTooltip(
        `<b>${bus.bus_number}</b> · ${routeLines.find(r=>r.route_id===bus.route_id)?.route_code||''}` +
        `<br/>📍 ${bus.current_stop_name}` +
        `<br/>→ ${bus.next_stop_name || '—'}`,
        { className: 'krb-tooltip', direction: 'top' }
      );
    });

    Object.keys(markersRef.current).forEach(id => {
      if (!seen.has(parseInt(id))) {
        map.removeLayer(markersRef.current[id].marker);
        delete markersRef.current[id];
      }
    });
  }

  // ── 7. Poll positions every 2s ────────────────────────────────────────────
  const fetchPositions = async () => {
    try {
      const data = await getBusPositions();
      const pos  = data.positions || [];
      setPositions(pos);
      setLastUpdate(new Date());
      setError('');
      updateBusMarkers(pos);
    } catch {
      setError('Cannot reach server on port 5000.');
    }
  };

  useEffect(() => {
    if (!mapReady) return;
    fetchPositions();
    const iv = setInterval(fetchPositions, 2000);
    return () => clearInterval(iv);
  }, [mapReady, selectedBus, routeLines, visibleRoutes]);

  // ── 8. Arrivals refresh ───────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedStop) return;
    const iv = setInterval(() =>
      getArrivals(selectedStop.stop_id).then(d => setArrivals(d.arrivals || [])), 4000
    );
    return () => clearInterval(iv);
  }, [selectedStop]);

  // ── 9. Route toggle ───────────────────────────────────────────────────────
  function toggleRoute(routeId) {
    setVisibleRoutes(prev => {
      const next = { ...prev, [routeId]: !prev[routeId] };
      const pl = polylineRefs.current[routeId];
      if (pl) pl.setStyle({ opacity: next[routeId] ? 0.75 : 0 });
      Object.values(markersRef.current).forEach(({ marker, bus }) => {
        if (bus.route_id === routeId) {
          if (next[routeId]) marker.addTo(mapRef.current);
          else mapRef.current.removeLayer(marker);
        }
      });
      return next;
    });
  }

  function toggleAllRoutes(visible) {
    setVisibleRoutes(prev => {
      const next = {};
      Object.keys(prev).forEach(id => { next[id] = visible; });
      Object.values(polylineRefs.current).forEach(pl => pl.setStyle({ opacity: visible ? 0.75 : 0 }));
      Object.values(markersRef.current).forEach(({ marker, bus }) => {
        const show = visible;
        if (show) marker.addTo(mapRef.current);
        else mapRef.current.removeLayer(marker);
      });
      return next;
    });
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap');
        #root { width:100% !important; max-width:100% !important; margin:0 !important; border:none !important; text-align:left !important; }
        * { margin:0; padding:0; box-sizing:border-box; }

        .krb-root { height:100vh; width:100%; display:flex; flex-direction:column; background:#080b12; font-family:'DM Sans',sans-serif; color:#e2e8f0; overflow:hidden; }

        .krb-header { display:flex; align-items:center; justify-content:space-between; padding:0.7rem 1.5rem; background:rgba(8,11,18,0.97); border-bottom:1px solid rgba(255,255,255,0.07); z-index:1000; flex-shrink:0; }
        .krb-logo { font-family:'Space Mono',monospace; font-size:0.95rem; font-weight:700; letter-spacing:0.05em; display:flex; align-items:center; gap:0.5rem; }
        .krb-logo .red { color:#ef4444; }
        .krb-badge { display:flex; align-items:center; gap:0.4rem; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); border-radius:20px; padding:0.22rem 0.6rem; font-size:0.7rem; font-weight:700; color:#ef4444; letter-spacing:0.08em; }
        .krb-dot { width:6px; height:6px; border-radius:50%; background:#ef4444; animation:blink 1.4s ease-in-out infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
        .krb-nav { display:flex; gap:0.4rem; }
        .krb-navlink { color:rgba(255,255,255,0.35); text-decoration:none; font-size:0.78rem; padding:0.3rem 0.75rem; border-radius:6px; border:1px solid rgba(255,255,255,0.08); transition:all 0.15s; }
        .krb-navlink:hover { color:#fff; border-color:rgba(255,255,255,0.2); }

        .krb-body { flex:1; display:flex; width:100%; min-height:0; overflow:hidden; }

        .krb-map { flex:1; position:relative; min-width:0; }
        .krb-map-el { width:100%; height:100%; }
        .krb-map-loading { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:#080b12; z-index:5; font-family:'Space Mono',monospace; font-size:0.82rem; color:rgba(255,255,255,0.25); letter-spacing:0.12em; }
        .krb-timestamp { position:absolute; bottom:0.75rem; left:0.75rem; z-index:500; font-size:0.68rem; color:rgba(255,255,255,0.2); font-family:'Space Mono',monospace; background:rgba(8,11,18,0.8); padding:0.25rem 0.5rem; border-radius:4px; pointer-events:none; }
        .krb-error { position:absolute; top:1rem; left:50%; transform:translateX(-50%); z-index:600; background:rgba(185,28,28,0.95); border:1px solid #ef4444; border-radius:6px; padding:0.45rem 1rem; font-size:0.78rem; color:#fca5a5; white-space:nowrap; }

        .krb-sidebar { width:290px; flex-shrink:0; background:#0a0d14; border-left:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; overflow:hidden; }
        .krb-sidebar-tabs { display:flex; border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0; }
        .krb-tab { flex:1; padding:0.7rem; font-size:0.72rem; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.25); cursor:pointer; border:none; background:none; border-bottom:2px solid transparent; transition:all 0.15s; }
        .krb-tab.active { color:#ef4444; border-bottom-color:#ef4444; }

        .krb-sidebar-body { flex:1; overflow-y:auto; padding:0.9rem; }
        .krb-sidebar-body::-webkit-scrollbar { width:3px; }
        .krb-sidebar-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }

        .krb-section-label { font-size:0.65rem; font-weight:700; letter-spacing:0.13em; text-transform:uppercase; color:rgba(255,255,255,0.2); margin-bottom:0.6rem; margin-top:0.1rem; }

        /* Bus cards */
        .krb-bus-card { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:0.75rem; margin-bottom:0.45rem; cursor:pointer; transition:all 0.15s; }
        .krb-bus-card:hover { background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.12); }
        .krb-bus-card.active { border-color:#ef4444; background:rgba(239,68,68,0.05); }
        .krb-bus-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem; }
        .krb-bus-num { font-family:'Space Mono',monospace; font-size:0.82rem; font-weight:700; }
        .krb-bus-route-tag { font-size:0.68rem; padding:0.1rem 0.4rem; border-radius:3px; font-weight:700; }
        .krb-bus-loc { font-size:0.75rem; color:rgba(255,255,255,0.45); margin-bottom:0.15rem; }
        .krb-bus-next { font-size:0.7rem; color:rgba(255,255,255,0.25); }
        .krb-bus-prog { height:2px; background:rgba(255,255,255,0.06); border-radius:2px; margin-top:0.45rem; overflow:hidden; }
        .krb-bus-prog-fill { height:100%; border-radius:2px; transition:width 1.5s linear; }

        /* Detail panel */
        .krb-detail { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:0.85rem; margin-bottom:0.9rem; }
        .krb-detail-title { font-family:'Space Mono',monospace; font-size:0.88rem; font-weight:700; margin-bottom:0.1rem; }
        .krb-detail-sub { font-size:0.72rem; color:rgba(255,255,255,0.35); margin-bottom:0.65rem; }
        .krb-detail-row { display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; padding:0.28rem 0; border-bottom:1px solid rgba(255,255,255,0.04); color:rgba(255,255,255,0.5); }
        .krb-detail-row:last-child { border-bottom:none; }
        .krb-detail-row span:last-child { color:#e2e8f0; font-weight:600; text-align:right; max-width:55%; }

        /* Arrivals */
        .krb-arrival { display:flex; align-items:center; gap:0.65rem; padding:0.5rem 0; border-bottom:1px solid rgba(255,255,255,0.04); }
        .krb-arrival:last-child { border-bottom:none; }
        .krb-arrival-eta { font-family:'Space Mono',monospace; font-size:0.78rem; font-weight:700; color:#22c55e; min-width:36px; }
        .krb-arrival-eta.soon { color:#ef4444; }
        .krb-arrival-bus { font-size:0.8rem; font-weight:600; }
        .krb-arrival-route { font-size:0.68rem; color:rgba(255,255,255,0.3); }

        /* Route rows */
        .krb-route-row { display:flex; align-items:center; gap:0.55rem; padding:0.55rem 0.5rem; border-radius:6px; cursor:pointer; transition:all 0.15s; margin-bottom:0.2rem; }
        .krb-route-row:hover { background:rgba(255,255,255,0.04); }
        .krb-route-row.hidden { opacity:0.35; }
        .krb-route-swatch { width:20px; height:3px; border-radius:2px; flex-shrink:0; }
        .krb-route-name { font-size:0.82rem; font-weight:700; flex:1; font-family:'Space Mono',monospace; }
        .krb-route-meta { font-size:0.68rem; color:rgba(255,255,255,0.3); }
        .krb-toggle-all { display:flex; gap:0.35rem; margin-bottom:0.65rem; }
        .krb-toggle-btn { flex:1; padding:0.3rem; border-radius:5px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02); color:rgba(255,255,255,0.4); font-size:0.7rem; cursor:pointer; transition:all 0.15s; }
        .krb-toggle-btn:hover { background:rgba(255,255,255,0.07); color:#fff; }
        .krb-check { width:14px; height:14px; border-radius:3px; border:1px solid rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:9px; color:#fff; transition:all 0.15s; }
        .krb-check.on { background:#ef4444; border-color:#ef4444; }

        .krb-empty { text-align:center; color:rgba(255,255,255,0.15); font-size:0.8rem; padding:1.5rem 0; }
        .krb-divider { height:1px; background:rgba(255,255,255,0.05); margin:0.75rem 0; }

        /* Leaflet tooltip */
        .krb-tooltip.leaflet-tooltip { background:rgba(10,13,20,0.97) !important; border:1px solid rgba(255,255,255,0.1) !important; color:#e2e8f0 !important; font-family:'DM Sans',sans-serif !important; font-size:0.76rem !important; padding:0.3rem 0.55rem !important; border-radius:5px !important; box-shadow:0 4px 16px rgba(0,0,0,0.6) !important; line-height:1.5 !important; }
        .krb-tooltip.leaflet-tooltip::before { display:none !important; }

        @media (max-width:700px) {
          .krb-sidebar { width:100%; max-height:240px; border-left:none; border-top:1px solid rgba(255,255,255,0.06); }
          .krb-body { flex-direction:column; }
        }
      `}</style>

      <div className="krb-root">
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
          {/* ── Map ── */}
          <div className="krb-map">
            {!mapReady && <div className="krb-map-loading">LOADING MAP…</div>}
            {error    && <div className="krb-error">⚠ {error}</div>}
            <div ref={mapDivRef} className="krb-map-el" />
            {lastUpdate && (
              <div className="krb-timestamp">
                📡 {lastUpdate.toLocaleTimeString()} · pings every 2s
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="krb-sidebar">
            <div className="krb-sidebar-tabs">
              <button className={`krb-tab ${activeTab==='buses'?'active':''}`}
                onClick={() => setActiveTab('buses')}>
                Buses {positions.length > 0 && `(${positions.length})`}
              </button>
              <button className={`krb-tab ${activeTab==='routes'?'active':''}`}
                onClick={() => setActiveTab('routes')}>
                Routes {routeLines.length > 0 && `(${routeLines.length})`}
              </button>
            </div>

            <div className="krb-sidebar-body">

              {/* ── BUSES TAB ── */}
              {activeTab === 'buses' && (<>

                {/* Selected bus detail */}
                {selectedBus && (() => {
                  const routeCode = routeLines.find(r => r.route_id === selectedBus.route_id)?.route_code || '';
                  const color     = routeCodeColor(routeCode) || routeColor(selectedBus.route_id);
                  return (<>
                    <div className="krb-section-label">Selected Bus</div>
                    <div className="krb-detail" style={{ borderColor:`${color}33` }}>
                      <div className="krb-detail-title">{selectedBus.bus_number}</div>
                      <div className="krb-detail-sub" style={{ color }}>Route {routeCode}</div>
                      <div className="krb-detail-row"><span>At stop</span><span>{selectedBus.current_stop_name}</span></div>
                      <div className="krb-detail-row"><span>Next stop</span><span>{selectedBus.next_stop_name || '—'}</span></div>
                      <div className="krb-detail-row"><span>Direction</span><span>{selectedBus.direction}</span></div>
                      <div className="krb-detail-row">
                        <span>Leg progress</span>
                        <span>{selectedBus.progress_pct}%</span>
                      </div>
                      <div className="krb-bus-prog" style={{ marginTop:'0.65rem' }}>
                        <div className="krb-bus-prog-fill"
                          style={{ width:`${selectedBus.progress_pct||0}%`, background:color }}/>
                      </div>
                    </div>
                    <div className="krb-divider"/>
                  </>);
                })()}

                {/* Selected stop arrivals */}
                {selectedStop && (<>
                  <div className="krb-section-label">📍 {selectedStop.stop_name}</div>
                  <div className="krb-detail">
                    <div className="krb-detail-title">{selectedStop.stop_name}</div>
                    <div className="krb-detail-sub">{selectedStop.landmark}</div>
                    {arrivals.length === 0
                      ? <div className="krb-empty">No buses arriving soon</div>
                      : arrivals.slice(0,5).map(a => {
                          const rc = routeLines.find(r=>r.route_id===a.route_id)?.route_code||'';
                          const c  = routeCodeColor(rc);
                          return (
                            <div key={a.bus_id} className="krb-arrival">
                              <div className={`krb-arrival-eta ${a.eta_minutes<=2?'soon':''}`}>
                                {a.eta_minutes===0?'NOW':`${a.eta_minutes}m`}
                              </div>
                              <div style={{flex:1}}>
                                <div className="krb-arrival-bus">{a.bus_number}</div>
                                <div className="krb-arrival-route"
                                  style={{ color:c }}>{rc}</div>
                              </div>
                              <div style={{ width:8,height:8,borderRadius:'50%',background:c,flexShrink:0 }}/>
                            </div>
                          );
                        })
                    }
                  </div>
                  <div className="krb-divider"/>
                </>)}

                {/* Bus list */}
                <div className="krb-section-label">
                  Active Buses
                </div>
                {positions.length === 0 && !error && (
                  <div className="krb-empty">Connecting…</div>
                )}
                {positions.map(bus => {
                  const rc    = routeLines.find(r=>r.route_id===bus.route_id)?.route_code||'';
                  const color = routeCodeColor(rc) || routeColor(bus.route_id);
                  return (
                    <div key={bus.bus_id}
                      className={`krb-bus-card ${selectedBus?.bus_id===bus.bus_id?'active':''}`}
                      onClick={() => { setSelectedBus(bus); setSelectedStop(null); setArrivals([]); }}>
                      <div className="krb-bus-top">
                        <div className="krb-bus-num">{bus.bus_number}</div>
                        <div className="krb-bus-route-tag"
                          style={{ background:`${color}22`, color, border:`1px solid ${color}44` }}>
                          {rc}
                        </div>
                      </div>
                      <div className="krb-bus-loc">📍 {bus.current_stop_name}</div>
                      {bus.next_stop_name &&
                        <div className="krb-bus-next">→ {bus.next_stop_name}</div>}
                      <div className="krb-bus-prog">
                        <div className="krb-bus-prog-fill"
                          style={{ width:`${bus.progress_pct||0}%`, background:color }}/>
                      </div>
                    </div>
                  );
                })}
              </>)}

              {/* ── ROUTES TAB ── */}
              {activeTab === 'routes' && (<>
                <div className="krb-section-label">Toggle Route Lines</div>
                <div className="krb-toggle-all">
                  <button className="krb-toggle-btn" onClick={() => toggleAllRoutes(true)}>Show all</button>
                  <button className="krb-toggle-btn" onClick={() => toggleAllRoutes(false)}>Hide all</button>
                </div>

                {routeLines.map(route => {
                  const color   = routeCodeColor(route.route_code);
                  const visible = visibleRoutes[route.route_id] !== false;
                  const busesOnRoute = positions.filter(b => b.route_id === route.route_id);
                  return (
                    <div key={route.route_id}
                      className={`krb-route-row ${!visible?'hidden':''}`}
                      onClick={() => toggleRoute(route.route_id)}>
                      <div className={`krb-check ${visible?'on':''}`}>{visible?'✓':''}</div>
                      <div className="krb-route-swatch" style={{ background:color }}/>
                      <div style={{flex:1}}>
                        <div className="krb-route-name" style={{ color:visible?color:'inherit' }}>
                          {route.route_code}
                        </div>
                        <div className="krb-route-meta">
                          {route.category} · {route.stops.length} stops · {busesOnRoute.length} buses
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="krb-divider"/>
                <div className="krb-section-label">Stop Legend</div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.4rem 0', fontSize:'0.75rem', color:'rgba(255,255,255,0.4)' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <circle cx="7" cy="7" r="6" fill="#0d1117" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
                    <circle cx="7" cy="7" r="2.5" fill="rgba(255,255,255,0.5)"/>
                  </svg>
                  Bus stop — click to see arrivals
                </div>
              </>)}

            </div>
          </aside>
        </div>
      </div>
    </>
  );
}