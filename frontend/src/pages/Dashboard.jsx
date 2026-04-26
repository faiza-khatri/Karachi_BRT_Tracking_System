import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getRoutes, createRoute, deleteRoute,
  getStations, createStation, deleteStation,
  getBuses, createBus, deleteBus,
  adminLogout,
} from '../api';

const BASE  = 'http://localhost:5000/api';
const token = () => localStorage.getItem('adminToken');
const authH = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` });

const getStats        = () => fetch(`${BASE}/stats`).then(r => r.json());
const getAllStops      = () => fetch(`${BASE}/stops`).then(r => r.json());
const getRouteStops   = (id) => fetch(`${BASE}/routes/${id}/stops`).then(r => r.json());
const addRouteStop    = (routeId, stopId, seq, time) =>
  fetch(`${BASE}/routes/${routeId}/stops`, {
    method: 'POST', headers: authH(),
    body: JSON.stringify({ stop_id: stopId, stop_sequence: seq, travel_time_from_prev_mins: time }),
  }).then(r => r.json());
const removeRouteStop = (routeId, rsId) =>
  fetch(`${BASE}/routes/${routeId}/stops/${rsId}`, { method: 'DELETE', headers: authH() }).then(r => r.json());
const addBusToRoute   = (busNumber, routeId) =>
  fetch(`${BASE}/buses`, {
    method: 'POST', headers: authH(),
    body: JSON.stringify({ bus_number: busNumber, route_id: routeId }),
  }).then(r => r.json());

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-info">
        <div className="stat-value">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Route Editor Modal ───────────────────────────────────────────────────────
// Full editor: stops in sequence, travel times, buses assigned — all in one place
function RouteEditor({ route, allStops, buses, onClose, onRefresh }) {
  const [routeStops, setRouteStops] = useState([]);
  const [routeBuses, setRouteBuses] = useState([]);
  const [addStopId,  setAddStopId]  = useState('');
  const [addTime,    setAddTime]    = useState('5');
  const [addBusNum,  setAddBusNum]  = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const refresh = useCallback(() => {
    getRouteStops(route.id).then(d => setRouteStops(d.stops || []));
    setRouteBuses(buses.filter(b => b.route_id == route.id));
  }, [route.id, buses]);

  useEffect(() => { refresh(); }, [refresh]);

  const usedStopIds = new Set(routeStops.map(s => s.stop_id));
  const available   = allStops.filter(s => !usedStopIds.has(s.stop_id));

  const handleAddStop = async () => {
    if (!addStopId) { setError('Select a stop.'); return; }
    setLoading(true); setError('');
    const seq = routeStops.length + 1;
    const res = await addRouteStop(route.id, parseInt(addStopId), seq, parseInt(addTime) || 5);
    if (res.error) setError(res.error);
    else { setAddStopId(''); refresh(); onRefresh(); }
    setLoading(false);
  };

  const handleRemoveStop = async (rsId) => {
    await removeRouteStop(route.id, rsId);
    refresh(); onRefresh();
  };

  const handleAddBus = async () => {
    if (!busForm.bus_number.trim() || !busForm.route_id) { setFormError('Bus number and route required.'); return; }
    setLoading(true); setFormError('');
    const res = await createBus(busForm);
    if (res.error) { setFormError(res.error); setLoading(false); return; }
    // Tell simulation to pick up the new bus
    await fetch(`${BASE}/simulation/reload`, { method: 'POST', headers: authH() }).catch(() => {});
    setBusForm({ bus_number:'', route_id:'' });
    refreshAll();
    setLoading(false);
  };

  const handleRemoveBus = async (busId) => {
    await fetch(`${BASE}/buses/${busId}`, { method: 'DELETE', headers: authH() });
    refresh(); onRefresh();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{route.route_code}</div>
            <div className="modal-sub">{route.start_point} → {route.end_point} · {route.category}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="err-box">{error}</div>}

        {/* ── Stop sequence ── */}
        <div className="modal-section-label">Stop Sequence ({routeStops.length} stops)</div>
        <div className="stop-list">
          {routeStops.length === 0 && (
            <div className="modal-empty">No stops yet — add below</div>
          )}
          {routeStops.map((s, i) => (
            <div key={s.route_stop_id} className="stop-row">
              <div className="stop-seq">{s.stop_sequence}</div>
              <div className="stop-connector">
                {i < routeStops.length - 1 && <div className="stop-line"/>}
              </div>
              <div className="stop-dot"/>
              <div className="stop-info">
                <div className="stop-name">{s.stop_name}</div>
                <div className="stop-time">
                  {i === 0 ? 'Start' : `+${s.travel_time_from_prev_mins} min from prev`}
                </div>
              </div>
              <button className="stop-remove" onClick={() => handleRemoveStop(s.route_stop_id)}>✕</button>
            </div>
          ))}
        </div>

        {/* Add stop */}
        <div className="modal-add-row">
          <select className="modal-select" value={addStopId} onChange={e => setAddStopId(e.target.value)}>
            <option value="">+ Add stop…</option>
            {available.map(s => <option key={s.stop_id} value={s.stop_id}>{s.stop_name}</option>)}
          </select>
          <input className="modal-input-sm" type="number" placeholder="mins" min="1" max="120"
            value={addTime} onChange={e => setAddTime(e.target.value)} />
          <button className="modal-add-btn" onClick={handleAddStop} disabled={loading}>Add</button>
        </div>

        <div className="modal-divider"/>

        {/* ── Buses ── */}
        <div className="modal-section-label">Buses on this route ({routeBuses.length})</div>
        <div className="bus-list">
          {routeBuses.length === 0 && <div className="modal-empty">No buses assigned</div>}
          {routeBuses.map(b => (
            <div key={b.id} className="bus-row">
              <span className="bus-tag">🚌 {b.bus_number}</span>
              <button className="stop-remove" onClick={() => handleRemoveBus(b.id)}>✕</button>
            </div>
          ))}
        </div>
        <div className="modal-add-row">
          <input className="modal-input" placeholder="Bus number e.g. BUS-104"
            value={addBusNum} onChange={e => setAddBusNum(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddBus()} />
          <button className="modal-add-btn" onClick={handleAddBus} disabled={loading}>Add Bus</button>
        </div>
      </div>
    </div>
  );
}

// Replace the entire NewRouteWizard function in Dashboard.jsx with this.
// The only change from the original is Step 1: start_point and end_point
// are now <select> dropdowns populated from allStops instead of free-text inputs.

function NewRouteWizard({ allStops, onClose, onDone }) {
  const [step,       setStep]       = useState(1);
  const [form,       setForm]       = useState({ route_code:'', start_point:'', end_point:'', category:'BRT' });
  const [routeId,    setRouteId]    = useState(null);
  const [routeStops, setRouteStops] = useState([]);
  const [addStopId,  setAddStopId]  = useState('');
  const [addTime,    setAddTime]    = useState('5');
  const [busList,    setBusList]    = useState(['']);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const usedIds   = new Set(routeStops.map(s => s.stop_id));
  const available = allStops.filter(s => !usedIds.has(s.stop_id));

  // Step 1 → create route row
  const handleCreateRoute = async () => {
    if (!form.route_code.trim())  { setError('Route code is required.'); return; }
    if (!form.start_point)        { setError('Select a start point.'); return; }
    if (!form.end_point)          { setError('Select an end point.'); return; }
    if (form.start_point === form.end_point) { setError('Start and end point cannot be the same.'); return; }
    setLoading(true); setError('');
    const res = await fetch(`${BASE}/routes`, {
      method: 'POST', headers: authH(), body: JSON.stringify(form),
    }).then(r => r.json());
    if (res.error) { setError(res.error); setLoading(false); return; }
    setRouteId(res.route.id);
    setStep(2);
    setLoading(false);
  };

  // Step 2 → add stop to route
  const handleAddStop = async () => {
    if (!addStopId) return;
    setLoading(true);
    const seq = routeStops.length + 1;
    const res = await addRouteStop(routeId, parseInt(addStopId), seq, parseInt(addTime) || 5);
    if (!res.error) {
      const stop = allStops.find(s => s.stop_id == addStopId);
      setRouteStops(prev => [
        ...prev,
        {
          ...stop,
          stop_sequence: seq,
          travel_time_from_prev_mins: parseInt(addTime) || 5,
          route_stop_id: res.route_stop_id,
        },
      ]);
      setAddStopId(''); setAddTime('5');
    }
    setLoading(false);
  };

  const handleRemoveStop = async (rs) => {
    await removeRouteStop(routeId, rs.route_stop_id);
    setRouteStops(prev => prev.filter(s => s.route_stop_id !== rs.route_stop_id));
  };

  // Step 3 → add buses
  const handleAddBuses = async () => {
    setLoading(true); setError('');
    const nums = busList.filter(b => b.trim());
    for (const num of nums) {
      await addBusToRoute(num.trim(), routeId);
    }
    // Reload simulation to pick up new route + buses
    await fetch(`${BASE}/simulation/reload`, { method: 'POST', headers: authH() }).catch(() => {});
    setLoading(false);
    onDone();
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wizard" onClick={e => e.stopPropagation()}>

        {/* Progress bar */}
        <div className="wizard-progress">
          {['Route Info', 'Add Stops', 'Add Buses'].map((label, i) => (
            <div key={i} className={`wizard-step ${step === i+1 ? 'active' : step > i+1 ? 'done' : ''}`}>
              <div className="wizard-step-num">{step > i+1 ? '✓' : i+1}</div>
              <div className="wizard-step-label">{label}</div>
            </div>
          ))}
        </div>

        <button className="modal-close" onClick={onClose}>✕</button>
        {error && <div className="err-box">{error}</div>}

        {/* ── Step 1: Route info ── */}
        {step === 1 && (
          <div className="wizard-body">
            <div className="modal-title">New Route</div>
            <div className="modal-sub">Basic information about the route</div>

            {/* Route code */}
            <div className="field-group">
              <label className="field-label">Route Code *</label>
              <input className="modal-input" placeholder="e.g. R-7, K-5, EV-2"
                value={form.route_code}
                onChange={e => setForm(p => ({ ...p, route_code: e.target.value }))} />
            </div>

            {/* Start + End as dropdowns from allStops */}
            <div className="field-row">
              <div className="field-group">
                <label className="field-label">Start Point *</label>
                <select className="modal-select"
                  value={form.start_point}
                  onChange={e => setForm(p => ({ ...p, start_point: e.target.value }))}>
                  <option value="">— select stop —</option>
                  {allStops
                    .filter(s => s.stop_name !== form.end_point)
                    .map(s => (
                      <option key={s.stop_id} value={s.stop_name}>{s.stop_name}</option>
                    ))}
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">End Point *</label>
                <select className="modal-select"
                  value={form.end_point}
                  onChange={e => setForm(p => ({ ...p, end_point: e.target.value }))}>
                  <option value="">— select stop —</option>
                  {allStops
                    .filter(s => s.stop_name !== form.start_point)
                    .map(s => (
                      <option key={s.stop_id} value={s.stop_name}>{s.stop_name}</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Preview of selected endpoints */}
            {form.start_point && form.end_point && (
              <div style={{
                padding: '0.5rem 0.75rem',
                background: 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '6px',
                fontSize: '0.78rem',
                color: 'rgba(255,255,255,0.55)',
              }}>
                🚌 {form.start_point} → {form.end_point}
              </div>
            )}

            {/* Category */}
            <div className="field-group">
              <label className="field-label">Category</label>
              <select className="modal-select"
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                <option value="BRT">BRT</option>
                <option value="Pink Bus">Pink Bus</option>
                <option value="EV Bus">EV Bus</option>
              </select>
            </div>

            <button className="wizard-next-btn" onClick={handleCreateRoute} disabled={loading}>
              {loading ? 'Creating…' : 'Next: Add Stops →'}
            </button>
          </div>
        )}

        {/* ── Step 2: Add stops ── */}
        {step === 2 && (
          <div className="wizard-body">
            <div className="modal-title">{form.route_code} — Stop Sequence</div>
            <div className="modal-sub">
              Add stops in order. First stop = terminus (0 min).
            </div>

            <div className="stop-list" style={{ maxHeight: 240 }}>
              {routeStops.length === 0 && (
                <div className="modal-empty">No stops added yet</div>
              )}
              {routeStops.map((s, i) => (
                <div key={s.route_stop_id} className="stop-row">
                  <div className="stop-seq">{i + 1}</div>
                  <div className="stop-dot"/>
                  <div className="stop-info">
                    <div className="stop-name">{s.stop_name}</div>
                    <div className="stop-time">
                      {i === 0 ? 'Start terminus' : `+${s.travel_time_from_prev_mins} min`}
                    </div>
                  </div>
                  <button className="stop-remove" onClick={() => handleRemoveStop(s)}>✕</button>
                </div>
              ))}
            </div>

            <div className="modal-add-row" style={{ marginTop: '0.75rem' }}>
              <select className="modal-select" value={addStopId}
                onChange={e => setAddStopId(e.target.value)}>
                <option value="">Select stop…</option>
                {available.map(s => (
                  <option key={s.stop_id} value={s.stop_id}>{s.stop_name}</option>
                ))}
              </select>
              <input className="modal-input-sm" type="number"
                placeholder="mins" min="0" max="120"
                value={addTime} onChange={e => setAddTime(e.target.value)} />
              <button className="modal-add-btn"
                onClick={handleAddStop}
                disabled={loading || !addStopId}>
                +
              </button>
            </div>

            <div style={{ display:'flex', gap:'0.5rem', marginTop:'1rem' }}>
              <button className="wizard-back-btn" onClick={() => setStep(1)}>← Back</button>
              <button className="wizard-next-btn"
                onClick={() => setStep(3)}
                disabled={routeStops.length < 2}>
                {routeStops.length < 2 ? 'Add at least 2 stops' : 'Next: Add Buses →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Add buses ── */}
        {step === 3 && (
          <div className="wizard-body">
            <div className="modal-title">{form.route_code} — Assign Buses</div>
            <div className="modal-sub">
              Add bus numbers that will operate on this route.
            </div>

            {busList.map((b, i) => (
              <div key={i} className="modal-add-row" style={{ marginBottom: '0.4rem' }}>
                <input className="modal-input"
                  placeholder={`Bus number e.g. BUS-${100 + i + 1}`}
                  value={b}
                  onChange={e => setBusList(prev => prev.map((v, j) => j === i ? e.target.value : v))} />
                {busList.length > 1 && (
                  <button className="stop-remove"
                    onClick={() => setBusList(p => p.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                )}
              </div>
            ))}

            <button className="add-another-btn"
              onClick={() => setBusList(p => [...p, ''])}>
              + Add another bus
            </button>

            <div style={{ display:'flex', gap:'0.5rem', marginTop:'1rem' }}>
              <button className="wizard-back-btn" onClick={() => setStep(2)}>← Back</button>
              <button className="wizard-next-btn" onClick={handleAddBuses} disabled={loading}>
                {loading ? 'Saving…' : 'Create Route ✓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const TABS = ['Routes', 'Stations', 'Buses'];

export default function Dashboard() {
  const [activeTab,    setActiveTab]    = useState('Routes');
  const [routes,       setRoutes]       = useState([]);
  const [stations,     setStations]     = useState([]);
  const [buses,        setBuses]        = useState([]);
  const [allStops,     setAllStops]     = useState([]);
  const [stats,        setStats]        = useState(null);
  const [editRoute,    setEditRoute]    = useState(null);   // route obj being edited
  const [showWizard,   setShowWizard]   = useState(false);
  const [stationForm,  setStationForm]  = useState({ stop_name:'', landmark:'' });
  const [busForm,      setBusForm]      = useState({ bus_number:'', route_id:'' });
  const [formError,    setFormError]    = useState('');
  const [loading,      setLoading]      = useState(false);
  const navigate = useNavigate();

  const refreshAll = useCallback(async () => {
    const [r, s, b, st] = await Promise.all([getRoutes(), getStations(), getBuses(), getAllStops()]);
    setRoutes(r.routes || []);
    setStations(s.stations || []);
    setBuses(b.buses || []);
    setAllStops(st.stops || []);
  }, []);

  useEffect(() => {
    refreshAll();
    const si = setInterval(() => getStats().then(setStats).catch(()=>{}), 4000);
    getStats().then(setStats).catch(()=>{});
    return () => clearInterval(si);
  }, [refreshAll]);

  const handleLogout = async () => {
    await adminLogout().catch(()=>{});
    localStorage.removeItem('adminToken');
    navigate('/login');
  };

  const handleDeleteRoute = async (id) => {
    const route = routes.find(r => r.id === id);
    if (!confirm(`Delete route ${route?.route_code}? This will also remove all its buses and stop assignments. This cannot be undone.`)) return;
    const res = await deleteRoute(id).catch(() => ({ error: 'Network error' }));
    if (res.error) { alert(`Delete failed: ${res.error}`); return; }
    refreshAll();
  };

  const handleAddStation = async () => {
    if (!stationForm.stop_name.trim()) { setFormError('Station name required.'); return; }
    setLoading(true); setFormError('');
    const res = await createStation(stationForm);
    if (res.error) setFormError(res.error);
    else { setStationForm({ stop_name:'', landmark:'' }); refreshAll(); }
    setLoading(false);
  };

  const handleDeleteStation = async (id) => {
    await deleteStation(id);
    refreshAll();
  };

  const handleAddBus = async () => {
    if (!busForm.bus_number.trim() || !busForm.route_id) { setFormError('Bus number and route required.'); return; }
    setLoading(true); setFormError('');
    const res = await createBus(busForm);
    if (res.error) setFormError(res.error);
    else { setBusForm({ bus_number:'', route_id:'' }); refreshAll(); }
    setLoading(false);
  };

  const handleDeleteBus = async (id) => {
    await deleteBus(id);
    refreshAll();
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

        .dash { min-height:100vh; background:#09090c; font-family:'DM Sans',sans-serif; color:#e8e6ee; }

        /* Header */
        .dash-hdr { display:flex; justify-content:space-between; align-items:center; padding:0.9rem 2rem; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(9,9,12,0.97); position:sticky; top:0; z-index:200; backdrop-filter:blur(16px); }
        .dash-logo { font-family:'Bebas Neue',sans-serif; font-size:1.35rem; letter-spacing:0.06em; display:flex; align-items:center; gap:0.5rem; }
        .dash-logo .r { color:#ef4444; }
        .hdr-right { display:flex; gap:0.5rem; align-items:center; }
        .hdr-link { font-size:0.8rem; color:rgba(255,255,255,0.3); text-decoration:none; padding:0.35rem 0.8rem; border-radius:6px; border:1px solid rgba(255,255,255,0.07); transition:all 0.15s; }
        .hdr-link:hover { color:#fff; border-color:rgba(255,255,255,0.18); }
        .hdr-logout { background:none; border:1px solid rgba(255,255,255,0.07); color:rgba(255,255,255,0.3); padding:0.35rem 0.8rem; border-radius:6px; cursor:pointer; font-size:0.8rem; font-family:'DM Sans',sans-serif; transition:all 0.15s; }
        .hdr-logout:hover { border-color:#ef4444; color:#ef4444; }

        /* Body */
        .dash-body { max-width:1000px; margin:0 auto; padding:2rem 1.5rem 4rem; }
        .dash-title { font-family:'Bebas Neue',sans-serif; font-size:2.4rem; letter-spacing:0.04em; margin-bottom:1.5rem; color:#fff; }

        /* Stats */
        .stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:0.85rem; margin-bottom:2rem; }
        @media(max-width:700px){ .stats-row { grid-template-columns:repeat(2,1fr); } }
        .stat-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:1.1rem 1.25rem; display:flex; gap:0.85rem; align-items:center; }
        .stat-icon { font-size:1.5rem; }
        .stat-value { font-family:'Bebas Neue',sans-serif; font-size:1.9rem; color:#ef4444; line-height:1; }
        .stat-label { font-size:0.7rem; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:0.07em; }
        .stat-sub { font-size:0.65rem; color:rgba(255,255,255,0.18); margin-top:0.1rem; }

        /* Tabs */
        .tabs { display:flex; gap:0; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.07); }
        .tab-btn { padding:0.6rem 1.3rem; border:none; background:none; color:rgba(255,255,255,0.3); font-size:0.85rem; font-family:'DM Sans',sans-serif; font-weight:600; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; transition:all 0.15s; }
        .tab-btn.active { color:#fff; border-bottom-color:#ef4444; }
        .tab-btn:hover:not(.active) { color:rgba(255,255,255,0.65); }

        /* Section card */
        .section-card { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:1.4rem; }
        .section-hdr { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; }
        .section-title { font-size:0.68rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.3); }
        .new-route-btn { display:flex; align-items:center; gap:0.4rem; padding:0.45rem 1rem; border-radius:7px; border:none; background:#b91c1c; color:#fff; font-family:'DM Sans',sans-serif; font-weight:700; font-size:0.82rem; cursor:pointer; transition:background 0.15s; }
        .new-route-btn:hover { background:#991b1b; }

        /* Route table */
        .route-table { width:100%; border-collapse:collapse; }
        .route-table th { text-align:left; padding:0.45rem 0.75rem; font-size:0.67rem; letter-spacing:0.09em; text-transform:uppercase; color:rgba(255,255,255,0.25); border-bottom:1px solid rgba(255,255,255,0.06); font-weight:700; }
        .route-table td { padding:0.75rem 0.75rem; border-bottom:1px solid rgba(255,255,255,0.04); font-size:0.85rem; color:rgba(255,255,255,0.7); vertical-align:middle; }
        .route-table tr:last-child td { border-bottom:none; }
        .route-table tr:hover td { background:rgba(255,255,255,0.02); }
        .route-code-badge { display:inline-block; padding:0.15rem 0.5rem; border-radius:4px; font-family:'DM Sans',sans-serif; font-weight:700; font-size:0.8rem; }
        .cat-pill { display:inline-block; padding:0.1rem 0.45rem; border-radius:20px; font-size:0.68rem; font-weight:600; border:1px solid; }
        .cat-brt   { color:#06b6d4; border-color:rgba(6,182,212,0.35); background:rgba(6,182,212,0.08); }
        .cat-pink  { color:#ec4899; border-color:rgba(236,72,153,0.35); background:rgba(236,72,153,0.08); }
        .cat-ev    { color:#22c55e; border-color:rgba(34,197,94,0.35);  background:rgba(34,197,94,0.08); }
        .bus-count { font-size:0.75rem; color:rgba(255,255,255,0.4); }
        .action-row { display:flex; gap:0.4rem; align-items:center; }
        .edit-btn { padding:0.25rem 0.65rem; border-radius:5px; border:1px solid rgba(255,255,255,0.12); background:none; color:rgba(255,255,255,0.5); font-size:0.78rem; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; }
        .edit-btn:hover { border-color:#ef4444; color:#ef4444; background:rgba(239,68,68,0.06); }
        .del-btn { padding:0.25rem 0.6rem; border-radius:5px; border:1px solid rgba(239,68,68,0.2); background:none; color:rgba(239,68,68,0.6); font-size:0.78rem; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; }
        .del-btn:hover { background:rgba(239,68,68,0.1); color:#ef4444; }
        .empty-row { text-align:center; padding:2.5rem; color:rgba(255,255,255,0.18); font-size:0.85rem; }

        /* Add form row */
        .add-form { display:flex; gap:0.6rem; flex-wrap:wrap; padding-top:1.1rem; border-top:1px solid rgba(255,255,255,0.06); margin-top:1.1rem; }
        .add-input { flex:1; min-width:140px; padding:0.6rem 0.85rem; border-radius:7px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.05); color:#fff; font-family:'DM Sans',sans-serif; font-size:0.88rem; outline:none; transition:border-color 0.15s; }
        .add-input:focus { border-color:#b91c1c; }
        .add-input::placeholder { color:rgba(255,255,255,0.22); }
        .add-input option { background:#18181f; }
        .add-submit { padding:0.6rem 1.2rem; border-radius:7px; border:none; background:#b91c1c; color:#fff; font-family:'DM Sans',sans-serif; font-weight:700; font-size:0.85rem; cursor:pointer; white-space:nowrap; transition:background 0.15s; }
        .add-submit:hover:not(:disabled) { background:#991b1b; }
        .add-submit:disabled { opacity:0.45; cursor:not-allowed; }
        .form-error { width:100%; font-size:0.8rem; color:#fca5a5; padding:0.4rem 0.7rem; background:rgba(185,28,28,0.12); border:1px solid rgba(185,28,28,0.3); border-radius:6px; }

        /* ── Modal ── */
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:500; display:flex; align-items:center; justify-content:center; padding:1rem; backdrop-filter:blur(4px); }
        .modal { background:#111318; border:1px solid rgba(255,255,255,0.1); border-radius:14px; width:100%; max-width:560px; max-height:90vh; overflow-y:auto; padding:1.75rem; position:relative; }
        .modal-wizard { max-width:500px; }
        .modal-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.4rem; }
        .modal-title { font-family:'Bebas Neue',sans-serif; font-size:1.6rem; letter-spacing:0.04em; color:#fff; line-height:1; }
        .modal-sub { font-size:0.78rem; color:rgba(255,255,255,0.35); margin-top:0.2rem; }
        .modal-close { background:none; border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.4); width:30px; height:30px; border-radius:6px; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.15s; }
        .modal-close:hover { border-color:#ef4444; color:#ef4444; }
        .modal-section-label { font-size:0.67rem; font-weight:700; letter-spacing:0.11em; text-transform:uppercase; color:rgba(255,255,255,0.25); margin-bottom:0.6rem; margin-top:0.1rem; }
        .modal-divider { height:1px; background:rgba(255,255,255,0.07); margin:1.1rem 0; }
        .modal-empty { font-size:0.82rem; color:rgba(255,255,255,0.2); padding:0.75rem 0; }
        .err-box { background:rgba(185,28,28,0.1); border:1px solid rgba(185,28,28,0.3); border-radius:7px; padding:0.6rem 0.85rem; font-size:0.82rem; color:#fca5a5; margin-bottom:1rem; }

        /* Stop list in modal */
        .stop-list { max-height:280px; overflow-y:auto; margin-bottom:0.5rem; }
        .stop-list::-webkit-scrollbar { width:3px; }
        .stop-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
        .stop-row { display:flex; align-items:center; gap:0.6rem; padding:0.5rem 0; border-bottom:1px solid rgba(255,255,255,0.04); }
        .stop-row:last-child { border-bottom:none; }
        .stop-seq { font-family:'DM Sans',monospace; font-size:0.7rem; color:rgba(255,255,255,0.25); width:18px; text-align:right; flex-shrink:0; }
        .stop-dot { width:8px; height:8px; border-radius:50%; background:#ef4444; flex-shrink:0; border:1px solid rgba(255,255,255,0.2); }
        .stop-info { flex:1; }
        .stop-name { font-size:0.85rem; font-weight:600; color:#e2e8f0; }
        .stop-time { font-size:0.7rem; color:rgba(255,255,255,0.3); margin-top:0.1rem; }
        .stop-remove { background:none; border:none; color:rgba(255,255,255,0.2); cursor:pointer; font-size:0.82rem; padding:0.2rem 0.3rem; border-radius:3px; transition:all 0.15s; flex-shrink:0; }
        .stop-remove:hover { color:#ef4444; background:rgba(239,68,68,0.1); }

        /* Bus list in modal */
        .bus-list { display:flex; flex-wrap:wrap; gap:0.4rem; margin-bottom:0.65rem; min-height:28px; }
        .bus-tag { display:flex; align-items:center; gap:0.35rem; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:5px; padding:0.2rem 0.6rem; font-size:0.8rem; color:rgba(255,255,255,0.7); }

        /* Modal inputs */
        .modal-add-row { display:flex; gap:0.5rem; align-items:center; }
        .modal-input { flex:1; padding:0.55rem 0.8rem; border-radius:7px; border:1px solid rgba(255,255,255,0.09); background:rgba(255,255,255,0.05); color:#fff; font-family:'DM Sans',sans-serif; font-size:0.86rem; outline:none; transition:border-color 0.15s; }
        .modal-input:focus { border-color:#b91c1c; }
        .modal-input::placeholder { color:rgba(255,255,255,0.2); }
        .modal-input-sm { width:72px; flex-shrink:0; padding:0.55rem 0.65rem; border-radius:7px; border:1px solid rgba(255,255,255,0.09); background:rgba(255,255,255,0.05); color:#fff; font-family:'DM Sans',sans-serif; font-size:0.84rem; outline:none; text-align:center; }
        .modal-input-sm:focus { border-color:#b91c1c; }
        .modal-select { flex:1; padding:0.55rem 0.8rem; border-radius:7px; border:1px solid rgba(255,255,255,0.09); background:rgba(255,255,255,0.05); color:#fff; font-family:'DM Sans',sans-serif; font-size:0.86rem; outline:none; cursor:pointer; }
        .modal-select option { background:#18181f; }
        .modal-add-btn { padding:0.5rem 1rem; border-radius:7px; border:none; background:#b91c1c; color:#fff; font-family:'DM Sans',sans-serif; font-weight:700; font-size:0.84rem; cursor:pointer; white-space:nowrap; transition:background 0.15s; flex-shrink:0; }
        .modal-add-btn:hover:not(:disabled) { background:#991b1b; }
        .modal-add-btn:disabled { opacity:0.4; cursor:not-allowed; }

        /* Wizard */
        .wizard-progress { display:flex; gap:0; margin-bottom:1.75rem; border-bottom:1px solid rgba(255,255,255,0.07); padding-bottom:1rem; }
        .wizard-step { flex:1; display:flex; flex-direction:column; align-items:center; gap:0.3rem; opacity:0.3; transition:opacity 0.2s; }
        .wizard-step.active, .wizard-step.done { opacity:1; }
        .wizard-step-num { width:26px; height:26px; border-radius:50%; border:2px solid rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:0.78rem; font-weight:700; }
        .wizard-step.active .wizard-step-num { border-color:#ef4444; color:#ef4444; }
        .wizard-step.done .wizard-step-num { border-color:#22c55e; background:#22c55e; color:#000; }
        .wizard-step-label { font-size:0.68rem; text-transform:uppercase; letter-spacing:0.08em; color:rgba(255,255,255,0.4); }
        .wizard-body { display:flex; flex-direction:column; gap:0.85rem; }
        .field-group { display:flex; flex-direction:column; gap:0.35rem; }
        .field-row { display:grid; grid-template-columns:1fr 1fr; gap:0.65rem; }
        .field-label { font-size:0.7rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.3); }
        .wizard-next-btn { padding:0.65rem 1.4rem; border-radius:8px; border:none; background:#ef4444; color:#fff; font-family:'DM Sans',sans-serif; font-weight:700; font-size:0.9rem; cursor:pointer; transition:background 0.15s; align-self:flex-end; }
        .wizard-next-btn:hover:not(:disabled) { background:#dc2626; }
        .wizard-next-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .wizard-back-btn { padding:0.65rem 1rem; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:none; color:rgba(255,255,255,0.4); font-family:'DM Sans',sans-serif; font-weight:600; font-size:0.88rem; cursor:pointer; transition:all 0.15s; }
        .wizard-back-btn:hover { color:#fff; border-color:rgba(255,255,255,0.25); }
        .add-another-btn { background:none; border:1px dashed rgba(255,255,255,0.15); color:rgba(255,255,255,0.4); padding:0.4rem 0.9rem; border-radius:6px; font-size:0.8rem; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; align-self:flex-start; }
        .add-another-btn:hover { border-color:rgba(255,255,255,0.3); color:rgba(255,255,255,0.7); }
      `}</style>

      <div className="dash">
        <header className="dash-hdr">
          <div className="dash-logo">🚌 Karachi <span className="r">Red</span> Bus</div>
          <div className="hdr-right">
            <a href="/" className="hdr-link">← View Site</a>
            <button className="hdr-logout" onClick={handleLogout}>Log out</button>
          </div>
        </header>

        <div className="dash-body">
          <h1 className="dash-title">Management Dashboard</h1>

          {/* Stats */}
          <div className="stats-row">
            <StatCard icon="🚌" label="Active Buses"
              value={stats?.active_buses ?? buses.length}
              sub={stats ? 'live simulation' : 'from DB'} />
            <StatCard icon="🛣️" label="Routes" value={routes.length} />
            <StatCard icon="🚏" label="Stops" value={stats?.total_stops ?? stations.length} />
            <StatCard icon="⏱" label="GPS Ping"
              value="2s" sub="simulation interval" />
          </div>

          {/* Tabs */}
          <div className="tabs">
            {TABS.map(t => (
              <button key={t} className={`tab-btn ${activeTab===t?'active':''}`}
                onClick={() => { setActiveTab(t); setFormError(''); }}>
                {t}
              </button>
            ))}
          </div>

          {/* ── ROUTES TAB ── */}
          {activeTab === 'Routes' && (
            <div className="section-card">
              <div className="section-hdr">
                <div className="section-title">All Routes</div>
                <button className="new-route-btn" onClick={() => setShowWizard(true)}>
                  + New Route
                </button>
              </div>
              {routes.length === 0
                ? <div className="empty-row">No routes yet. Create one above.</div>
                : (
                  <table className="route-table">
                    <thead>
                      <tr>
                        <th>Code</th><th>From → To</th><th>Category</th>
                        <th>Buses</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routes.map(r => {
                        const busCnt = buses.filter(b => b.route_id == r.id).length;
                        const catCls = r.category==='BRT'?'cat-brt':r.category==='Pink Bus'?'cat-pink':'cat-ev';
                        return (
                          <tr key={r.id}>
                            <td>
                              <span className="route-code-badge"
                                style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444' }}>
                                {r.route_code}
                              </span>
                            </td>
                            <td style={{ color:'rgba(255,255,255,0.55)', fontSize:'0.82rem' }}>
                              {r.start_point || '—'} → {r.end_point || '—'}
                            </td>
                            <td><span className={`cat-pill ${catCls}`}>{r.category}</span></td>
                            <td><span className="bus-count">{busCnt} bus{busCnt!==1?'es':''}</span></td>
                            <td>
                              <div className="action-row">
                                <button className="edit-btn" onClick={() => setEditRoute(r)}>
                                  Edit →
                                </button>
                                <button className="del-btn" onClick={() => handleDeleteRoute(r.id)}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              }
            </div>
          )}

          {/* ── STATIONS TAB ── */}
          {activeTab === 'Stations' && (
            <div className="section-card">
              <div className="section-hdr">
                <div className="section-title">All Stations ({stations.length})</div>
              </div>
              <table className="route-table">
                <thead><tr><th>Name</th><th>Landmark</th><th>Coords</th><th>Actions</th></tr></thead>
                <tbody>
                  {stations.length === 0
                    ? <tr><td colSpan={4} className="empty-row">No stations yet.</td></tr>
                    : stations.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight:600 }}>{s.stop_name}</td>
                        <td style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.82rem' }}>{s.landmark||'—'}</td>
                        <td style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.75rem', fontFamily:'monospace' }}>
                          {s.latitude ? `${parseFloat(s.latitude).toFixed(4)}, ${parseFloat(s.longitude).toFixed(4)}` : '—'}
                        </td>
                        <td><button className="del-btn" onClick={() => handleDeleteStation(s.id)}>Delete</button></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
              {formError && activeTab==='Stations' && <div className="form-error" style={{marginTop:'0.75rem'}}>{formError}</div>}
              <div className="add-form">
                <input className="add-input" placeholder="Station name *"
                  value={stationForm.stop_name}
                  onChange={e => setStationForm(p=>({...p,stop_name:e.target.value}))} />
                <input className="add-input" placeholder="Landmark / area"
                  value={stationForm.landmark}
                  onChange={e => setStationForm(p=>({...p,landmark:e.target.value}))} />
                <button className="add-submit" onClick={handleAddStation} disabled={loading}>
                  {loading?'…':'+ Add Station'}
                </button>
              </div>
            </div>
          )}

          {/* ── BUSES TAB ── */}
          {activeTab === 'Buses' && (
            <div className="section-card">
              <div className="section-hdr">
                <div className="section-title">All Buses ({buses.length})</div>
              </div>
              <table className="route-table">
                <thead><tr><th>Bus Number</th><th>Route</th><th>Actions</th></tr></thead>
                <tbody>
                  {buses.length === 0
                    ? <tr><td colSpan={3} className="empty-row">No buses yet.</td></tr>
                    : buses.map(b => {
                      const route = routes.find(r => r.id == b.route_id);
                      return (
                        <tr key={b.id}>
                          <td style={{ fontWeight:600, fontFamily:'monospace' }}>{b.bus_number}</td>
                          <td>
                            {route
                              ? <span className="route-code-badge" style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444' }}>{route.route_code}</span>
                              : <span style={{ color:'rgba(255,255,255,0.25)' }}>Route {b.route_id}</span>
                            }
                          </td>
                          <td><button className="del-btn" onClick={() => handleDeleteBus(b.id)}>Delete</button></td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
              {formError && activeTab==='Buses' && <div className="form-error" style={{marginTop:'0.75rem'}}>{formError}</div>}
              <div className="add-form">
                <input className="add-input" placeholder="Bus number e.g. BUS-201"
                  value={busForm.bus_number}
                  onChange={e => setBusForm(p=>({...p,bus_number:e.target.value}))} />
                <select className="add-input" value={busForm.route_id}
                  onChange={e => setBusForm(p=>({...p,route_id:e.target.value}))}>
                  <option value="">Select route…</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.route_code} — {r.start_point} → {r.end_point}</option>)}
                </select>
                <button className="add-submit" onClick={handleAddBus} disabled={loading}>
                  {loading?'…':'+ Add Bus'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Route Editor Modal ── */}
      {editRoute && (
        <RouteEditor
          route={editRoute}
          allStops={allStops}
          buses={buses}
          onClose={() => setEditRoute(null)}
          onRefresh={refreshAll}
        />
      )}

      {/* ── New Route Wizard ── */}
      {showWizard && (
        <NewRouteWizard
          allStops={allStops}
          onClose={() => setShowWizard(false)}
          onDone={() => { setShowWizard(false); refreshAll(); }}
        />
      )}
    </>
  );
}

