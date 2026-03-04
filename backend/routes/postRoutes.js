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

  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  db.run(
    "INSERT INTO posts (name, content, ip) VALUES (?, ?, ?)",
    [name || "名無しさん", content, ip],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

// 投稿更新
router.post("/", (req, res) => {
  const { name, content } = req.body;

  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  db.run(
    "INSERT INTO posts (name, content, ip) VALUES (?, ?, ?)",
    [name || "名無しさん", content, ip],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

// 投稿削除
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  db.get("SELECT ip FROM posts WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "投稿が見つかりません" });

    if (row.ip !== ip) {
      return res.status(403).json({ error: "他人の投稿は削除できません" });
    }

    db.run("DELETE FROM posts WHERE id = ?", [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

module.exports = router;