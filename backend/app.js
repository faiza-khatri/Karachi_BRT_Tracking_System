require('dotenv').config();
const express    = require('express');
const mysql      = require('mysql2');
const cors       = require('cors');
const simulation = require('./simulation');

const app  = express();
const PORT = 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// ─── MySQL Connection Pool ────────────────────────────────────────────────────
const db = mysql.createPool({
  host:               process.env.DB_HOST,
  port:               parseInt(process.env.DB_PORT),
  user:               process.env.DB_USER,
  password:           process.env.DB_PASS,
  database:           process.env.DB_NAME,
  ssl:                { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
});

db.getConnection((err, conn) => {
  if (err) { console.error('❌ DB Error:', err.message); return; }
  console.log('✅ Connected to Karachi Red Bus DB!');
  conn.release();
  // Start simulation only after DB is confirmed connected
  simulation.startSimulation(db);
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
let sessions = new Set();

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.query('SELECT * FROM Admin WHERE username = ? AND password_hash = ?',
    [username, password],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length > 0) {
        const token = Math.random().toString(36).slice(2);
        sessions.add(token);
        return res.json({ success: true, token });
      }
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  );
});

app.post('/api/logout', (req, res) => {
  sessions.delete(req.headers.authorization?.split(' ')[1]);
  res.json({ success: true });
});

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !sessions.has(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ─── Routes CRUD ──────────────────────────────────────────────────────────────
app.get('/api/routes', requireAuth, (req, res) => {
  db.query('SELECT route_id AS id, route_code, start_point, end_point, category FROM Route',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ routes: results });
    }
  );
});

app.post('/api/routes', requireAuth, (req, res) => {
  const { route_code, start_point, end_point, category } = req.body;
  db.query(
    'INSERT INTO Route (route_code, start_point, end_point, category) VALUES (?, ?, ?, ?)',
    [route_code, start_point || '', end_point || '', category || 'BRT'],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ route: { id: result.insertId, route_code, start_point, end_point, category } });
    }
  );
});

app.delete('/api/routes/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM Route WHERE route_id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ─── Stations CRUD ────────────────────────────────────────────────────────────
app.get('/api/stations', requireAuth, (req, res) => {
  db.query('SELECT stop_id AS id, stop_name, landmark, latitude, longitude FROM Stop',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ stations: results });
    }
  );
});

app.post('/api/stations', requireAuth, (req, res) => {
  const { stop_name, landmark, latitude, longitude } = req.body;
  db.query(
    'INSERT INTO Stop (stop_name, landmark, latitude, longitude) VALUES (?, ?, ?, ?)',
    [stop_name, landmark || '', latitude || null, longitude || null],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ station: { id: result.insertId, stop_name, landmark, latitude, longitude } });
    }
  );
});

app.delete('/api/stations/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM Stop WHERE stop_id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ─── Buses CRUD ───────────────────────────────────────────────────────────────
app.get('/api/buses', requireAuth, (req, res) => {
  db.query('SELECT bus_id AS id, bus_number, route_id FROM Bus', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ buses: results });
  });
});

app.post('/api/buses', requireAuth, (req, res) => {
  const { bus_number, route_id } = req.body;
  db.query(
    'INSERT INTO Bus (bus_number, route_id) VALUES (?, ?)',
    [bus_number, parseInt(route_id) || null],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ bus: { id: result.insertId, bus_number, route_id } });
    }
  );
});

app.delete('/api/buses/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM Bus WHERE bus_id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ─── Live Bus Positions (Simulation-driven) ───────────────────────────────────
// Returns interpolated lat/lng + ETA to all stops on the route
app.get('/api/bus-positions', (req, res) => {
  const positions = simulation.getLivePositions();
  res.json({ positions, timestamp: new Date().toISOString() });
});

// ─── Public: All Stops with coords ───────────────────────────────────────────
app.get('/api/stops', (req, res) => {
  db.query(
    'SELECT stop_id, stop_name, landmark, latitude, longitude FROM Stop ORDER BY stop_name',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ stops: results });
    }
  );
});

