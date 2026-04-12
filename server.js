const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'habib27',
  database: 'karachi_red_bus',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// --- REWRITTEN SECTION ---

// 1. A "Home" Route
// Go to http://localhost:5000/ to see this
app.get('/', (req, res) => {
  res.send(`
    <h1>🚌 Karachi Red Bus API is Live!</h1>
    <p>Available Endpoints:</p>
    <ul>
      <li><a href="/api/buses">View All Buses (/api/buses)</a></li>
      <li>Search by Route: <code>/api/buses/search?route=Tower</code></li>
    </ul>
  `);
});

// 2. Get All Buses
app.get('/api/buses', (req, res) => {
  const sql = 'SELECT * FROM buses';
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database query failed", details: err.message });
    }
    res.json({
      count: results.length,
      data: results
    });
  });
});

// 3. Search Buses by Route Name
// Try: http://localhost:5000/api/buses/search?route=Model
app.get('/api/buses/search', (req, res) => {
  const routeQuery = req.query.route;
  
  if (!routeQuery) {
    return res.status(400).json({ error: "Please provide a route search term." });
  }

  const sql = 'SELECT * FROM buses WHERE route_name LIKE ?';
  db.query(sql, [`%${routeQuery}%`], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// --- SERVER START ---

app.listen(5000, () => {
  console.log('------------------------------------------');
  console.log('🚀 Server running: http://localhost:5000');
  console.log('📂 Testing DB connection...');
});

db.getConnection((err, conn) => {
  if (err) console.error('❌ DB Error:', err.message);
  else {
    console.log('✅ Connected to Karachi Red Bus DB!');
    conn.release();
  }
});