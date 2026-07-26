const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(__dirname, '../../data');
fs.mkdirSync(dataDir, { recursive: true });

// Store the database in the data folder
const dbPath = path.join(dataDir, 'cridershield.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open SQLite database:', err);
  } else {
    console.log(`SQLite database opened: ${dbPath}`);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT CHECK(role IN ('Admin', 'Operator', 'Viewer'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      action TEXT,
      details TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
});

module.exports = db;
