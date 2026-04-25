import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!username || !password) { setError('Enter your username and password.'); return; }
    setError(''); setLoading(true);
    try {
      const res  = await fetch('https://karachibrt-n8yduxi8.b4a.run/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('adminToken', data.token);
        navigate('/dashboard');
      } else {
        setError(data.message || 'Invalid credentials');
      }
    } catch {
      setError('Cannot connect to server. Make sure Node.js is running on port 5000.');
    }
    setLoading(false);
  };

  const onKey = (e) => { if (e.key === 'Enter') handleLogin(); };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }

        .login-page {
          min-height: 100vh;
          display: flex;
          font-family: 'DM Sans', sans-serif;
          background: #0c0c0f;
        }

        /* Left panel — decorative */
        .login-panel {
          flex: 1;
          background: #b91c1c;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 3rem;
        }
        @media (max-width: 700px) { .login-panel { display: none; } }

        .panel-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .panel-bus {
          font-size: 8rem;
          line-height: 1;
          position: relative;
          filter: drop-shadow(0 20px 40px rgba(0,0,0,0.4));
          animation: float 4s ease-in-out infinite;
        }
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-12px); }
        }
        .panel-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 4rem;
          color: #fff;
          line-height: 1;
          position: relative;
          margin-top: 1rem;
          letter-spacing: 0.02em;
        }
        .panel-sub {
          color: rgba(255,255,255,0.6);
          font-size: 0.9rem;
          margin-top: 0.5rem;
          position: relative;
        }
        .panel-dots {
          position: absolute;
          top: 2rem; right: 2rem;
          display: grid;
          grid-template-columns: repeat(5,1fr);
          gap: 10px;
        }
        .dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: rgba(255,255,255,0.25);
        }

        /* Right panel — form */
        .login-form-side {
          width: 420px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 3rem 2.5rem;
          background: #0c0c0f;
        }
        @media (max-width: 700px) { .login-form-side { width: 100%; } }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          color: rgba(255,255,255,0.35);
          text-decoration: none;
          font-size: 0.82rem;
          margin-bottom: 2.5rem;
          transition: color 0.2s;
        }
        .back-link:hover { color: rgba(255,255,255,0.7); }

        .form-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2.8rem;
          color: #fff;
          letter-spacing: 0.03em;
          line-height: 1;
          margin-bottom: 0.4rem;
        }
        .form-subtitle {
          color: rgba(255,255,255,0.35);
          font-size: 0.88rem;
          margin-bottom: 2.5rem;
        }

        .field { margin-bottom: 1.2rem; }
        .field label {
          display: block;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
          margin-bottom: 0.5rem;
        }
        .field input {
          width: 100%;
          padding: 0.8rem 1rem;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.05);
          color: #fff;
          font-size: 0.95rem;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .field input:focus {
          border-color: #b91c1c;
          background: rgba(185,28,28,0.08);
        }

        .error-box {
          background: rgba(185,28,28,0.15);
          border: 1px solid rgba(185,28,28,0.4);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          color: #fca5a5;
          font-size: 0.85rem;
          margin-bottom: 1.2rem;
        }

        .login-btn {
          width: 100%;
          padding: 0.9rem;
          border-radius: 8px;
          border: none;
          background: #b91c1c;
          color: #fff;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.2rem;
          letter-spacing: 0.08em;
          cursor: pointer;
          margin-top: 0.5rem;
          transition: background 0.2s, transform 0.1s;
          position: relative;
          overflow: hidden;
        }
        .login-btn:hover:not(:disabled) { background: #991b1b; }
        .login-btn:active:not(:disabled) { transform: scale(0.98); }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .hint {
          margin-top: 1.5rem;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          font-size: 0.8rem;
          color: rgba(255,255,255,0.25);
          text-align: center;
        }
        .hint span { color: rgba(255,255,255,0.45); font-weight: 600; }
      `}</style>

      <div className="login-page">
        {/* Left decorative panel */}
        <div className="login-panel">
          <div className="panel-grid" />
          <div className="panel-dots">
            {Array.from({length: 25}).map((_,i) => <div key={i} className="dot" />)}
          </div>
          <div className="panel-bus">🚌</div>
          <h1 className="panel-title">Karachi<br/>Red Bus</h1>
          <p className="panel-sub">City Transit Management System</p>
        </div>

        {/* Right form panel */}
        <div className="login-form-side">
          <a href="/" className="back-link">← Back to Route Finder</a>

          <h2 className="form-title">Admin<br/>Login</h2>
          <p className="form-subtitle">Management portal — authorised access only</p>

          {error && <div className="error-box">{error}</div>}

          <div className="field">
            <label>Username</label>
            <input
              type="text" placeholder="admin"
              value={username} onChange={e => setUsername(e.target.value)} onKeyDown={onKey}
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} onKeyDown={onKey}
              autoComplete="current-password"
            />
          </div>

          <button className="login-btn" onClick={handleLogin} disabled={loading}>
            {loading ? 'Logging in…' : 'Log In'}
          </button>

        </div>
      </div>
    </>
  );
}