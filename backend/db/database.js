const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      content TEXT,
      ip TEXT,
      device_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS counter (
      id INTEGER PRIMARY KEY,
      count INTEGER DEFAULT 0
    )
  `);

  db.run(`
    INSERT OR IGNORE INTO counter (id, count)
    VALUES (1, 0)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT,
      accessed_date TEXT
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_access_ip_date
    ON access_log(ip, accessed_date)
  `);
});

module.exports = db;