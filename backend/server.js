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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    )
  `);
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

process.env.NODE_ENV