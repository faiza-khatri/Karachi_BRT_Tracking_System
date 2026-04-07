import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    // Fetching the routes from your Node.js server (running on port 5000)
    fetch('http://localhost:5000/api/routes')
      .then(res => res.json())
      .then(data => setRoutes(data))
      .catch(err => console.error("Server not running?", err));
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2 style={{ borderBottom: '2px solid #8B1A1A' }}>Admin Dashboard - Bus Routes</h2>
      <table style={{ width: '100%', textAlign: 'left', marginTop: '20px' }}>
        <thead>
          <tr style={{ background: '#eee' }}>
            <th>Route Name</th>
            <th>Start Point</th>
            <th>End Point</th>
          </tr>
        </thead>
        <tbody>
          {routes.map(route => (
            <tr key={route.id}>
              <td>{route.route_name}</td>
              <td>{route.start_point}</td>
              <td>{route.end_point}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}