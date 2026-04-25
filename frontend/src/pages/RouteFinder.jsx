import { useState, useEffect } from 'react';
import { findRoute, getAllStations } from '../api';

export default function RouteFinder() {
  const [stations,        setStations]        = useState([]);
  const [from,            setFrom]            = useState('');
  const [to,              setTo]              = useState('');
  const [result,          setResult]          = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [stationsLoading, setStationsLoading] = useState(true);

  useEffect(() => {
    getAllStations()
      .then(data => { setStations(data.stations || []); setStationsLoading(false); })
      .catch(() => {
        setStations([
          { id:1, name:'Saddar' }, { id:2, name:'Clifton' },
          { id:3, name:'Gulshan-e-Iqbal' }, { id:4, name:'Korangi' },
          { id:5, name:'Landhi' }, { id:6, name:'North Nazimabad' },
        ]);
        setStationsLoading(false);
      });
  }, []);

  const handleSwap = () => {
    setFrom(to); setTo(from); setResult(null);
  };

  const handleSearch = async () => {
    if (!from || !to)  { setError('Please select both a starting point and a destination.'); return; }
    if (from === to)   { setError('Starting point and destination cannot be the same.'); return; }
    setError(''); setResult(null); setLoading(true);
    try {
      const data = await findRoute(from, to);
      if (data.error) setError(data.error);
      else setResult(data);
    } catch {
      setError('Could not connect to server. Make sure Node.js is running on port 5000.');
    }
    setLoading(false);
  };

  // Build enriched step list with transfer detection
  function buildSteps(steps) {
    return steps.map((step, i) => {
      const prevRouteId = i > 0 ? steps[i - 1].route_id : null;
      const isTransfer  = step.action === 'pass' && prevRouteId && step.route_id && prevRouteId !== step.route_id;

      let type        = step.action;
      let label       = step.stop_name;
      let sublabel    = step.route_id ? `Route ${step.route_id}` : '';
      let icon        = 'pass';

      if (step.action === 'board') {
        icon     = 'board';
        label    = `Board at ${step.stop_name}`;
        sublabel = step.route_id ? `Take Route ${step.route_id}` : '';
      } else if (isTransfer) {
        icon     = 'transfer';
        label    = `Transfer at ${step.stop_name}`;
        sublabel = `Switch to Route ${step.route_id}`;
      } else if (step.action === 'exit') {
        icon     = 'exit';
        label    = `Exit at ${step.stop_name}`;
        sublabel = 'Your destination';
      }

      return { ...step, icon, label, sublabel };
    });
  }

  const ROUTE_COLORS = {
    1: '#ef4444', 2: '#f59e0b', 3: '#22c55e',
    4: '#8b5cf6', 5: '#ec4899', 6: '#06b6d4',
  };
  const routeColor = (id) => ROUTE_COLORS[id] || '#94a3b8';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        .rf-page { min-height:100vh; background:#0c0c0f; font-family:'DM Sans',sans-serif; color:#fff; }

        .rf-header { display:flex; justify-content:space-between; align-items:center; padding:1.1rem 2rem; border-bottom:1px solid rgba(255,255,255,0.06); position:sticky; top:0; z-index:10; background:rgba(12,12,15,0.9); backdrop-filter:blur(10px); }
        .rf-logo { font-family:'Bebas Neue',sans-serif; font-size:1.4rem; letter-spacing:0.05em; display:flex; align-items:center; gap:0.5rem; }
        .rf-logo span.red { color:#ef4444; }
        .nav-links { display:flex; gap:0.5rem; }
        .nav-link { color:rgba(255,255,255,0.45); text-decoration:none; font-size:0.83rem; padding:0.4rem 0.9rem; border-radius:20px; border:1px solid rgba(255,255,255,0.1); transition:all 0.2s; }
        .nav-link:hover { color:#fff; border-color:rgba(255,255,255,0.25); }
        .nav-link.live-link { border-color:rgba(239,68,68,0.3); color:#ef4444; }
        .nav-link.live-link:hover { background:rgba(239,68,68,0.1); }

        .rf-hero { padding:4rem 1rem 0; text-align:center; position:relative; }
        .rf-hero::before { content:''; position:absolute; top:0; left:50%; transform:translateX(-50%); width:600px; height:300px; background:radial-gradient(ellipse, rgba(185,28,28,0.15) 0%, transparent 70%); pointer-events:none; }
        .rf-title { font-family:'Bebas Neue',sans-serif; font-size:clamp(3rem,8vw,5.5rem); letter-spacing:0.03em; line-height:0.9; position:relative; }
        .rf-title .accent { color:#ef4444; }
        .rf-sub { color:rgba(255,255,255,0.4); font-size:0.95rem; margin:1rem 0 2.5rem; }

        .rf-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:1.75rem; max-width:500px; margin:0 auto; }
        .rf-label { font-size:0.7rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,255,255,0.35); margin-bottom:0.4rem; display:block; }
        .rf-select { width:100%; padding:0.75rem 1rem; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.06); color:#fff; font-family:'DM Sans',sans-serif; font-size:0.95rem; outline:none; cursor:pointer; margin-bottom:0.75rem; transition:border-color 0.2s; }
        .rf-select:focus { border-color:#b91c1c; }
        .rf-select option { background:#1a1a1f; }

        .swap-row { display:flex; align-items:center; gap:0.75rem; margin-bottom:0.75rem; }
        .swap-line { flex:1; height:1px; background:rgba(255,255,255,0.07); }
        .swap-btn { width:36px; height:36px; border-radius:50%; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.5); font-size:1rem; cursor:pointer; transition:all 0.3s; display:flex; align-items:center; justify-content:center; }
        .swap-btn:hover { border-color:#ef4444; color:#ef4444; transform:rotate(180deg); }

        .search-btn { width:100%; padding:0.9rem; border-radius:8px; border:none; background:#b91c1c; color:#fff; font-family:'Bebas Neue',sans-serif; font-size:1.2rem; letter-spacing:0.08em; cursor:pointer; margin-top:0.25rem; transition:background 0.2s, transform 0.1s; }
        .search-btn:hover:not(:disabled) { background:#991b1b; }
        .search-btn:active:not(:disabled) { transform:scale(0.98); }
        .search-btn:disabled { opacity:0.6; cursor:not-allowed; }

        .rf-results { max-width:500px; margin:1.5rem auto 4rem; padding:0 1rem; }

        /* Summary bar */
        .summary-bar { display:flex; justify-content:space-around; background:rgba(185,28,28,0.1); border:1px solid rgba(185,28,28,0.25); border-radius:12px; padding:1.2rem; margin-bottom:1.5rem; text-align:center; animation:fadeUp 0.3s ease; }
        .summary-num { font-family:'Bebas Neue',sans-serif; font-size:2rem; color:#ef4444; line-height:1; }
        .summary-label { font-size:0.72rem; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.06em; margin-top:0.2rem; }

        /* View on map button */
        .map-btn { display:block; width:100%; padding:0.7rem; border-radius:8px; border:1px solid rgba(239,68,68,0.3); background:rgba(239,68,68,0.08); color:#ef4444; font-family:'DM Sans',sans-serif; font-size:0.88rem; font-weight:600; text-align:center; text-decoration:none; cursor:pointer; margin-bottom:1.5rem; transition:all 0.2s; }
        .map-btn:hover { background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.5); }

        /* Timeline */
        .timeline { position:relative; }
        .timeline::before { content:''; position:absolute; left:19px; top:0; bottom:0; width:2px; background:rgba(255,255,255,0.07); }

        .tl-step { display:flex; gap:1rem; align-items:flex-start; margin-bottom:0; position:relative; animation:fadeUp 0.35s ease both; }
        .tl-step:nth-child(1) { animation-delay:0.05s; }
        .tl-step:nth-child(2) { animation-delay:0.10s; }
        .tl-step:nth-child(3) { animation-delay:0.15s; }
        .tl-step:nth-child(4) { animation-delay:0.20s; }
        .tl-step:nth-child(5) { animation-delay:0.25s; }
        .tl-step:nth-child(6) { animation-delay:0.30s; }

        .tl-icon { width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1rem; flex-shrink:0; position:relative; z-index:1; border:2px solid #0c0c0f; }
        .tl-icon.board    { background:#b91c1c; }
        .tl-icon.transfer { background:#7c3aed; }
        .tl-icon.exit     { background:#0f766e; }
        .tl-icon.pass     { background:#1e293b; border-color:#374151; width:28px; height:28px; margin:5px 0 5px 5px; font-size:0.7rem; }

        .tl-content { flex:1; padding-bottom:1.25rem; }
        .tl-step:last-child .tl-content { padding-bottom:0; }

        .tl-label { font-size:0.92rem; font-weight:600; line-height:1.3; }
        .tl-label.board    { color:#fca5a5; }
        .tl-label.transfer { color:#c4b5fd; }
        .tl-label.exit     { color:#99f6e4; }
        .tl-label.pass     { color:rgba(255,255,255,0.55); font-weight:400; font-size:0.82rem; }

        .tl-sublabel { font-size:0.78rem; margin-top:0.2rem; }
        .tl-sublabel.board    { color:rgba(252,165,165,0.6); }
        .tl-sublabel.transfer { color:rgba(196,181,253,0.6); }
        .tl-sublabel.exit     { color:rgba(153,246,228,0.6); }
        .tl-sublabel.pass     { color:rgba(255,255,255,0.25); }

        .tl-route-pill { display:inline-block; padding:0.1rem 0.5rem; border-radius:20px; font-size:0.68rem; font-weight:700; letter-spacing:0.06em; margin-top:0.3rem; }

        .error-box { background:rgba(185,28,28,0.1); border:1px solid rgba(185,28,28,0.3); border-radius:10px; padding:1rem; text-align:center; font-size:0.9rem; color:#fca5a5; animation:fadeUp 0.3s ease; }
        .loading-text { text-align:center; padding:2rem; color:rgba(255,255,255,0.4); font-size:0.9rem; }

        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div className="rf-page">
        <header className="rf-header">
          <div className="rf-logo">🚌 Karachi <span className="red">Red</span> Bus</div>
          <div className="nav-links">
            <a href="/live" className="nav-link live-link">● Live Map</a>
            <a href="/login" className="nav-link">Admin →</a>
          </div>
        </header>

        <div className="rf-hero">
          <h1 className="rf-title">Find Your<br/><span className="accent">Route</span></h1>
          <p className="rf-sub">Step-by-step bus guidance across Karachi</p>

          <div className="rf-card">
            <label className="rf-label">From</label>
            <select className="rf-select" value={from}
              onChange={e => { setFrom(e.target.value); setResult(null); }}
              disabled={stationsLoading}>
              <option value="">{stationsLoading ? 'Loading…' : 'Select starting point'}</option>
              {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <div className="swap-row">
              <div className="swap-line"/>
              <button className="swap-btn" onClick={handleSwap} title="Swap">⇅</button>
              <div className="swap-line"/>
            </div>

            <label className="rf-label">To</label>
            <select className="rf-select" value={to}
              onChange={e => { setTo(e.target.value); setResult(null); }}
              disabled={stationsLoading}>
              <option value="">{stationsLoading ? 'Loading…' : 'Select destination'}</option>
              {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <button className="search-btn" onClick={handleSearch} disabled={loading}>
              {loading ? 'Searching…' : 'Find Route'}
            </button>
          </div>
        </div>

        <div className="rf-results">
          {loading && <p className="loading-text">🔍 Calculating best route…</p>}
          {error   && <div className="error-box">{error}</div>}

          {result && (
            <>
              {/* Summary */}
              <div className="summary-bar">
                <div>
                  <div className="summary-num">{result.total_stops ?? '—'}</div>
                  <div className="summary-label">Stops</div>
                </div>
                <div>
                  <div className="summary-num">{result.buses_required ?? '—'}</div>
                  <div className="summary-label">Buses</div>
                </div>
                <div>
                  <div className="summary-num">{result.eta_minutes ?? '—'}</div>
                  <div className="summary-label">Min ETA</div>
                </div>
              </div>

              {/* View on map */}
              <a href="/live" className="map-btn">
                🗺 View Live Map →
              </a>

              {/* Timeline */}
              <div className="timeline">
                {buildSteps(result.steps || []).map((step, i) => {
                  const color = routeColor(step.route_id);
                  return (
                    <div key={i} className="tl-step">
                      <div className={`tl-icon ${step.icon}`}>
                        {step.icon === 'board'    && '🚌'}
                        {step.icon === 'transfer' && '🔄'}
                        {step.icon === 'exit'     && '📍'}
                        {step.icon === 'pass'     && '·'}
                      </div>
                      <div className="tl-content">
                        <div className={`tl-label ${step.icon}`}>{step.label}</div>
                        {step.sublabel && (
                          <div className={`tl-sublabel ${step.icon}`}>{step.sublabel}</div>
                        )}
                        {(step.icon === 'board' || step.icon === 'transfer') && step.route_id && (
                          <span className="tl-route-pill"
                            style={{ background:`${color}22`, color, border:`1px solid ${color}55` }}>
                            Route {step.route_id}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}