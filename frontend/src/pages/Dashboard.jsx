import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getRoutes, createRoute, deleteRoute,
  getStations, createStation, deleteStation,
  getBuses, createBus, deleteBus,
  adminLogout,
} from '../api';

const BASE = 'http://localhost:5000/api';
const token = () => localStorage.getItem('adminToken');
const authH = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` });

const getStats      = () => fetch(`${BASE}/stats`).then(r => r.json());
const getRouteStops = (routeId) => fetch(`${BASE}/routes/${routeId}/stops`).then(r => r.json());
const addRouteStop  = (routeId, stopId, sequence, travelTime) =>
  fetch(`${BASE}/routes/${routeId}/stops`, {
    method: 'POST', headers: authH(),
    body: JSON.stringify({ stop_id: stopId, stop_sequence: sequence, travel_time_from_prev_mins: travelTime }),
  }).then(r => r.json());
const removeRouteStop = (routeId, routeStopId) =>
  fetch(`${BASE}/routes/${routeId}/stops/${routeStopId}`, {
    method: 'DELETE', headers: authH(),
  }).then(r => r.json());
const getAllStops = () => fetch(`${BASE}/stops`).then(r => r.json());

// ─── Generic CRUD panel ───────────────────────────────────────────────────────
function CrudPanel({ sectionLabel, fields, items, onAdd, onDelete, loading, error }) {
  const [form, setForm] = useState(() => Object.fromEntries(fields.map(f => [f.key, ''])));

  const handleAdd = async () => {
    await onAdd(form);
    setForm(Object.fromEntries(fields.map(f => [f.key, ''])));
  };

  return (
    <div className="crud-card">
      <div className="section-label">Add {sectionLabel}</div>
      {error && <div className="error-box">{error}</div>}
      <div className="add-row">
        {fields.map(f => (
          <input key={f.key} className="crud-input" placeholder={f.label}
            value={form[f.key]}
            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
          />
        ))}
        <button className="add-btn" onClick={handleAdd} disabled={loading}>
          {loading ? '…' : '+ Add'}
        </button>
      </div>
      <div className="section-label" style={{ marginTop: '1.5rem' }}>{sectionLabel} List</div>
      {items.length === 0
        ? <div className="empty-msg">No {sectionLabel.toLowerCase()}s yet.</div>
        : (
          <table className="crud-table">
            <thead>
              <tr>{fields.map(f => <th key={f.key}>{f.label}</th>)}<th>Actions</th></tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  {fields.map(f => <td key={f.key}>{item[f.key] ?? '—'}</td>)}
                  <td>
                    <button className="del-btn" onClick={() => onDelete(item.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="stat-value">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Assign Stops panel ───────────────────────────────────────────────────────
function AssignStopsPanel({ routes }) {
  const [selectedRoute, setSelectedRoute] = useState('');
  const [routeStops,    setRouteStops]    = useState([]);
  const [allStops,      setAllStops]      = useState([]);
  const [addStopId,     setAddStopId]     = useState('');
  const [addTime,       setAddTime]       = useState('5');
  const [loading,       setLoading]       = useState(false);
  const [localError,    setLocalError]    = useState('');

  useEffect(() => {
    getAllStops().then(d => setAllStops(d.stops || []));
  }, []);

  const refreshRouteStops = useCallback(() => {
    if (!selectedRoute) { setRouteStops([]); return; }
    getRouteStops(selectedRoute).then(d => setRouteStops(d.stops || []));
  }, [selectedRoute]);

  useEffect(() => { refreshRouteStops(); }, [refreshRouteStops]);

  const handleAdd = async () => {
    if (!addStopId) { setLocalError('Select a stop to add.'); return; }
    setLoading(true); setLocalError('');
    const nextSeq = routeStops.length + 1;
    const res = await addRouteStop(selectedRoute, parseInt(addStopId), nextSeq, parseInt(addTime) || 5);
    if (res.error) setLocalError(res.error);
    else { setAddStopId(''); refreshRouteStops(); }
    setLoading(false);
  };

  const handleRemove = async (routeStopId) => {
    await removeRouteStop(selectedRoute, routeStopId);
    refreshRouteStops();
  };

  const usedIds   = new Set(routeStops.map(s => s.stop_id));
  const available = allStops.filter(s => !usedIds.has(s.stop_id));

  return (
    <div className="crud-card">
      <div className="section-label">Select Route</div>
      <select className="crud-input" style={{ marginBottom: '1.5rem', maxWidth: 260 }}
        value={selectedRoute} onChange={e => setSelectedRoute(e.target.value)}>
        <option value="">— pick a route —</option>
        {routes.map(r => <option key={r.id} value={r.id}>{r.route_code}</option>)}
      </select>

      {selectedRoute && (
        <>
          <div className="section-label">Current Stops ({routeStops.length})</div>
          {routeStops.length === 0
            ? <div className="empty-msg">No stops on this route yet.</div>
            : (
              <table className="crud-table" style={{ marginBottom: '1.5rem' }}>
                <thead>
                  <tr><th>#</th><th>Stop Name</th><th>Landmark</th><th>Travel time</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {routeStops.map((s, i) => (
                    <tr key={s.route_stop_id}>
                      <td style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>{s.stop_sequence}</td>
                      <td>{s.stop_name}</td>
                      <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>{s.landmark || '—'}</td>
                      <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>
                        {i === 0 ? 'Start' : `${s.travel_time_from_prev_mins} min`}
                      </td>
                      <td>
                        <button className="del-btn" onClick={() => handleRemove(s.route_stop_id)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }

          <div className="section-label">Add Stop</div>
          {localError && <div className="error-box">{localError}</div>}
          <div className="add-row">
            <select className="crud-input" value={addStopId} onChange={e => setAddStopId(e.target.value)}>
              <option value="">— select stop —</option>
              {available.map(s => (
                <option key={s.stop_id} value={s.stop_id}>{s.stop_name}</option>
              ))}
            </select>
            <input className="crud-input" style={{ maxWidth: 100 }}
              type="number" placeholder="mins" min="1" max="60"
              value={addTime} onChange={e => setAddTime(e.target.value)} />
            <button className="add-btn" onClick={handleAdd} disabled={loading}>
              {loading ? '…' : '+ Add'}
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.5rem' }}>
            "Mins" = travel time from the previous stop
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const TABS = ['Routes', 'Stations', 'Buses', 'Assign Stops'];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('Routes');
  const [routes,    setRoutes]    = useState([]);
  const [stations,  setStations]  = useState([]);
  const [buses,     setBuses]     = useState([]);
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const navigate = useNavigate();

  // ── Fetch all data from DB ─────────────────────────────────────────────────
  const refreshAll = useCallback(() => {
    Promise.all([getRoutes(), getStations(), getBuses()])
      .then(([r, s, b]) => {
        setRoutes(r.routes || []);
        setStations(s.stations || []);
        setBuses(b.buses || []);
      })
      .catch(() => setError('Could not load data. Make sure Node.js is running on port 5000.'));
  }, []);

  useEffect(() => {
    refreshAll();
    const loadStats = () => getStats().then(setStats).catch(() => {});
    loadStats();
    const si = setInterval(loadStats, 5000);
    return () => clearInterval(si);
  }, [refreshAll]);

  const handleLogout = async () => {
    await adminLogout().catch(() => {});
    localStorage.removeItem('adminToken');
    navigate('/login');
  };

  // ── Mutations — always re-fetch from DB after ─────────────────────────────
  const handleAddRoute = async (form) => {
    setLoading(true); setError('');
    try {
      const d = await createRoute(form);
      if (d.error) setError(d.error);
      else refreshAll(); // re-fetch from DB — source of truth
    } catch { setError('Server error.'); }
    setLoading(false);
  };

  const handleDeleteRoute = async (id) => {
    setError('');
    try {
      await deleteRoute(id);
      refreshAll();
    } catch { setError('Delete failed.'); }
  };

  const handleAddStation = async (form) => {
    setLoading(true); setError('');
    try {
      const d = await createStation(form);
      if (d.error) setError(d.error);
      else refreshAll();
    } catch { setError('Server error.'); }
    setLoading(false);
  };

  const handleDeleteStation = async (id) => {
    setError('');
    try {
      await deleteStation(id);
      refreshAll();
    } catch { setError('Delete failed.'); }
  };

  const handleAddBus = async (form) => {
    setLoading(true); setError('');
    try {
      const d = await createBus(form);
      if (d.error) setError(d.error);
      else refreshAll();
    } catch { setError('Server error.'); }
    setLoading(false);
  };

  const handleDeleteBus = async (id) => {
    setError('');
    try {
      await deleteBus(id);
      refreshAll();
    } catch { setError('Delete failed.'); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        .dash-page { min-height:100vh; background:#0c0c0f; font-family:'DM Sans',sans-serif; color:#fff; }
        .dash-header { display:flex; justify-content:space-between; align-items:center; padding:1rem 2rem; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(12,12,15,0.95); position:sticky; top:0; z-index:10; backdrop-filter:blur(10px); }
        .dash-logo { font-family:'Bebas Neue',sans-serif; font-size:1.3rem; letter-spacing:0.05em; display:flex; align-items:center; gap:0.5rem; }
        .dash-logo .red { color:#ef4444; }
        .header-right { display:flex; gap:0.75rem; align-items:center; }
        .view-site-link { font-size:0.82rem; color:rgba(255,255,255,0.35); text-decoration:none; padding:0.4rem 0.8rem; border-radius:20px; border:1px solid rgba(255,255,255,0.08); transition:all 0.2s; }
        .view-site-link:hover { color:rgba(255,255,255,0.7); }
        .logout-btn { background:none; border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.4); padding:0.4rem 0.9rem; border-radius:20px; cursor:pointer; font-size:0.82rem; font-family:'DM Sans',sans-serif; transition:all 0.2s; }
        .logout-btn:hover { border-color:#ef4444; color:#ef4444; }
        .dash-body { max-width:960px; margin:0 auto; padding:2rem 1.5rem; }
        .dash-title { font-family:'Bebas Neue',sans-serif; font-size:2.2rem; letter-spacing:0.03em; margin-bottom:1.5rem; }
        .stats-row { display:flex; gap:1rem; margin-bottom:2rem; flex-wrap:wrap; }
        .stat-card { flex:1; min-width:140px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:1.2rem 1.4rem; display:flex; gap:1rem; align-items:center; }
        .stat-icon { font-size:1.6rem; }
        .stat-value { font-family:'Bebas Neue',sans-serif; font-size:1.8rem; color:#ef4444; line-height:1; }
        .stat-label { font-size:0.75rem; color:rgba(255,255,255,0.35); text-transform:uppercase; letter-spacing:0.06em; }
        .stat-sub { font-size:0.7rem; color:rgba(255,255,255,0.2); margin-top:0.15rem; }
        .tabs { display:flex; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.07); }
        .tab { padding:0.65rem 1.4rem; border:none; background:none; color:rgba(255,255,255,0.35); font-size:0.88rem; font-family:'DM Sans',sans-serif; font-weight:500; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; transition:all 0.2s; }
        .tab.active { color:#fff; border-bottom-color:#ef4444; }
        .tab:hover:not(.active) { color:rgba(255,255,255,0.6); }
        .crud-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:1.5rem; animation:fadeIn 0.25s ease; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .section-label { font-size:0.7rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,255,255,0.3); margin-bottom:0.9rem; }
        .add-row { display:flex; gap:0.75rem; flex-wrap:wrap; margin-bottom:0.75rem; }
        .crud-input { flex:1; min-width:150px; padding:0.65rem 0.9rem; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.05); color:#fff; font-family:'DM Sans',sans-serif; font-size:0.9rem; outline:none; transition:border-color 0.2s; }
        .crud-input:focus { border-color:#b91c1c; }
        .crud-input::placeholder { color:rgba(255,255,255,0.25); }
        .crud-input option { background:#1a1a1f; }
        .add-btn { padding:0.65rem 1.3rem; border-radius:8px; border:none; background:#b91c1c; color:#fff; font-family:'DM Sans',sans-serif; font-weight:600; font-size:0.9rem; cursor:pointer; white-space:nowrap; transition:background 0.2s; }
        .add-btn:hover:not(:disabled) { background:#991b1b; }
        .add-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .crud-table { width:100%; border-collapse:collapse; font-size:0.88rem; }
        .crud-table th { text-align:left; padding:0.5rem 0.75rem; font-size:0.7rem; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.3); border-bottom:1px solid rgba(255,255,255,0.07); font-weight:600; }
        .crud-table td { padding:0.75rem 0.75rem; border-bottom:1px solid rgba(255,255,255,0.04); color:rgba(255,255,255,0.75); }
        .crud-table tr:last-child td { border-bottom:none; }
        .crud-table tr:hover td { background:rgba(255,255,255,0.02); }
        .del-btn { background:none; border:1px solid rgba(239,68,68,0.25); color:#ef4444; padding:0.25rem 0.65rem; border-radius:6px; cursor:pointer; font-size:0.8rem; font-family:'DM Sans',sans-serif; transition:all 0.2s; }
        .del-btn:hover { background:rgba(239,68,68,0.1); }
        .empty-msg { text-align:center; padding:2.5rem; color:rgba(255,255,255,0.2); font-size:0.88rem; }
        .error-box { background:rgba(185,28,28,0.1); border:1px solid rgba(185,28,28,0.3); border-radius:8px; padding:0.75rem; font-size:0.85rem; color:#fca5a5; margin-bottom:1rem; }
      `}</style>

      <div className="dash-page">
        <header className="dash-header">
          <div className="dash-logo">🚌 Karachi <span className="red">Red</span> Bus</div>
          <div className="header-right">
            <a href="/" className="view-site-link">← View Site</a>
            <button className="logout-btn" onClick={handleLogout}>Log out</button>
          </div>
        </header>

        <div className="dash-body">
          <h1 className="dash-title">Management Dashboard</h1>

          <div className="stats-row">
            <StatCard icon="🚌" label="Active Buses"
              value={stats?.active_buses ?? buses.length}
              sub={stats ? 'live from simulation' : 'from DB'} />
            <StatCard icon="🛣️" label="Routes" value={routes.length} />
            <StatCard icon="🚏" label="Stops"
              value={stats?.total_stops ?? stations.length} />
            <StatCard icon="⏱" label="Sim Tick"
              value={stats?.tick_interval_s ? `${stats.tick_interval_s}s` : '10s'}
              sub="simulation interval" />
          </div>

          <div className="tabs">
            {TABS.map(tab => (
              <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab); setError(''); }}>
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'Routes' && (
            <CrudPanel sectionLabel="Route"
              fields={[
                { key: 'route_code',  label: 'Route Code (e.g. R-1)' },
                { key: 'start_point', label: 'Start Point' },
                { key: 'end_point',   label: 'End Point' },
                { key: 'category',    label: 'Category (BRT / Pink Bus / EV Bus)' },
              ]}
              items={routes} onAdd={handleAddRoute} onDelete={handleDeleteRoute}
              loading={loading} error={error} />
          )}
          {activeTab === 'Stations' && (
            <CrudPanel sectionLabel="Station"
              fields={[
                { key: 'stop_name', label: 'Station Name' },
                { key: 'landmark',  label: 'Landmark / Area' },
              ]}
              items={stations} onAdd={handleAddStation} onDelete={handleDeleteStation}
              loading={loading} error={error} />
          )}
          {activeTab === 'Buses' && (
            <CrudPanel sectionLabel="Bus"
              fields={[
                { key: 'bus_number', label: 'Bus Number (e.g. BUS-104)' },
                { key: 'route_id',   label: 'Route ID (number)' },
              ]}
              items={buses} onAdd={handleAddBus} onDelete={handleDeleteBus}
              loading={loading} error={error} />
          )}
          {activeTab === 'Assign Stops' && (
            <AssignStopsPanel routes={routes} />
          )}
        </div>
      </div>
    </>
  );
}