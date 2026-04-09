// ブログ関連のルート
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

// HTMLエスケープ関数
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
  
  // 画像がアップロードされた場合はストレージサービスに保存し、URLを取得します。エラーが発生した場合は500エラーを返します。
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

  // タイトルと内容のバリデーション
  if (!title || !content) {
    return res.status(400).json({ error: "タイトルと本文は必須です" });
  }

  // タイトルと内容をHTMLエスケープして保存します。これにより、XSS攻撃を防止します。
  title = escapeHTML(title);
  content = escapeHTML(content);

  // データベースにブログ投稿を保存します。成功した場合は新しい投稿のIDを返し、失敗した場合は500エラーを返します。
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

// ブログ更新
router.put("/:id", adminOnly, (req, res) => {
  const { id } = req.params;
  let { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "タイトルと本文は必須です" });
  }

  // タイトルと内容をHTMLエスケープして保存します。これにより、XSS攻撃を防止します。
  title = escapeHTML(title);
  content = escapeHTML(content);

  // データベースにブログ投稿を更新します。成功した場合は成功レスポンスを返し、失敗した場合は500エラーを返します。
  db.run(
    "UPDATE articles SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [title, content, id],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "サーバーエラー" });  // エラーが発生した場合は500エラーを返します。
      }
      logger.logAction("UPDATE", "blog", id);
      res.json({ success: true });
    }
  );
});

// ブログ削除
router.delete("/:id", adminOnly, (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM articles WHERE id = ?", [id], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "サーバーエラー" });   // エラーが発生した場合は500エラーを返します。
    }
    logger.logAction("DELETE", "blog", id);
    res.json({ success: true });
  });
});

// 管理者用の全ブログ投稿取得（IPアドレスやデバイスIDも含む）
module.exports = router;
