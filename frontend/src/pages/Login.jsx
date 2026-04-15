// import { useState } from 'react';
// import { useNavigate } from 'react-router-dom';

// export default function Login() {
//   const [user, setUser] = useState('');
//   const [pass, setPass] = useState('');
//   const navigate = useNavigate();

//   const handleLogin = () => {
//     // We'll use your admin credentials from the database
//     if (user === "admin1" && pass === "habib27") {
//       navigate('/dashboard'); 
//     } else {
//       alert("Invalid Credentials. Hint: admin1 / habib27");
//     }
//   };

//   return (
//     <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Arial' }}>
//       <h2 style={{ color: '#8B1A1A' }}>KARACHI RED BUS ADMIN</h2>
//       <div style={{ display: 'flex', flexDirection: 'column', width: '300px', margin: '0 auto', gap: '10px' }}>
//         <input type="text" placeholder="Username" onChange={e => setUser(e.target.value)} style={{ padding: '10px' }} />
//         <input type="password" placeholder="Password" onChange={e => setPass(e.target.value)} style={{ padding: '10px' }} />
//         <button onClick={handleLogin} style={{ padding: '10px', background: '#8B1A1A', color: 'white', border: 'none', cursor: 'pointer' }}>
//           Login
//         </button>
//       </div>
//     </div>
//   );
// }

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f0f13',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Segoe UI', sans-serif",
    color: '#fff',
    padding: '1rem',
  },
  container: {
    width: '100%',
    maxWidth: '380px',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.4)',
    textDecoration: 'none',
    marginBottom: '2rem',
  },
  logo: {
    fontSize: '2rem',
    marginBottom: '0.4rem',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: '800',
    marginBottom: '0.3rem',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '0.88rem',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: '2rem',
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '2rem',
  },
  inputGroup: {
    marginBottom: '1.2rem',
  },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: '600',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: '0.5rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  btn: {
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
  },
  errorBox: {
    background: 'rgba(231,76,60,0.15)',
    border: '1px solid rgba(231,76,60,0.4)',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    fontSize: '0.87rem',
    marginBottom: '1rem',
    color: '#ff8a80',
  },
};

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
  if (!username || !password) {
    setError('Please enter your username and password.');
    return;
  }
  
  setError('');
  setLoading(true);

  try {
    // We fetch from your Node server (Port 5000) instead of using the '../api' import
    const response = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
      // 1. Save the token your Node server sends
      localStorage.setItem('adminToken', data.token || 'true');
      // 2. Redirect to the Dashboard
      navigate('/dashboard');
    } else {
      setError(data.message || 'Invalid credentials');
    }
  } catch (err) {
    setError('Cannot connect to server. Make sure Node.js is running on port 5000.');
  } finally {
    setLoading(false);
  }
};

  // Allow Enter key to submit
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <a href="/" style={styles.backLink}>← Back to Route Finder</a>

        <div style={styles.logo}>🚌</div>
        <h1 style={styles.title}>Admin Login</h1>
        <p style={styles.subtitle}>Karachi Red Bus — Management Portal</p>

        <div style={styles.card}>
          {error && <div style={styles.errorBox}>{error}</div>}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Username</label>
            <input
              style={styles.input}
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="username"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="current-password"
            />
          </div>

          <button
            style={styles.btn}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </div>
      </div>
    </div>
  );
}