const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(cors());
app.use(express.json());

// DB作成（ファイルがなければ自動生成）
const db = new sqlite3.Database("./database.db");

// テーブル作成
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT DEFAULT '名無しさん',
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// 投稿追加
app.post("/api/posts", (req, res) => {
  const { name, content } = req.body;

  db.run(
    "INSERT INTO posts (name, content) VALUES (?, ?)",
    [name || "名無しさん", content],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID });
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

process.env.NODE_ENV