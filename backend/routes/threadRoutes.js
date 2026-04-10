const express = require("express");
const router = express.Router();
const db = require("../db/database");
const rateLimit = require("express-rate-limit");

// スレッド作成用レート制限: 5分間に3回まで
const threadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: { error: "スレッド作成が多すぎます。少し時間を置いてから再度お試しください。" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.headers["x-forwarded-for"]?.split(",")[0] || req.ip).replace("::ffff:", ""),
});

// スレッド一覧
router.get("/", (req, res) => {
  db.all("SELECT * FROM threads ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "サーバー内部エラーが発生しました" });
    }
    res.json(rows);
  });
});

// スレッド作成
router.post("/", threadLimiter, (req, res) => {
  const { title, device_id } = req.body;
  
  if (!title || title.trim() === "") {
    return res.status(400).json({ error: "タイトルを入力してください" });
  }

  db.run(
    "INSERT INTO threads (title, device_id) VALUES (?, ?)",
    [title, device_id],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "サーバー内部エラーが発生しました" });
      }
      
      const threadId = this.lastID;
      if (req.io) req.io.emit("thread_update");
      res.json({ success: true, id: threadId });
    }
  );
});

// スレッド削除 (管理者のみ)
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const adminTokenFromHeader = req.headers["x-admin-token"];
  const adminSecret = process.env.ADMIN_TOKEN || "default-secret-token";
  const isAdmin = (adminTokenFromHeader === adminSecret);

  if (!isAdmin) {
    return res.status(403).json({ error: "管理者権限が必要です" });
  }

  db.get("SELECT 1 FROM threads WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    if (!row) return res.status(404).json({ error: "スレッドが見つかりません" });

    db.run("DELETE FROM threads WHERE id = ?", [id], function(err) {
      if (err) return res.status(500).json({ error: "サーバーエラー" });
      
      // スレッド内の投稿も削除
      db.run("DELETE FROM posts WHERE thread_id = ?", [id], (err) => {
        if (err) console.error("Failed to delete posts in thread:", err);
      });

      if (req.io) req.io.emit("thread_update");
      if (req.io) req.io.emit("post_update");
      res.json({ success: true });
    });
  });
});

module.exports = router;
