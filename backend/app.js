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

// ─── Public: Stats (used by Dashboard) ───────────────────────────────────────
app.get('/api/stats', (req, res) => {
  db.query('SELECT COUNT(*) AS total_stops FROM Stop', (err, stopRes) => {
    if (err) return res.status(500).json({ error: err.message });
    db.query('SELECT COUNT(*) AS total_buses FROM Bus', (err2, busRes) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({
        total_stops:     stopRes[0].total_stops,
        total_buses:     busRes[0].total_buses,
        active_buses:    Object.keys(simulation.busStates).length,
        tick_interval_s: 10,
      });
    });
  });
});

// ─── Public: All Stops with coords ───────────────────────────────────────────
// Must be PUBLIC (no requireAuth) — LiveMap calls this without a token
app.get('/api/stops', (req, res) => {
  db.query(
    'SELECT stop_id, stop_name, landmark, latitude, longitude FROM Stop ORDER BY stop_name',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ stops: results });
    }
  );
});

// ─── Public: All routes with their ordered stops ──────────────────────────────
// CRITICAL: this MUST come before /api/routes/:id/stops
// otherwise Express matches "all-stops" as the :id param
app.get('/api/routes/all-stops', (req, res) => {
  db.query(`
    SELECT r.route_id, r.route_code, r.category,
           s.stop_id, s.latitude, s.longitude, s.stop_name,
           rs.stop_sequence
    FROM Route r
    JOIN Route_Stop rs ON r.route_id = rs.route_id
    JOIN Stop s ON rs.stop_id = s.stop_id
    ORDER BY r.route_id, rs.stop_sequence
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const routes = {};
    for (const row of rows) {
      if (!routes[row.route_id]) {
        routes[row.route_id] = {
          route_id:   row.route_id,
          route_code: row.route_code,
          category:   row.category,
          stops: [],
        };
      }
      routes[row.route_id].stops.push({
        stop_id:   row.stop_id,
        stop_name: row.stop_name,
        lat:       parseFloat(row.latitude),
        lng:       parseFloat(row.longitude),
      });
    }
    res.json({ routes: Object.values(routes) });
  });
});

// ─── Routes CRUD ──────────────────────────────────────────────────────────────
app.get('/api/routes', requireAuth, (req, res) => {
  db.query('SELECT route_id AS id, route_code, start_point, end_point, category FROM Route',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ routes: results });
    }
  );
});

// protected so only admin can trigger it
app.post('/api/simulation/reload', requireAuth, async (req, res) => {
  try {
    await simulation.reloadBuses();
    res.json({ success: true, buses: Object.keys(simulation.busStates).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  const id = req.params.id;
  // Must delete in FK dependency order:
  // 1. Simulated_Bus_Status references Bus
  // 2. Bus references Route
  // 3. Route_Stop references Route
  // 4. Then Route itself
  db.query('DELETE sbs FROM Simulated_Bus_Status sbs JOIN Bus b ON sbs.bus_id = b.bus_id WHERE b.route_id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.query('DELETE FROM Bus WHERE route_id = ?', [id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      db.query('DELETE FROM Route_Stop WHERE route_id = ?', [id], (err3) => {
        if (err3) return res.status(500).json({ error: err3.message });
        db.query('DELETE FROM Route WHERE route_id = ?', [id], (err4) => {
          if (err4) return res.status(500).json({ error: err4.message });
          res.json({ success: true });
        });
      });
    });
  });
});

// ─── Route stops (MUST come after /api/routes/all-stops) ─────────────────────
app.get('/api/routes/:id/stops', (req, res) => {
  db.query(`
    SELECT rs.route_stop_id, rs.stop_sequence, rs.travel_time_from_prev_mins,
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

app.post('/api/routes/:id/stops', requireAuth, (req, res) => {
  const { stop_id, stop_sequence, travel_time_from_prev_mins } = req.body;
  db.query(
    'INSERT INTO Route_Stop (route_id, stop_id, stop_sequence, travel_time_from_prev_mins) VALUES (?, ?, ?, ?)',
    [req.params.id, stop_id, stop_sequence, travel_time_from_prev_mins || 5],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, route_stop_id: result.insertId });
    }
  );
});

