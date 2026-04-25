require('dotenv').config();
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
const express = require('express');
const mysql   = require('mysql2');
const cors    = require('cors');
const app     = express();
const PORT    = 5000;

// app.use(cors({ origin: 'http://localhost:5173' }));
app.use(cors({ origin: '*' }));
app.use(express.json());

// // ─── MySQL Connection Pool ────────────────────────────────────────────────────
// const db = mysql.createPool({
//   host:               'localhost',
//   user:               'root',
//   password:           'habib27',
//   database:           'KarachiRedBusApp', 
//   waitForConnections: true,
//   connectionLimit:    10,
//   queueLimit:         0,
// });

// Change DB pool:
const db = mysql.createPool({
  host:               process.env.DB_HOST,
  port:               parseInt(process.env.DB_PORT),
  user:               process.env.DB_USER,
  password:           process.env.DB_PASS,
  database:           process.env.DB_NAME,
  ssl:                { rejectUnauthorized: false }, // required for Aiven
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
});

db.getConnection((err, conn) => {
  if (err) console.error('❌ DB Error:', err.message);
  else { console.log('✅ Connected to Karachi Red Bus DB!'); conn.release(); }
});

// ─── Admin Login Authentication ───────────────────────────────────────────────
let sessions = new Set();

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // Fixed: Removed 'AND role = ?' because it was causing errors if not provided
  const sql = 'SELECT * FROM Admin WHERE username = ? AND password_hash = ?';
  db.query(sql, [username, password], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) {
      const token = Math.random().toString(36).slice(2);
      sessions.add(token);
      return res.json({ success: true, token });
    }
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  sessions.delete(token);
  res.json({ success: true });
});

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}


// ─── Routes CRUD ──────────────────────────────────────────────────────────────
app.get('/api/routes', requireAuth, (req, res) => {
  // We alias route_id as "id" so React's item.id works
  const sql = 'SELECT route_id AS id, route_code, start_point, end_point, category FROM Route';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ routes: results });
  });
});

app.post('/api/routes', requireAuth, (req, res) => {
  const { route_code, start_point, end_point, category } = req.body;
  const sql = 'INSERT INTO Route (route_code, start_point, end_point, category) VALUES (?, ?, ?, ?)';
  db.query(sql, [route_code, start_point || '', end_point || '', category || 'BRT'], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    // Return "id" here too
    res.json({ route: { id: result.insertId, route_code, start_point, end_point, category } });
  });
});




app.delete('/api/routes/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM Route WHERE route_id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ─── Stations/Stops CRUD ──────────────────────────────────────────────────────

app.get('/api/stations', requireAuth, (req, res) => {
  const sql = 'SELECT stop_id AS id, stop_name, landmark FROM Stop';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ stations: results });
  });
});

app.post('/api/stations', requireAuth, (req, res) => {
  const { stop_name, landmark } = req.body;
  const sql = 'INSERT INTO Stop (stop_name, landmark) VALUES (?, ?)';
  db.query(sql, [stop_name, landmark || ''], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ station: { id: result.insertId, stop_name, landmark } });
  });
});

app.delete('/api/stations/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM Stop WHERE stop_id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ─── Buses CRUD ───────────────────────────────────────────────────────────────
app.get('/api/buses', requireAuth, (req, res) => {
  const sql = 'SELECT bus_id AS id, bus_number, route_id FROM Bus';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ buses: results });
  });
});

app.post('/api/buses', requireAuth, (req, res) => {
  const { bus_number, route_id } = req.body;
  const sql = 'INSERT INTO Bus (bus_number, route_id) VALUES (?, ?)';
  db.query(sql, [bus_number, parseInt(route_id) || null], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ bus: { id: result.insertId, bus_number, route_id } });
  });
});

app.delete('/api/buses/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM Bus WHERE bus_id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ─── Route Finder (Hardcoded Graph) ───────────────────────────────────────────
const GRAPH = {
  1: { name: 'Saddar',           neighbors: [2, 3] },
  2: { name: 'Clifton',          neighbors: [1, 4] },
  3: { name: 'Gulshan-e-Iqbal',  neighbors: [1, 4, 5, 6] },
  4: { name: 'Korangi',          neighbors: [2, 3, 5] },
  5: { name: 'Landhi',           neighbors: [3, 4, 6] },
  6: { name: 'North Nazimabad',  neighbors: [3, 5] },
};

function bfs(fromId, toId) {
  const visited = new Set();
  const queue = [[fromId, [fromId]]];
  while (queue.length) {
    const [current, path] = queue.shift();
    if (current === toId) return path;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const neighbor of (GRAPH[current]?.neighbors || [])) {
      if (!visited.has(neighbor)) queue.push([neighbor, [...path, neighbor]]);
    }
  }
  return null;
}

app.get('/api/find-route', (req, res) => {
  const from = parseInt(req.query.from);
  const to   = parseInt(req.query.to);
  if (!GRAPH[from] || !GRAPH[to]) return res.status(400).json({ error: 'Invalid station IDs' });
  if (from === to) return res.status(400).json({ error: 'Start and destination are the same' });

  const path = bfs(from, to);
  if (!path) return res.status(404).json({ error: 'No route found' });

  const steps = [];
  steps.push({ type: 'board', instruction: `Board at ${GRAPH[from].name}`, detail: 'Check the route board on the bus' });
  for (let i = 1; i < path.length - 1; i++) {
    steps.push({ type: 'transfer', instruction: `Pass through ${GRAPH[path[i]].name}`, detail: 'Stay on the bus' });
  }
  steps.push({ type: 'exit', instruction: `Exit at ${GRAPH[to].name}`, detail: 'Your destination' });

  res.json({ total_stops: path.length, buses_required: path.length > 3 ? 2 : 1, eta_minutes: path.length * 8, steps });
});

// ─── Live Bus Positions (Simulated) ───────────────────────────────────────────
const busPositions = { 1: 0, 2: 0, 3: 1 };
const busRoutes    = { 1: [1, 2, 4], 2: [6, 3, 5], 3: [1, 3, 4, 5] };

setInterval(() => {
  for (const busId in busRoutes) {
    busPositions[busId] = (busPositions[busId] + 1) % busRoutes[busId].length;
  }
}, 10000);

app.get('/api/bus-positions', (req, res) => {
  db.query('SELECT * FROM Bus', (err, buses) => {
    if (err) return res.status(500).json({ error: err.message });
    const positions = buses.map(bus => ({
      bus_id:       bus.bus_id,
      bus_number:   bus.bus_number,
      route_id:     bus.route_id,
      station_id:   busRoutes[bus.bus_id]?.[busPositions[bus.bus_id]] ?? null,
      station_name: GRAPH[busRoutes[bus.bus_id]?.[busPositions[bus.bus_id]]]?.name ?? 'Unknown',
    }));
    res.json({ positions });
  });
});

app.listen(PORT, () => {
  console.log(`\n🚌 Karachi Red Bus Unified Backend running at http://localhost:${PORT}`);
  console.log(`✅ Ready to serve React on http://localhost:5173\n`);
});