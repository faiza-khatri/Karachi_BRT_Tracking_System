// server.js — Karachi Red Bus Node.js Backend
const express = require('express');
const mysql   = require('mysql2');
const cors    = require('cors');
const app     = express();
const PORT    = 5000;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// ─── MySQL Connection Pool ────────────────────────────────────────────────────
const db = mysql.createPool({
  host:               'localhost',
  user:               'root',
  password:           'proj123', 
  database:           'KarachiRedBusApp', // Matches your CREATE DATABASE
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
});

db.getConnection((err, conn) => {
  if (err) console.error('❌ DB Error:', err.message);
  else { console.log('✅ Connected to Karachi Red Bus DB!'); conn.release(); }
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
let sessions = new Set();

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // Table: Admin | Attributes: username, password_hash
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

// ─── Routes CRUD ──────────────────────────────────────────────────────────────
app.get('/api/Route', requireAuth, (req, res) => {
  db.query('SELECT * FROM Route', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ routes: results });
  });
});

app.post('/api/Route', requireAuth, (req, res) => {
  const { route_code, start_point, end_point, category } = req.body;
  if (!route_code) return res.status(400).json({ error: 'Route code is required' });
  
  const sql = 'INSERT INTO Route (route_code, start_point, end_point, category) VALUES (?, ?, ?, ?)';
  db.query(sql, [route_code, start_point, end_point, category], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ route: { id: result.insertId, route_code, start_point, end_point, category } });
  });
});

// ─── Stops (Stations) CRUD ────────────────────────────────────────────────────
app.get('/api/Stop', (req, res) => {
  db.query('SELECT * FROM Stop', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ stations: results });
  });
});

app.post('/api/Stop', requireAuth, (req, res) => {
  const { stop_name, landmark } = req.body;
  if (!stop_name) return res.status(400).json({ error: 'Stop name is required' });
  
  const sql = 'INSERT INTO Stop (stop_name, landmark) VALUES (?, ?)';
  db.query(sql, [stop_name, landmark || ''], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ station: { id: result.insertId, stop_name, landmark } });
  });
});

// ─── Buses CRUD ───────────────────────────────────────────────────────────────
app.get('/api/Bus', requireAuth, (req, res) => {
  db.query('SELECT * FROM Bus', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ buses: results });
  });
});

app.post('/api/Bus', requireAuth, (req, res) => {
  const { bus_number, route_id } = req.body;
  if (!bus_number) return res.status(400).json({ error: 'Bus number is required' });
  
  const sql = 'INSERT INTO Bus (bus_number, route_id) VALUES (?, ?)';
  db.query(sql, [bus_number, parseInt(route_id) || null], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ bus: { id: result.insertId, bus_number, route_id } });
  });
});

app.delete('/api/Bus/:id', requireAuth, (req, res) => {
  // Attribute: bus_id
  db.query('DELETE FROM Bus WHERE bus_id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ─── Helper Functions & Simulated Logic ───────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !sessions.has(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// (BFS Logic and Live positions kept as per your previous logic for simulation)
// Note: Ensure your GRAPH IDs match the stop_id values in your database.

app.listen(PORT, () => {
  console.log(`\n🚌 Karachi Red Bus backend running at http://localhost:${PORT}`);
  console.log(`   Check MySQL Workbench for the 'KarachiRedBusApp' schema.\n`);
});
