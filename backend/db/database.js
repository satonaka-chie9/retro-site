const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// Renderなどの環境で永続化ディスクを使用するための設定
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "database.db");

// データベースディレクトリが存在しない場合は作成する
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);


db.serialize(() => {
  // postsテーブルの作成とdevice_idカラムの確認
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

  // device_id カラムがない場合は追加 (posts)
  db.run("ALTER TABLE posts ADD COLUMN device_id TEXT", (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      // すでにある場合は無視、それ以外のエラーはログ出し
    }
  });

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

  // access_logテーブルの作成とdevice_idカラムの確認
  db.run(`
    CREATE TABLE IF NOT EXISTS access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT,
      accessed_date TEXT
    )
  `);

  // device_id カラムがない場合は追加 (access_log)
  db.run("ALTER TABLE access_log ADD COLUMN device_id TEXT", (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      // すでにある場合は無視
    }
  });

  // usersテーブルの作成
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )
  `);

  // お知らせテーブルの作成
  db.run(`
    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // blog articlesテーブルの作成
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

  // 初期管理者アカウントの作成 (環境変数の値で常に更新する)
  const adminPassword = process.env.ADMIN_PASSWORD || 'default_secure_password';
  db.run(`
    INSERT OR REPLACE INTO users (id, username, password)
    VALUES (1, 'admin', ?)
  `, [adminPassword]);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_access_ip_device_date
    ON access_log(ip, device_id, accessed_date)
  `);
});

module.exports = db;