// ─── Public: Route details with ordered stops ─────────────────────────────────
app.get('/api/routes/:id/stops', (req, res) => {
  db.query(`
    SELECT rs.stop_sequence, rs.travel_time_from_prev_mins,
           s.stop_id, s.stop_name, s.landmark, s.latitude, s.longitude
    FROM Route_Stop rs
    JOIN Stop s ON rs.stop_id = s.stop_id
    WHERE rs.route_id = ?
    ORDER BY rs.stop_sequence
  `, [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ stops: results });
  });
});

// ─── Route Finder (BFS on actual DB graph) ────────────────────────────────────
// Find route between two stop_ids using the loaded simulation graph
app.get('/api/find-route', (req, res) => {
  const fromId = parseInt(req.query.from);
  const toId   = parseInt(req.query.to);

  if (!fromId || !toId) return res.status(400).json({ error: 'Provide from and to stop_id params' });
  if (fromId === toId)  return res.status(400).json({ error: 'Start and destination are the same' });

  // Build adjacency from simulation's loaded route data
  const routeData = simulation.routes;
  const stopNames = {};  // stop_id → stop_name
  const graph     = {}; // stop_id → Set of {stop_id, route_id, travel_time}

  for (const [routeId, route] of Object.entries(routeData)) {
    const stops = route.stops;
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      stopNames[s.stop_id] = s.stop_name;
      if (!graph[s.stop_id]) graph[s.stop_id] = [];

      if (i > 0) {
        const prev = stops[i - 1];
        graph[s.stop_id].push({ stop_id: prev.stop_id, route_id: parseInt(routeId), travel_time: s.travel_time });
        graph[prev.stop_id] = graph[prev.stop_id] || [];
        graph[prev.stop_id].push({ stop_id: s.stop_id, route_id: parseInt(routeId), travel_time: s.travel_time });
      }
    }
  }

  if (!graph[fromId]) return res.status(404).json({ error: 'Start stop not found in any route' });
  if (!graph[toId])   return res.status(404).json({ error: 'Destination stop not found in any route' });

  // BFS (finds fewest stops; could be Dijkstra for shortest time)
  const visited = new Set();
  const queue   = [{ stop_id: fromId, path: [fromId], routeIds: [], totalMins: 0 }];

  let found = null;
  while (queue.length) {
    const { stop_id, path, routeIds, totalMins } = queue.shift();
    if (stop_id === toId) { found = { path, routeIds, totalMins }; break; }
    if (visited.has(stop_id)) continue;
    visited.add(stop_id);

    for (const neighbor of (graph[stop_id] || [])) {
      if (!visited.has(neighbor.stop_id)) {
        queue.push({
          stop_id:   neighbor.stop_id,
          path:      [...path, neighbor.stop_id],
          routeIds:  [...routeIds, neighbor.route_id],
          totalMins: totalMins + neighbor.travel_time,
        });
      }
    }
  }

  if (!found) return res.status(404).json({ error: 'No route found between these stops' });

  const steps = found.path.map((stopId, i) => ({
    stop_id:   stopId,
    stop_name: stopNames[stopId] || `Stop ${stopId}`,
    action:    i === 0 ? 'board' : i === found.path.length - 1 ? 'exit' : 'pass',
    route_id:  found.routeIds[i] ?? null,
  }));

  res.json({
    from:        stopNames[fromId],
    to:          stopNames[toId],
    total_stops: found.path.length,
    eta_minutes: found.totalMins,
    steps,
  });
});

// ─── ETA: Which buses are coming to a stop and when ──────────────────────────
app.get('/api/stop/:stopId/arrivals', (req, res) => {
  const stopId   = parseInt(req.params.stopId);
  const positions = simulation.getLivePositions();

  const arrivals = positions
    .filter(bus => bus.eta_to_stops && bus.eta_to_stops[stopId] !== undefined)
    .map(bus => ({
      bus_id:     bus.bus_id,
      bus_number: bus.bus_number,
      route_id:   bus.route_id,
      eta_minutes: bus.eta_to_stops[stopId],
    }))
    .sort((a, b) => a.eta_minutes - b.eta_minutes);

  res.json({ stop_id: stopId, arrivals });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚌 Karachi Red Bus backend running at http://localhost:${PORT}\n`);
});