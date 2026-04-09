const express = require("express");
const router = express.Router();
const db = require("../db/database");
const rateLimit = require("express-rate-limit");
const { validationResult } = require("express-validator");
const { postValidation } = require("../validators/postValidator");
const logger = require("../services/logger");

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

// IP制限チェックミドルウェア
const checkIPBan = (req, res, next) => {
  const ip = getClientIp(req);
  const adminTokenHeader = req.headers["x-admin-token"];
  const adminTokenFromBody = req.body.admin_token;
  const adminSecret = process.env.ADMIN_TOKEN || "default-secret-token";
  const isAdmin = (adminTokenHeader === adminSecret) || (adminTokenFromBody === adminSecret);

  // 管理者は制限を受けない
  if (isAdmin) return next();

  db.get("SELECT 1 FROM banned_ips WHERE ip = ?", [ip], (err, row) => {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    if (row) {
      return res.status(403).json({ error: "このIPアドレスからの投稿は制限されています。" });
    }
    next();
  });
};

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
router.post("/", postLimiter, checkIPBan, postValidation, validate, async (req, res) => {
  let { name, content, device_id } = req.body;
  const ip = getClientIp(req);
  const adminTokenHeader = req.headers["x-admin-token"];
  const adminTokenFromBody = req.body.admin_token;
  const adminSecret = process.env.ADMIN_TOKEN || "default-secret-token";
  const isAdmin = (adminTokenHeader === adminSecret) || (adminTokenFromBody === adminSecret);

  if (!name || name === "名無しさん") {
    name = "名無しさん";
    return insertPost(name);
  }

  // 管理者の場合はチェック不要
  if (isAdmin) {
    return insertPost(name);
  }

  // 名前が他のデバイスで使用されていないかチェックし、必要ならリネーム
  let finalName = name;
  let suffix = 0;

  const findAvailableName = (candidateName) => {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT device_id FROM posts WHERE name = ? LIMIT 1",
        [candidateName],
        (err, row) => {
          if (err) return reject(err);
          if (!row || row.device_id === device_id) {
            // 未使用、または自分のデバイスで使用中の名前ならOK
            resolve(true);
          } else {
            // 他のデバイスで使用中
            resolve(false);
          }
        }
      );
    });
  };

  try {
    while (!(await findAvailableName(finalName))) {
      suffix++;
      finalName = `${name}.${suffix}`;
    }
    insertPost(finalName);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "サーバー内部エラーが発生しました" });
  }

  function insertPost(resolvedName) {
    db.run(
      "INSERT INTO posts (name, content, device_id, ip) VALUES (?, ?, ?, ?)",
      [resolvedName, content, device_id, ip],
      function (err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: "サーバー内部エラーが発生しました" });
        }

        // ぬるぽチェック
        //むかしの掲示板でnul pointer exceptionを意味する「ぬるぽ」という言葉が投稿されたときに、レスポンスとして「ガッ」と返す文化がありました。ここでは、その文化を再現するために、投稿内容に「ぬるぽ」が含まれている場合に自動で「ガッ」という投稿を生成する機能を実装しています。
        //遊び心として導入してみました。
        if (content && content.includes("ぬるぽ")) {
          const postId = this.lastID;
          
          // 返信バリエーション
          const responses = [
            `>>${postId}\nガッ`,
            `>>${postId}\nガッ！`,
            `>>${postId}\nガッ！！`,
            `>>${postId}\nガッｗ`,
            `>>${postId}\n　　　　 ∧＿∧ 　ガッ\n　　　 （　・∀・）\n　　　 ⊂　　　つ\n　　　 （　⌒　）\n　　　　し' じ`
          ];
          const botMessage = responses[Math.floor(Math.random() * responses.length)];
          
          // 0.7秒から3.2秒の間でランダムに待機してから自動返信を実行
          const delay = Math.floor(Math.random() * (3200 - 700 + 1)) + 700;
          setTimeout(() => {
            db.run(
              "INSERT INTO posts (name, content, device_id, ip) VALUES (?, ?, ?, ?)",
              ["null_bot", botMessage, "bot_id", "127.0.0.1"],
              function (botErr) {
                if (botErr) {
                  console.error("Bot response failed:", botErr);
                }
                if (req.io) req.io.emit("post_update");
              }
            );
          }, delay);
        } else {
          if (req.io) req.io.emit("post_update");
        }

        // 実際に使用された名前を返す
        res.json({ success: true, used_name: resolvedName });
      }
    );
  }
});

// 投稿更新
router.put("/:id", checkIPBan, postValidation, validate, (req, res) => {
  const { id } = req.params;
  const { name, content, device_id } = req.body;
  const adminTokenFromHeader = req.headers["x-admin-token"];
  const adminTokenFromBody = req.body.admin_token;
  const adminSecret = process.env.ADMIN_TOKEN || "default-secret-token";
  const isAdmin = (adminTokenFromHeader === adminSecret) || (adminTokenFromBody === adminSecret);

  // 投稿の所有者または管理者のみが編集可能
  db.get("SELECT device_id FROM posts WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "サーバー内部エラーが発生しました" });
    }
    if (!row) return res.status(404).json({ error: "投稿が見つかりません" });

    // 管理者でない場合、投稿のdevice_idとリクエストのdevice_idが一致する必要がある
    if (!isAdmin && row.device_id !== device_id) {
      return res.status(403).json({ error: "他人の投稿は編集できません" });
    }

    // 名前の重複チェックは省略（必要なら追加可能）
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
        logger.logAction("EDIT", "post", id, { name, content, device_id });
        if (req.io) req.io.emit("post_update");
        res.json({ success: true });
      }
    );
  });
});

// 投稿削除
router.delete("/:id", checkIPBan, (req, res) => {
  const { id } = req.params;
  const { device_id } = req.body;
  const adminTokenFromHeader = req.headers["x-admin-token"];
  const adminTokenFromBody = req.body.admin_token;
  const adminSecret = process.env.ADMIN_TOKEN || "default-secret-token";
  const isAdmin = (adminTokenFromHeader === adminSecret) || (adminTokenFromBody === adminSecret);

  // 投稿の所有者または管理者のみが削除可能
  db.get("SELECT device_id FROM posts WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "サーバー内部エラーが発生しました" });
    }
    if (!row) return res.status(404).json({ error: "投稿が見つかりません" });

    if (!isAdmin && row.device_id !== device_id) {
      return res.status(403).json({ error: "他人の投稿は削除できません" });
    }

    // 投稿を削除
    db.run("DELETE FROM posts WHERE id = ?", [id], function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "サーバー内部エラーが発生しました" });
      }
      logger.logAction("DELETE", "post", id, { device_id });
      if (req.io) req.io.emit("post_update");
      res.json({ success: true });
    });
  });
});

// 管理者用の全投稿取得（IPアドレスやデバイスIDも含む）
module.exports = router;