app.delete('/api/routes/:routeId/stops/:routeStopId', requireAuth, (req, res) => {
  db.query('DELETE FROM Route_Stop WHERE route_stop_id = ? AND route_id = ?',
    [req.params.routeStopId, req.params.routeId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
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
  // Remove from Route_Stop first
  db.query('DELETE FROM Route_Stop WHERE stop_id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.query('DELETE FROM Stop WHERE stop_id = ?', [req.params.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true });
    });
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
  // Remove from Simulated_Bus_Status first
  db.query('DELETE FROM Simulated_Bus_Status WHERE bus_id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.query('DELETE FROM Bus WHERE bus_id = ?', [req.params.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true });
    });
  });
});

// ─── Live Bus Positions ───────────────────────────────────────────────────────
app.get('/api/bus-positions', (req, res) => {
  const positions = simulation.getLivePositions();
  res.json({ positions, timestamp: new Date().toISOString() });
});

// ─── ETA: buses arriving at a stop ───────────────────────────────────────────
app.get('/api/stop/:stopId/arrivals', (req, res) => {
  const stopId    = parseInt(req.params.stopId);
  const positions = simulation.getLivePositions();
  const arrivals  = positions
    .filter(bus => bus.eta_to_stops && bus.eta_to_stops[stopId] !== undefined)
    .map(bus => ({
      bus_id:      bus.bus_id,
      bus_number:  bus.bus_number,
      route_id:    bus.route_id,
      eta_minutes: bus.eta_to_stops[stopId],
    }))
    .sort((a, b) => a.eta_minutes - b.eta_minutes);
  res.json({ stop_id: stopId, arrivals });
});

// ─── Route Finder (BFS from DB) ───────────────────────────────────────────────
app.get('/api/find-route', (req, res) => {
  const fromId = parseInt(req.query.from);
  const toId   = parseInt(req.query.to);
  if (!fromId || !toId) return res.status(400).json({ error: 'Provide from and to stop_id params' });
  if (fromId === toId)  return res.status(400).json({ error: 'Start and destination are the same' });

  db.query(`
    SELECT rs.route_id, rs.stop_id, rs.stop_sequence,
           rs.travel_time_from_prev_mins, s.stop_name
    FROM Route_Stop rs
    JOIN Stop s ON rs.stop_id = s.stop_id
    ORDER BY rs.route_id, rs.stop_sequence
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const stopNames = {};
    const graph     = {};
    const byRoute   = {};

    for (const row of rows) {
      stopNames[row.stop_id] = row.stop_name;
      if (!byRoute[row.route_id]) byRoute[row.route_id] = [];
      byRoute[row.route_id].push(row);
    }

    for (const [routeId, stops] of Object.entries(byRoute)) {
      for (let i = 1; i < stops.length; i++) {
        const prev = stops[i - 1];
        const curr = stops[i];
        const time = curr.travel_time_from_prev_mins || 5;
        if (!graph[prev.stop_id]) graph[prev.stop_id] = [];
        if (!graph[curr.stop_id]) graph[curr.stop_id] = [];
        graph[prev.stop_id].push({ stop_id: curr.stop_id, route_id: parseInt(routeId), travel_time: time });
        graph[curr.stop_id].push({ stop_id: prev.stop_id, route_id: parseInt(routeId), travel_time: time });
      }
    }

    if (!graph[fromId]) return res.status(404).json({ error: 'Start stop not found in any route' });
    if (!graph[toId])   return res.status(404).json({ error: 'Destination stop not found in any route' });

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

    const routeChanges = new Set(found.routeIds.filter(Boolean)).size;
    res.json({
      from:           stopNames[fromId],
      to:             stopNames[toId],
      total_stops:    found.path.length,
      buses_required: routeChanges,
      eta_minutes:    found.totalMins,
      steps,
    });
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚌 Karachi Red Bus backend running at http://localhost:${PORT}\n`);
});