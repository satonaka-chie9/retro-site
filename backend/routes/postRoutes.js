const express = require("express");
const router = express.Router();
const db = require("../db/database");

// IP取得を統一
function getClientIp(req) {
  return (req.headers["x-forwarded-for"]?.split(",")[0] || req.ip)
    .replace("::ffff:", "");
}

// 投稿一覧
router.get("/", (req, res) => {
  db.all("SELECT * FROM posts", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 投稿追加
router.post("/", (req, res) => {
  const { name, content, device_id } = req.body;

  db.run(
    "INSERT INTO posts (name, content, device_id) VALUES (?, ?, ?)",
    [name || "名無しさん", content, device_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// 投稿更新
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { name, content, device_id } = req.body;

  db.get("SELECT device_id FROM posts WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "投稿が見つかりません" });

    if (row.device_id !== device_id) {
      return res.status(403).json({ error: "他人の投稿は編集できません" });
    }

    db.run(
      `UPDATE posts
       SET name = ?, content = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name || "名無しさん", content, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  });
});

// 投稿削除
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { name, content, device_id } = req.body;

  db.get("SELECT device_id FROM posts WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "投稿が見つかりません" });

    if (row.device_id !== device_id) {
      return res.status(403).json({ error: "他人の投稿は編集できません" });
    }

    db.run(
      `UPDATE posts
       SET name = ?, content = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name || "名無しさん", content, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  });
});

module.exports = router;