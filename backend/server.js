const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(cors());
app.use(express.json());
app.set("trust proxy", true);

// DB作成（ファイルがなければ自動生成）
const db = new sqlite3.Database("./database.db");

// テーブル作成
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT DEFAULT '名無しさん',
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT DEFAULT '名無しさん',
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    )
  `);

  // ★ アクセスカウンタ用テーブル
  db.run(`
    CREATE TABLE IF NOT EXISTS counter (
      id INTEGER PRIMARY KEY,
      count INTEGER DEFAULT 0
    )
  `);

  // ★ 初期データ（なければ作る）
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
});

// DB操作をPromise化
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// アクセス処理
async function handleAccess(ip) {
  const today = new Date().toISOString().slice(0, 10);

  const existing = await dbGet(
    "SELECT * FROM access_log WHERE ip = ? AND accessed_date = ?",
    [ip, today]
  );

  if (existing) {
    return { alreadyCounted: true };
  }

  await dbRun(
    "UPDATE counter SET count = count + 1 WHERE id = 1"
  );

  await dbRun(
    "INSERT INTO access_log (ip, accessed_date) VALUES (?, ?)",
    [ip, today]
  );

  return { counted: true };
}

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress
  );
}

// アクセスカウンタのインクリメント
app.post("/api/counter/increment", async (req, res) => {
  try {
    const ip = getClientIp(req);
    const result = await handleAccess(ip);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 投稿追加
const { validationResult } = require("express-validator");
const { postValidation } = require("./validators/postValidator");

app.post("/api/posts", postValidation, (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, content } = req.body;

  db.run(
    "INSERT INTO posts (name, content) VALUES (?, ?)",
    [name || "名無しさん", content],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

// 投稿更新
app.put("/api/posts/:id", postValidation, (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { name, content } = req.body;

  db.run(
    `UPDATE posts
     SET name = ?, content = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name || "名無しさん", content, id],
    function (err) {

      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "投稿が見つかりません" });
      }

      res.json({ success: true });
    }
  );
});

// 投稿一覧取得
app.get("/api/posts", (req, res) => {
  db.all("SELECT * FROM posts", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});

// 投稿削除
app.delete("/api/posts/:id", (req, res) => {
  const { id } = req.params;

  db.run(
    "DELETE FROM posts WHERE id = ?",
    [id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "投稿が見つかりません" });
      }

      res.json({ success: true });
    }
  );
});

//カウンタの値を取得
app.get("/api/counter", (req, res) => {
  db.get(
    "SELECT count FROM counter WHERE id = 1",
    [],
    (err, row) => {
      if (err) return res.status(500).json(err);
      res.json(row);
    }
  );
});

process.env.NODE_ENV