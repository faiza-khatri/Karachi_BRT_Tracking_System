import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const navigate = useNavigate();

  const handleLogin = () => {
    // We'll use your admin credentials from the database
    if (user === "admin1" && pass === "habib27") {
      navigate('/dashboard'); 
    } else {
      alert("Invalid Credentials. Hint: admin1 / habib27");
    }
  };

  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Arial' }}>
      <h2 style={{ color: '#8B1A1A' }}>KARACHI RED BUS ADMIN</h2>
      <div style={{ display: 'flex', flexDirection: 'column', width: '300px', margin: '0 auto', gap: '10px' }}>
        <input type="text" placeholder="Username" onChange={e => setUser(e.target.value)} style={{ padding: '10px' }} />
        <input type="password" placeholder="Password" onChange={e => setPass(e.target.value)} style={{ padding: '10px' }} />
        <button onClick={handleLogin} style={{ padding: '10px', background: '#8B1A1A', color: 'white', border: 'none', cursor: 'pointer' }}>
          Login
        </button>
      </div>
    </div>
  );
}