const express = require('express');
const mysql = require('mysql2');
const cors = require('cors'); //enables react to connect with nodejs

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

// Admin Login Route
  app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // We check the 'admins' table you created in SQL
  const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
  
  db.query(sql, [username, password], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length > 0) {
      // Success! Found a matching admin
      res.json({ success: true, message: "Login Successful", user: results[0].username });
    } else {
      // Fail! No match
      res.status(401).json({ success: false, message: "Invalid username or password" });
    }
  });
});


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