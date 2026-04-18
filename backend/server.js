// server.js — Karachi Red Bus Node.js Backend
// Run with: node server.js

const express = require('express');
const mysql   = require('mysql2');
const cors    = require('cors');
const app     = express();
const PORT    = 5000;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// ─── MySQL Connection Pool ────────────────────────────────────────────────────
const db = mysql.createPool({
  host:             'localhost',
  user:             'root',
  password:         'habib27',
  database:         'karachi_red_bus',
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
});

// Test DB connection on startup
db.getConnection((err, conn) => {
  if (err) console.error('❌ DB Error:', err.message);
  else { console.log('✅ Connected to Karachi Red Bus DB!'); conn.release(); }
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
let sessions = new Set(); // active tokens (still in-memory — fine for now)

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const sql = 'SELECT * FROM admins WHERE username = ? AND password_hash = ?';
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
  db.query('SELECT * FROM routes', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ routes: results });
  });
});

app.post('/api/routes', requireAuth, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Route name is required' });
  db.query('INSERT INTO routes (name, description) VALUES (?, ?)', [name, description || ''], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ route: { id: result.insertId, name, description } });
  });
});

app.delete('/api/routes/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM routes WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ─── Stations CRUD ────────────────────────────────────────────────────────────
app.get('/api/stations', (req, res) => {
  db.query('SELECT * FROM stations', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ stations: results });
  });
});

app.post('/api/stations', requireAuth, (req, res) => {
  const { name, area } = req.body;
  if (!name) return res.status(400).json({ error: 'Station name is required' });
  db.query('INSERT INTO stations (name, area) VALUES (?, ?)', [name, area || ''], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ station: { id: result.insertId, name, area } });
  });
});

app.delete('/api/stations/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM stations WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ─── Buses CRUD ───────────────────────────────────────────────────────────────
app.get('/api/buses', requireAuth, (req, res) => {
  db.query('SELECT * FROM buses', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ buses: results });
  });
});

app.post('/api/buses', requireAuth, (req, res) => {
  const { bus_number, route_id, capacity } = req.body;
  if (!bus_number) return res.status(400).json({ error: 'Bus number is required' });
  db.query(
    'INSERT INTO buses (bus_number, route_id, capacity) VALUES (?, ?, ?)',
    [bus_number, parseInt(route_id) || null, parseInt(capacity) || 0],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ bus: { id: result.insertId, bus_number, route_id, capacity } });
    }
  );
});

app.delete('/api/buses/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM buses WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ─── Route Finder (BFS — still hardcoded graph for now) ───────────────────────
const GRAPH = {
  1: { name: 'Saddar',          neighbors: [2, 3] },
  2: { name: 'Clifton',         neighbors: [1, 4] },
  3: { name: 'Gulshan-e-Iqbal', neighbors: [1, 4, 5, 6] },
  4: { name: 'Korangi',         neighbors: [2, 3, 5] },
  5: { name: 'Landhi',          neighbors: [3, 4, 6] },
  6: { name: 'North Nazimabad', neighbors: [3, 5] },
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
  if (!path) return res.status(404).json({ error: 'No route found between these stations' });

  const steps = [];
  steps.push({ type: 'board', instruction: `Board bus at ${GRAPH[from].name}`, detail: 'Check the route board on the bus before boarding' });
  for (let i = 1; i < path.length - 1; i++) {
    steps.push({ type: 'transfer', instruction: `Pass through ${GRAPH[path[i]].name}`, detail: 'Stay on the bus or transfer here if needed' });
  }
  steps.push({ type: 'exit', instruction: `Exit at ${GRAPH[to].name}`, detail: 'Your destination — press the stop button before arriving' });

  res.json({ total_stops: path.length, buses_required: path.length > 3 ? 2 : 1, eta_minutes: path.length * 8, steps });
});

// ─── Live Bus Positions (simulated) ──────────────────────────────────────────
const busPositions = { 1: 0, 2: 0, 3: 1 };
const busRoutes = {
  1: [1, 2, 4],
  2: [6, 3, 5],
  3: [1, 3, 4, 5],
};

setInterval(() => {
  for (const busId in busRoutes) {
    busPositions[busId] = (busPositions[busId] + 1) % busRoutes[busId].length;
  }
}, 10000);

app.get('/api/bus-positions', (req, res) => {
  db.query('SELECT * FROM buses', (err, buses) => {
    if (err) return res.status(500).json({ error: err.message });
    const positions = buses.map(bus => ({
      bus_id:       bus.id,
      bus_number:   bus.bus_number,
      route_id:     bus.route_id,
      station_id:   busRoutes[bus.id]?.[busPositions[bus.id]] ?? null,
      station_name: GRAPH[busRoutes[bus.id]?.[busPositions[bus.id]]]?.name ?? 'Unknown',
    }));
    res.json({ positions });
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚌 Karachi Red Bus backend running at http://localhost:${PORT}`);
  console.log(`   Admin login: admin1 / habib27\n`);
});