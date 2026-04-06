const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors()); // Allows your React app to talk to this server
app.use(express.json()); // Allows the server to read JSON data

// 1. Setup the Database Pool (The "Modern" Way)
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'habib27', // Replace with 'habib27'
  database: 'karachi_red_bus',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 2. Test the connection on startup
db.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err.message);
  } else {
    console.log('Connected to Karachi Red Bus Database!');
    connection.release(); // Always release the connection back to the pool
  }
});

// 3. Create an API Route to get all buses
app.get('/api/buses', (req, res) => {
  db.query('SELECT * FROM buses', (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

app.listen(5000, () => {
  console.log('Server is running on http://localhost:5000');
});