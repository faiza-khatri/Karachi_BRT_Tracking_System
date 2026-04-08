// import { useEffect, useState } from 'react';

// export default function Dashboard() {
//   const [routes, setRoutes] = useState([]);

//   useEffect(() => {
//     // Fetching the routes from your Node.js server (running on port 5000)
//     fetch('http://localhost:5000/api/routes')
//       .then(res => res.json())
//       .then(data => setRoutes(data))
//       .catch(err => console.error("Server not running?", err));
//   }, []);

//   return (
//     <div style={{ padding: '20px', fontFamily: 'Arial' }}>
//       <h2 style={{ borderBottom: '2px solid #8B1A1A' }}>Admin Dashboard - Bus Routes</h2>
//       <table style={{ width: '100%', textAlign: 'left', marginTop: '20px' }}>
//         <thead>
//           <tr style={{ background: '#eee' }}>
//             <th>Route Name</th>
//             <th>Start Point</th>
//             <th>End Point</th>
//           </tr>
//         </thead>
//         <tbody>
//           {routes.map(route => (
//             <tr key={route.id}>
//               <td>{route.route_name}</td>
//               <td>{route.start_point}</td>
//               <td>{route.end_point}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// }

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getRoutes, createRoute, deleteRoute,
  getStations, createStation, deleteStation,
  getBuses, createBus, deleteBus,
  adminLogout,
} from '../api';

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f0f13',
    fontFamily: "'Segoe UI', sans-serif",
    color: '#fff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontWeight: '700',
    fontSize: '1.1rem',
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.5)',
    padding: '0.4rem 0.9rem',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  body: {
    maxWidth: '860px',
    margin: '0 auto',
    padding: '2rem 1rem',
  },
  pageTitle: {
    fontSize: '1.5rem',
    fontWeight: '800',
    marginBottom: '1.5rem',
    letterSpacing: '-0.02em',
  },
  tabs: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    paddingBottom: '0',
  },
  tab: (active) => ({
    padding: '0.6rem 1.2rem',
    border: 'none',
    background: 'none',
    color: active ? '#fff' : 'rgba(255,255,255,0.35)',
    fontSize: '0.9rem',
    fontWeight: active ? '700' : '400',
    cursor: 'pointer',
    borderBottom: active ? '2px solid #e74c3c' : '2px solid transparent',
    marginBottom: '-1px',
    transition: 'all 0.2s',
  }),
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '1.5rem',
    marginBottom: '1rem',
  },
  sectionTitle: {
    fontSize: '0.75rem',
    fontWeight: '700',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: '1rem',
  },
  row: {
    display: 'flex',
    gap: '0.75rem',
    marginBottom: '0.75rem',
    flexWrap: 'wrap',
  },
  input: {
    flex: 1,
    minWidth: '160px',
    padding: '0.65rem 0.9rem',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: '0.9rem',
    outline: 'none',
  },
  addBtn: {
    padding: '0.65rem 1.2rem',
    borderRadius: '8px',
    border: 'none',
    background: '#e74c3c',
    color: '#fff',
    fontWeight: '700',
    fontSize: '0.9rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.88rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.5rem 0.75rem',
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  td: {
    padding: '0.7rem 0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.8)',
  },
  deleteBtn: {
    background: 'none',
    border: '1px solid rgba(231,76,60,0.3)',
    color: '#e74c3c',
    padding: '0.25rem 0.6rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  emptyMsg: {
    textAlign: 'center',
    padding: '2rem',
    color: 'rgba(255,255,255,0.25)',
    fontSize: '0.88rem',
  },
  errorBox: {
    background: 'rgba(231,76,60,0.1)',
    border: '1px solid rgba(231,76,60,0.3)',
    borderRadius: '8px',
    padding: '0.75rem',
    fontSize: '0.85rem',
    color: '#ff8a80',
    marginBottom: '1rem',
  },
};

