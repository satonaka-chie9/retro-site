const express = require("express");
const router = express.Router();
const db = require("../db/database");
const rateLimit = require("express-rate-limit");
const { validationResult } = require("express-validator");
const { postValidation } = require("../validators/postValidator");

// 投稿用レート制限: 1分間に5回まで
const postLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { error: "投稿が多すぎます。少し時間を置いてから再度お試しください。" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req), // IP取得関数をキーとして使用
});

// バリデーション結果チェックミドルウェア
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// IP取得を統一
function getClientIp(req) {
  return (req.headers["x-forwarded-for"]?.split(",")[0] || req.ip)
    .replace("::ffff:", "");
}

// 投稿一覧
router.get("/", (req, res) => {
  db.all("SELECT * FROM posts", [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "サーバー内部エラーが発生しました" });
    }
    res.json(rows);
  });
});

// 投稿追加
router.post("/", postLimiter, postValidation, validate, (req, res) => {
  const { name, content, device_id } = req.body;
  const ip = getClientIp(req);

  db.run(
    "INSERT INTO posts (name, content, device_id, ip) VALUES (?, ?, ?, ?)",
    [name || "名無しさん", content, device_id, ip],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "サーバー内部エラーが発生しました" });
      }
      res.json({ success: true });
    }
  );
});

// 投稿更新
router.put("/:id", postValidation, validate, (req, res) => {
  const { id } = req.params;
  const { name, content, device_id } = req.body;
  const adminTokenHeader = req.headers["x-admin-token"];
  const adminSecret = process.env.ADMIN_TOKEN || "default-secret-token";
  const isAdmin = adminTokenHeader === adminSecret;

  db.get("SELECT device_id FROM posts WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "サーバー内部エラーが発生しました" });
    }
    if (!row) return res.status(404).json({ error: "投稿が見つかりません" });

    if (!isAdmin && row.device_id !== device_id) {
      return res.status(403).json({ error: "他人の投稿は編集できません" });
    }

    db.run(
      `UPDATE posts
       SET name = ?, content = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name || "名無しさん", content, id],
      function (err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: "サーバー内部エラーが発生しました" });
        }
        res.json({ success: true });
      }
    );
  });
});

// 投稿削除
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const { device_id } = req.body;
  const adminTokenHeader = req.headers["x-admin-token"];
  const adminSecret = process.env.ADMIN_TOKEN || "default-secret-token";
  const isAdmin = adminTokenHeader === adminSecret;

  db.get("SELECT device_id FROM posts WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "サーバー内部エラーが発生しました" });
    }
    if (!row) return res.status(404).json({ error: "投稿が見つかりません" });

    if (!isAdmin && row.device_id !== device_id) {
      return res.status(403).json({ error: "他人の投稿は削除できません" });
    }

    db.run("DELETE FROM posts WHERE id = ?", [id], function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "サーバー内部エラーが発生しました" });
      }
      res.json({ success: true });
    });
  });
});

module.exports = router;