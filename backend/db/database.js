const sqlite3 = require("sqlite3").verbose();
const { Pool } = require("pg");
const dns = require("dns");

// Force IPv4 as the default for all DNS lookups
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const path = require("path");
const fs = require("fs");

let db;
const isPostgres = !!process.env.DATABASE_URL;

console.log(`[DB] Mode: ${isPostgres ? "PostgreSQL (Supabase)" : "SQLite"}`);

if (isPostgres) {
  console.log(`[DB] Connection string length: ${process.env.DATABASE_URL.length}`);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    // Force IPv4 for DNS lookup to avoid ENETUNREACH with IPv6
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, { family: 4 }, callback);
    }
  });

  pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client', err);
  });

  db = {
    all: (sql, params, callback) => {
      const pgSql = sql.replace(/\?/g, (_, i, s) => `$${s.substring(0, i).split('?').length}`);
      pool.query(pgSql, params, (err, result) => {
        if (err) console.error(`[DB] Query Error (all): ${sql}`, err);
        if (callback) callback(err, result ? result.rows : null);
      });
    },
    get: (sql, params, callback) => {
      const pgSql = sql.replace(/\?/g, (_, i, s) => `$${s.substring(0, i).split('?').length}`);
      pool.query(pgSql, params, (err, result) => {
        if (err) console.error(`[DB] Query Error (get): ${sql}`, err);
        if (callback) callback(err, result && result.rows.length > 0 ? result.rows[0] : null);
      });
    },
    run: (sql, params, callback) => {
      const pgSql = sql.replace(/\?/g, (_, i, s) => `$${s.substring(0, i).split('?').length}`);
      let finalSql = pgSql.replace(/INSERT OR IGNORE INTO/gi, "INSERT INTO");
      if (pgSql.match(/INSERT OR IGNORE INTO/gi)) {
         if (finalSql.includes("counter")) {
           finalSql += " ON CONFLICT (id) DO NOTHING";
         }
      }
      
      pool.query(finalSql, params, function(err, result) {
        if (err) console.error(`[DB] Query Error (run): ${finalSql}`, err);
        if (callback) callback.call({ lastID: result ? result.oid : null }, err);
      });
    },
    isPostgres: true,
    pool: pool
  };
} else {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "database.db");
  console.log(`[DB] SQLite Path: ${dbPath}`);
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const sqliteDb = new sqlite3.Database(dbPath);
  
  db = {
    all: (sql, params, callback) => {
      if (typeof params === "function") {
        callback = params;
        params = [];
      }
      return sqliteDb.all(sql, params || [], callback);
    },
    get: (sql, params, callback) => {
      if (typeof params === "function") {
        callback = params;
        params = [];
      }
      return sqliteDb.get(sql, params || [], callback);
    },
    run: (sql, params, callback) => {
      if (typeof params === "function") {
        callback = params;
        params = [];
      }
      return sqliteDb.run(sql, params || [], callback || ((err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error(`[DB] SQLite Run Error: ${err.message}`, sql);
        }
      }));
    },
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
    queries.push(`
      CREATE TABLE IF NOT EXISTS claps (
        id SERIAL PRIMARY KEY,
        message TEXT,
        ip TEXT,
        device_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    queries.push(`
      CREATE TABLE IF NOT EXISTS statuses (
        id SERIAL PRIMARY KEY,
        content TEXT,
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
          device_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME
        )
      `);
      db.run("ALTER TABLE posts ADD COLUMN device_id TEXT", (err) => {
        // Ignore error if column already exists
      });
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
          accessed_date TEXT,
          device_id TEXT
        )
      `);
      db.run("ALTER TABLE access_log ADD COLUMN device_id TEXT", (err) => {
        // Ignore error if column already exists
      });
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
      db.run(`
        CREATE TABLE IF NOT EXISTS claps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message TEXT,
          ip TEXT,
          device_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS statuses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT,
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