// ─── Generic CRUD panel used for Routes, Stations, and Buses ─────────────────
function CrudPanel({ sectionLabel, fields, items, onAdd, onDelete, loading, error }) {
  const [form, setForm] = useState(() => Object.fromEntries(fields.map(f => [f.key, ''])));

  const handleAdd = () => {
    onAdd(form);
    setForm(Object.fromEntries(fields.map(f => [f.key, ''])));
  };

  return (
    <div style={styles.card}>
      <div style={styles.sectionTitle}>Add {sectionLabel}</div>
      {error && <div style={styles.errorBox}>{error}</div>}
      <div style={styles.row}>
        {fields.map(f => (
          <input
            key={f.key}
            style={styles.input}
            placeholder={f.label}
            value={form[f.key]}
            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
          />
        ))}
        <button style={styles.addBtn} onClick={handleAdd} disabled={loading}>
          {loading ? '...' : `+ Add`}
        </button>
      </div>

      <div style={styles.sectionTitle}>{sectionLabel} List</div>
      {items.length === 0 ? (
        <div style={styles.emptyMsg}>
          No {sectionLabel.toLowerCase()}s yet. Add one above.
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              {fields.map(f => <th key={f.key} style={styles.th}>{f.label}</th>)}
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                {fields.map(f => (
                  <td key={f.key} style={styles.td}>{item[f.key] ?? '—'}</td>
                ))}
                <td style={styles.td}>
                  <button style={styles.deleteBtn} onClick={() => onDelete(item.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const TABS = ['Routes', 'Stations', 'Buses'];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('Routes');
  const [routes, setRoutes] = useState([]);
  const [stations, setStations] = useState([]);
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Fetch all data on mount
  useEffect(() => {
    Promise.all([getRoutes(), getStations(), getBuses()])
      .then(([r, s, b]) => {
        setRoutes(r.routes || []);
        setStations(s.stations || []);
        setBuses(b.buses || []);
      })
      .catch(() => setError('Could not load data. Make sure Flask is running.'));
  }, []);

  const handleLogout = async () => {
    await adminLogout().catch(() => {});
    localStorage.removeItem('adminToken');
    navigate('/login');
  };

  // ── Routes CRUD ──
  const handleAddRoute = async (form) => {
    setLoading(true); setError('');
    try {
      const data = await createRoute(form);
      if (data.route) setRoutes(prev => [...prev, data.route]);
      else setError(data.error || 'Failed to add route.');
    } catch { setError('Server error.'); }
    setLoading(false);
  };
  const handleDeleteRoute = async (id) => {
    await deleteRoute(id).catch(() => {});
    setRoutes(prev => prev.filter(r => r.id !== id));
  };

  // ── Stations CRUD ──
  const handleAddStation = async (form) => {
    setLoading(true); setError('');
    try {
      const data = await createStation(form);
      if (data.station) setStations(prev => [...prev, data.station]);
      else setError(data.error || 'Failed to add station.');
    } catch { setError('Server error.'); }
    setLoading(false);
  };
  const handleDeleteStation = async (id) => {
    await deleteStation(id).catch(() => {});
    setStations(prev => prev.filter(s => s.id !== id));
  };

  // ── Buses CRUD ──
  const handleAddBus = async (form) => {
    setLoading(true); setError('');
    try {
      const data = await createBus(form);
      if (data.bus) setBuses(prev => [...prev, data.bus]);
      else setError(data.error || 'Failed to add bus.');
    } catch { setError('Server error.'); }
    setLoading(false);
  };
  const handleDeleteBus = async (id) => {
    await deleteBus(id).catch(() => {});
    setBuses(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.logo}>🚌 Red Bus Admin</div>
        <button style={styles.logoutBtn} onClick={handleLogout}>Log out</button>
      </header>

      <div style={styles.body}>
        <h1 style={styles.pageTitle}>Management Dashboard</h1>

        {/* Tabs */}
        <div style={styles.tabs}>
          {TABS.map(tab => (
            <button
              key={tab}
              style={styles.tab(activeTab === tab)}
              onClick={() => { setActiveTab(tab); setError(''); }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'Routes' && (
          <CrudPanel
            sectionLabel="Route"
            fields={[
              { key: 'name', label: 'Route Name (e.g. R-1)' },
              { key: 'description', label: 'Description' },
            ]}
            items={routes}
            onAdd={handleAddRoute}
            onDelete={handleDeleteRoute}
            loading={loading}
            error={error}
          />
        )}

        {activeTab === 'Stations' && (
          <CrudPanel
            sectionLabel="Station"
            fields={[
              { key: 'name', label: 'Station Name' },
              { key: 'area', label: 'Area / Locality' },
            ]}
            items={stations}
            onAdd={handleAddStation}
            onDelete={handleDeleteStation}
            loading={loading}
            error={error}
          />
        )}

        {activeTab === 'Buses' && (
          <CrudPanel
            sectionLabel="Bus"
            fields={[
              { key: 'bus_number', label: 'Bus Number' },
              { key: 'route_id', label: 'Route ID' },
              { key: 'capacity', label: 'Capacity' },
            ]}
            items={buses}
            onAdd={handleAddBus}
            onDelete={handleDeleteBus}
            loading={loading}
            error={error}
          />
        )}
      </div>
    </div>
  );
}