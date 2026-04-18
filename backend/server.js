// server.js — Karachi Red Bus Node.js Backend
// Run with: node server.js

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5000;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// ─── In-memory "database" (replace with MySQL later) ─────────────────────────
let routes = [
  { id: 1, name: 'R-1', description: 'Saddar → Clifton → Korangi' },
  { id: 2, name: 'R-2', description: 'North Nazimabad → Gulshan → Landhi' },
  { id: 3, name: 'R-3', description: 'Saddar → Gulshan-e-Iqbal → Landhi' },
];

let stations = [
  { id: 1, name: 'Saddar',           area: 'Central Karachi' },
  { id: 2, name: 'Clifton',          area: 'South Karachi' },
  { id: 3, name: 'Gulshan-e-Iqbal',  area: 'East Karachi' },
  { id: 4, name: 'Korangi',          area: 'East Karachi' },
  { id: 5, name: 'Landhi',           area: 'East Karachi' },
  { id: 6, name: 'North Nazimabad',  area: 'North Karachi' },
];

let buses = [
  { id: 1, bus_number: 'KB-101', route_id: 1, capacity: 50 },
  { id: 2, bus_number: 'KB-102', route_id: 2, capacity: 45 },
  { id: 3, bus_number: 'KB-103', route_id: 3, capacity: 50 },
];

// Simple counter for IDs
let nextId = { routes: 4, stations: 7, buses: 4 };

// Hardcoded admin credentials (replace with DB lookup later)
const ADMIN = { username: 'admin1', password: 'habib27' };
let sessions = new Set(); // store active tokens

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN.username && password === ADMIN.password) {
    const token = Math.random().toString(36).slice(2); // simple token
    sessions.add(token);
    return res.json({ success: true, token });
  }
  res.status(401).json({ success: false, message: 'Invalid credentials' });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  sessions.delete(token);
  res.json({ success: true });
});

// Middleware to protect admin routes
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── Routes CRUD ──────────────────────────────────────────────────────────────
app.get('/api/routes', requireAuth, (req, res) => {
  res.json({ routes });
});

app.post('/api/routes', requireAuth, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Route name is required' });
  const newRoute = { id: nextId.routes++, name, description: description || '' };
  routes.push(newRoute);
  res.json({ route: newRoute });
});

app.delete('/api/routes/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  routes = routes.filter(r => r.id !== id);
  res.json({ success: true });
});

// ─── Stations CRUD ────────────────────────────────────────────────────────────
app.get('/api/stations', (req, res) => {
  res.json({ stations }); // public — commuters need this
});

app.post('/api/stations', requireAuth, (req, res) => {
  const { name, area } = req.body;
  if (!name) return res.status(400).json({ error: 'Station name is required' });
  const newStation = { id: nextId.stations++, name, area: area || '' };
  stations.push(newStation);
  res.json({ station: newStation });
});

app.delete('/api/stations/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  stations = stations.filter(s => s.id !== id);
  res.json({ success: true });
});

// ─── Buses CRUD ───────────────────────────────────────────────────────────────
app.get('/api/buses', requireAuth, (req, res) => {
  res.json({ buses });
});

app.post('/api/buses', requireAuth, (req, res) => {
  const { bus_number, route_id, capacity } = req.body;
  if (!bus_number) return res.status(400).json({ error: 'Bus number is required' });
  const newBus = { id: nextId.buses++, bus_number, route_id: parseInt(route_id) || null, capacity: parseInt(capacity) || 0 };
  buses.push(newBus);
  res.json({ bus: newBus });
});

app.delete('/api/buses/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  buses = buses.filter(b => b.id !== id);
  res.json({ success: true });
});

// ─── Route Finder ─────────────────────────────────────────────────────────────
// Simple hardcoded graph — replace with DB-driven BFS/Dijkstra later
const GRAPH = {
  1: { name: 'Saddar',          neighbors: [2, 3] },         // R-1 and R-3
  2: { name: 'Clifton',         neighbors: [1, 4] },         // R-1
  3: { name: 'Gulshan-e-Iqbal', neighbors: [1, 4, 5, 6] },  // R-2, R-3
  4: { name: 'Korangi',         neighbors: [2, 3, 5] },      // R-1
  5: { name: 'Landhi',          neighbors: [3, 4, 6] },      // R-2, R-3
  6: { name: 'North Nazimabad', neighbors: [3, 5] },         // R-2
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

  if (!GRAPH[from] || !GRAPH[to]) {
    return res.status(400).json({ error: 'Invalid station IDs' });
  }
  if (from === to) {
    return res.status(400).json({ error: 'Start and destination are the same' });
  }

  const path = bfs(from, to);
  if (!path) return res.status(404).json({ error: 'No route found between these stations' });

  const steps = [];
  steps.push({
    type: 'board',
    instruction: `Board bus at ${GRAPH[from].name}`,
    detail: 'Check the route board on the bus before boarding',
  });

  for (let i = 1; i < path.length - 1; i++) {
    steps.push({
      type: 'transfer',
      instruction: `Pass through ${GRAPH[path[i]].name}`,
      detail: 'Stay on the bus or transfer here if needed',
    });
  }

  steps.push({
    type: 'exit',
    instruction: `Exit at ${GRAPH[to].name}`,
    detail: 'Your destination — press the stop button before arriving',
  });

  res.json({
    total_stops: path.length,
    buses_required: path.length > 3 ? 2 : 1,
    eta_minutes: path.length * 8,
    steps,
  });
});

// ─── Live bus positions (simulated) ──────────────────────────────────────────
// Each bus moves one step along its route every 10 seconds
const busPositions = { 1: 0, 2: 0, 3: 1 };
const busRoutes = {
  1: [1, 2, 4],       // R-1: Saddar → Clifton → Korangi
  2: [6, 3, 5],       // R-2: North Nazimabad → Gulshan → Landhi
  3: [1, 3, 4, 5],    // R-3: Saddar → Gulshan → Korangi → Landhi
};

setInterval(() => {
  for (const busId in busRoutes) {
    const route = busRoutes[busId];
    busPositions[busId] = (busPositions[busId] + 1) % route.length;
  }
}, 10000);

app.get('/api/bus-positions', (req, res) => {
  const positions = buses.map(bus => ({
    bus_id:     bus.id,
    bus_number: bus.bus_number,
    route_id:   bus.route_id,
    station_id: busRoutes[bus.id]?.[busPositions[bus.id]] ?? null,
    station_name: GRAPH[busRoutes[bus.id]?.[busPositions[bus.id]]]?.name ?? 'Unknown',
  }));
  res.json({ positions });
});

app.listen(PORT, () => {
  console.log(`\n🚌 Karachi Red Bus backend running at http://localhost:${PORT}`);
  console.log(`   Admin login: admin1 / habib27\n`);
});
