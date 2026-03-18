const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const db = require("../db/database");
const logger = require("../services/logger");
const storageService = require("../services/storageService");

// 画像保存先の設定
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("画像ファイル(jpg, png, gif)のみアップロード可能です"));
  }
});

// 管理者認証ミドルウェア
const adminOnly = (req, res, next) => {
  const adminToken = req.headers["x-admin-token"] || req.body.admin_token;
  const adminSecret = process.env.ADMIN_TOKEN || "default-secret-token";
  
  if (adminToken === adminSecret) {
    next();
  } else {
    res.status(403).json({ error: "管理者権限が必要です" });
  }
};

// ブログ一覧取得
router.get("/", (req, res) => {
  db.all("SELECT * FROM articles ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "サーバーエラー" });
    }
    res.json(rows);
  });
});

const escapeHTML = (str) => {
  if (!str) return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// ブログ投稿 (画像付き)
router.post("/", adminOnly, upload.single("image"), async (req, res) => {
  let { title, content } = req.body;
  
  let imageUrl = null;
  if (req.file) {
    try {
      const fileName = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(req.file.originalname);
      imageUrl = await storageService.uploadFile(fileName, req.file.buffer, req.file.mimetype);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "画像の保存に失敗しました" });
    }
  }

  if (!title || !content) {
    return res.status(400).json({ error: "タイトルと本文は必須です" });
  }

  title = escapeHTML(title);
  content = escapeHTML(content);

  db.run(
    "INSERT INTO articles (title, content, image_url) VALUES (?, ?, ?)",
    [title, content, imageUrl],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "サーバーエラー" });
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

// ブログ削除
router.delete("/:id", adminOnly, (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM articles WHERE id = ?", [id], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "サーバーエラー" });
    }
    logger.logAction("DELETE", "blog", id);
    res.json({ success: true });
  });
});

module.exports = router;
