const sqlite3 = require("sqlite3").verbose();
const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");

let db;
const isPostgres = !!process.env.DATABASE_URL;

if (isPostgres) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  db = {
    all: (sql, params, callback) => {
      // Postgres parameters use $1, $2 instead of ?
      const pgSql = sql.replace(/\?/g, (_, i, s) => `$${s.substring(0, i).split('?').length}`);
      pool.query(pgSql, params, (err, result) => {
        if (callback) callback(err, result ? result.rows : null);
      });
    },
    get: (sql, params, callback) => {
      const pgSql = sql.replace(/\?/g, (_, i, s) => `$${s.substring(0, i).split('?').length}`);
      pool.query(pgSql, params, (err, result) => {
        if (callback) callback(err, result && result.rows.length > 0 ? result.rows[0] : null);
      });
    },
    run: (sql, params, callback) => {
      const pgSql = sql.replace(/\?/g, (_, i, s) => `$${s.substring(0, i).split('?').length}`);
      // Handle "INSERT OR IGNORE" (SQLite) -> "INSERT ... ON CONFLICT DO NOTHING" (Postgres)
      let finalSql = pgSql.replace(/INSERT OR IGNORE INTO/gi, "INSERT INTO");
      if (pgSql.match(/INSERT OR IGNORE INTO/gi)) {
         // This is a simplified transformation; specific cases might need more care.
         // For 'counter' table specifically:
         if (finalSql.includes("counter")) {
           finalSql += " ON CONFLICT (id) DO NOTHING";
         }
      }
      
      pool.query(finalSql, params, function(err, result) {
        // Mocking SQLite's this.lastID if possible, but pg doesn't provide it easily without RETURNING.
        // For simple cases, we just return the result.
        if (callback) callback.call({ lastID: result ? result.oid : null }, err);
      });
    },
    isPostgres: true,
    pool: pool
  };
} else {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "database.db");
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const sqliteDb = new sqlite3.Database(dbPath);
  
  db = {
    all: (sql, params, callback) => sqliteDb.all(sql, params, callback),
    get: (sql, params, callback) => sqliteDb.get(sql, params, callback),
    run: (sql, params, callback) => sqliteDb.run(sql, params, callback),
    isPostgres: false,
    sqliteDb: sqliteDb
  };
}

async function initDb() {
  const queries = [];
  
  if (isPostgres) {
    queries.push(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        name TEXT,
        content TEXT,
        ip TEXT,
        device_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )
    `);
    queries.push(`
      CREATE TABLE IF NOT EXISTS counter (
        id INTEGER PRIMARY KEY,
        count INTEGER DEFAULT 0
      )
    `);
    queries.push(`
      INSERT INTO counter (id, count)
      VALUES (1, 0)
      ON CONFLICT (id) DO NOTHING
    `);
    queries.push(`
      CREATE TABLE IF NOT EXISTS access_log (
        id SERIAL PRIMARY KEY,
        ip TEXT,
        accessed_date TEXT,
        device_id TEXT
      )
    `);
    queries.push(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT
      )
    `);
    queries.push(`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    queries.push(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title TEXT,
        content TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )
    `);
    queries.push(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        name TEXT,
        message TEXT,
        device_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    const adminPassword = process.env.ADMIN_PASSWORD || 'default_secure_password';
    queries.push({
      sql: `INSERT INTO users (id, username, password)
            VALUES (1, 'admin', $1)
            ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password`,
      params: [adminPassword]
    });
    
    queries.push(`CREATE INDEX IF NOT EXISTS idx_access_ip_device_date ON access_log(ip, device_id, accessed_date)`);

    for (const q of queries) {
      const sql = typeof q === 'string' ? q : q.sql;
      const params = typeof q === 'string' ? [] : q.params;
      await db.pool.query(sql, params);
    }
  } else {
    // SQLite initialization (mostly same as original but using db object)
    db.sqliteDb.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          content TEXT,
          ip TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME
        )
      `);
      db.run("ALTER TABLE posts ADD COLUMN device_id TEXT", (err) => {});
      db.run(`
        CREATE TABLE IF NOT EXISTS counter (
          id INTEGER PRIMARY KEY,
          count INTEGER DEFAULT 0
        )
      `);
      db.run(`INSERT OR IGNORE INTO counter (id, count) VALUES (1, 0)`);
      db.run(`
        CREATE TABLE IF NOT EXISTS access_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ip TEXT,
          accessed_date TEXT
        )
      `);
      db.run("ALTER TABLE access_log ADD COLUMN device_id TEXT", (err) => {});
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          password TEXT
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS news (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS articles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT,
          content TEXT,
          image_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          message TEXT,
          device_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      const adminPassword = process.env.ADMIN_PASSWORD || 'default_secure_password';
      db.run(`INSERT OR REPLACE INTO users (id, username, password) VALUES (1, 'admin', ?)`, [adminPassword]);
      db.run(`CREATE INDEX IF NOT EXISTS idx_access_ip_device_date ON access_log(ip, device_id, accessed_date)`);
    });
  }
}

initDb().catch(err => console.error("Database initialization failed", err));

module.exports = db;
