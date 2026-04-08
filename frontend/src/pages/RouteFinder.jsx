import { useState, useEffect } from 'react';
import { findRoute, getAllStations } from '../api';

// ─── Styles (inline so this file is self-contained until you set up CSS) ─────
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #c0392b 0%, #8e1a10 60%, #1a1a2e 100%)',
    fontFamily: "'Segoe UI', sans-serif",
    color: '#fff',
    padding: '0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.2rem 2rem',
    background: 'rgba(0,0,0,0.25)',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    fontSize: '1.3rem',
    fontWeight: '700',
    letterSpacing: '0.02em',
  },
  adminLink: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.6)',
    textDecoration: 'none',
    border: '1px solid rgba(255,255,255,0.2)',
    padding: '0.4rem 0.9rem',
    borderRadius: '20px',
    transition: 'all 0.2s',
  },
  hero: {
    textAlign: 'center',
    padding: '3.5rem 1rem 2rem',
  },
  heroTitle: {
    fontSize: 'clamp(1.8rem, 5vw, 3rem)',
    fontWeight: '800',
    marginBottom: '0.5rem',
    letterSpacing: '-0.02em',
  },
  heroSub: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.65)',
    marginBottom: '2.5rem',
  },
  card: {
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '16px',
    padding: '2rem',
    maxWidth: '520px',
    margin: '0 auto',
  },
  inputGroup: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: '600',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: '0.4rem',
  },
  select: {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: '0.95rem',
    outline: 'none',
    cursor: 'pointer',
  },
  swapBtn: {
    display: 'block',
    margin: '0.5rem auto',
    background: 'none',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    color: '#fff',
    fontSize: '1.1rem',
    cursor: 'pointer',
    transition: 'transform 0.3s',
  },
  searchBtn: {
    width: '100%',
    padding: '0.85rem',
    borderRadius: '10px',
    border: 'none',
    background: '#e74c3c',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '0.5rem',
    letterSpacing: '0.03em',
    transition: 'background 0.2s',
  },
  resultsWrap: {
    maxWidth: '520px',
    margin: '1.5rem auto 3rem',
    padding: '0 1rem',
  },
  stepCard: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    padding: '1rem 1.2rem',
    marginBottom: '0.8rem',
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-start',
  },
  stepIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: '#e74c3c',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    flexShrink: 0,
  },
  stepTitle: {
    fontWeight: '600',
    fontSize: '0.95rem',
    marginBottom: '0.2rem',
  },
  stepSub: {
    fontSize: '0.82rem',
    color: 'rgba(255,255,255,0.55)',
  },
  errorBox: {
    background: 'rgba(231,76,60,0.2)',
    border: '1px solid rgba(231,76,60,0.5)',
    borderRadius: '10px',
    padding: '1rem',
    textAlign: 'center',
    fontSize: '0.9rem',
  },
  loadingText: {
    textAlign: 'center',
    padding: '1.5rem',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.9rem',
  },
  summaryBar: {
    display: 'flex',
    justifyContent: 'space-around',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    padding: '1rem',
    marginBottom: '1rem',
    textAlign: 'center',
  },
  summaryNum: {
    fontSize: '1.4rem',
    fontWeight: '800',
    color: '#e74c3c',
  },
  summaryLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.55)',
    marginTop: '0.2rem',
  },
};

// ─── Step icons based on type ─────────────────────────────────────────────────
function stepIcon(type) {
  if (type === 'board') return '🚌';
  if (type === 'transfer') return '🔄';
  if (type === 'exit') return '📍';
  return '➡️';
}

export default function RouteFinder() {
  const [stations, setStations] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stationsLoading, setStationsLoading] = useState(true);

  // Load all stations for the dropdowns
  useEffect(() => {
    getAllStations()
      .then((data) => {
        setStations(data.stations || []);
        setStationsLoading(false);
      })
      .catch(() => {
        // Backend not running yet — use placeholder stations so UI is visible
        setStations([
          { id: 1, name: 'Saddar' },
          { id: 2, name: 'Clifton' },
          { id: 3, name: 'Gulshan-e-Iqbal' },
          { id: 4, name: 'Korangi' },
          { id: 5, name: 'Landhi' },
          { id: 6, name: 'North Nazimabad' },
        ]);
        setStationsLoading(false);
      });
  }, []);

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
    setResult(null);
  };

  const handleSearch = async () => {
    if (!from || !to) {
      setError('Please select both a starting point and a destination.');
      return;
    }
    if (from === to) {
      setError('Starting point and destination cannot be the same.');
      return;
    }
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await findRoute(from, to);
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError('Could not connect to server. Make sure Flask is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <span>🚌</span>
          <span>Karachi Red Bus</span>
        </div>
        <a href="/login" style={styles.adminLink}>Admin →</a>
      </header>

      {/* Hero */}
      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>Find Your Route</h1>
        <p style={styles.heroSub}>Real-time bus guidance across Karachi</p>

        {/* Search Card */}
        <div style={styles.card}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>From</label>
            <select
              style={styles.select}
              value={from}
              onChange={(e) => { setFrom(e.target.value); setResult(null); }}
              disabled={stationsLoading}
            >
              <option value="">
                {stationsLoading ? 'Loading stations...' : 'Select starting point'}
              </option>
              {stations.map((s) => (
                <option key={s.id} value={s.id} style={{ background: '#1a1a2e' }}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <button style={styles.swapBtn} onClick={handleSwap} title="Swap">⇅</button>

          <div style={styles.inputGroup}>
            <label style={styles.label}>To</label>
            <select
              style={styles.select}
              value={to}
              onChange={(e) => { setTo(e.target.value); setResult(null); }}
              disabled={stationsLoading}
            >
              <option value="">
                {stationsLoading ? 'Loading stations...' : 'Select destination'}
              </option>
              {stations.map((s) => (
                <option key={s.id} value={s.id} style={{ background: '#1a1a2e' }}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <button
            style={styles.searchBtn}
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Find Route'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div style={styles.resultsWrap}>
        {loading && <p style={styles.loadingText}>🔍 Calculating best route...</p>}

        {error && <div style={styles.errorBox}>{error}</div>}

        {result && (
          <>
            {/* Summary bar */}
            <div style={styles.summaryBar}>
              <div>
                <div style={styles.summaryNum}>{result.total_stops ?? '—'}</div>
                <div style={styles.summaryLabel}>Stops</div>
              </div>
              <div>
                <div style={styles.summaryNum}>{result.buses_required ?? '—'}</div>
                <div style={styles.summaryLabel}>Buses</div>
              </div>
              <div>
                <div style={styles.summaryNum}>{result.eta_minutes ?? '—'} min</div>
                <div style={styles.summaryLabel}>Est. Time</div>
              </div>
            </div>

            {/* Step-by-step guidance */}
            {(result.steps || []).map((step, i) => (
              <div key={i} style={styles.stepCard}>
                <div style={styles.stepIcon}>{stepIcon(step.type)}</div>
                <div>
                  <div style={styles.stepTitle}>{step.instruction}</div>
                  {step.detail && <div style={styles.stepSub}>{step.detail}</div>}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}