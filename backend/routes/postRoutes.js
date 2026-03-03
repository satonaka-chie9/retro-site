const express = require("express");
const router = express.Router();
const db = require("../db/database");

// 投稿一覧
router.get("/", (req, res) => {
  db.all("SELECT * FROM posts", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 投稿追加
router.post("/", (req, res) => {
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
router.put("/:id", (req, res) => {
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

// 投稿削除
router.delete("/:id", (req, res) => {
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

module.exports = router;