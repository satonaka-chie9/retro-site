const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db/database");

// 画像保存先の設定
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "../uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
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

// ブログ投稿 (画像付き)
router.post("/", adminOnly, upload.single("image"), (req, res) => {
  const { title, content } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  if (!title || !content) {
    return res.status(400).json({ error: "タイトルと本文は必須です" });
  }

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
    res.json({ success: true });
  });
});

module.exports = router;
