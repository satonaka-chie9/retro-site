const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const logger = require("./services/logger");

const app = express();
const server = http.createServer(app);

// クッキーの設定 (CSRF対策で使用)
const COOKIE_SECRET = process.env.COOKIE_SECRET || "retro-site-secret-key-12345";
app.use(cookieParser(COOKIE_SECRET));

// セキュリティヘッダーの設定 (XSS対策としてのCSPを含む)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"], // インラインスクリプトを禁止
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  }
}));

// CORSの設定
const allowedOrigins = [
  "http://localhost:3000",
  process.env.APP_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true
}));

// レート制限
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

app.set('trust proxy', 1);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());

// アクセスログ
app.use((req, res, next) => {
  logger.logAccess(req);
  next();
});

// --- CSRF 対策ミドルウェア ---
const csrfProtection = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  const csrfTokenFromHeader = req.headers["x-csrf-token"];
  const csrfTokenFromCookie = req.signedCookies["_csrf"];
  if (!csrfTokenFromHeader || !csrfTokenFromCookie || csrfTokenFromHeader !== csrfTokenFromCookie) {
    return res.status(403).json({ error: "不正なリクエストです (CSRF)" });
  }
  next();
};

app.get("/api/csrf-token", (req, res) => {
  const token = crypto.randomBytes(32).toString("hex");
  res.cookie("_csrf", token, {
    httpOnly: true,
    signed: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production"
  });
  res.json({ csrfToken: token });
});

// 管理者ログイン
const db = require("./db/database");
app.post("/api/admin/login", csrfProtection, (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    if (!row) return res.status(401).json({ error: "ログイン失敗" });
    const adminToken = process.env.ADMIN_TOKEN || "default-secret-token";
    res.json({ success: true, admin_token: adminToken });
  });
});

// ルートの登録
const counterRoutes = require("./routes/counterRoutes");
const postRoutes = require("./routes/postRoutes");
const blogRoutes = require("./routes/blogRoutes");
app.use("/api/counter", counterRoutes);
app.use("/api/posts", csrfProtection, postRoutes);
app.use("/api/blog", csrfProtection, blogRoutes);

// --- お知らせ (News) API ---
const adminOnly = (req, res, next) => {
  const adminToken = req.headers["x-admin-token"];
  const adminSecret = process.env.ADMIN_TOKEN || "default-secret-token";
  if (adminToken === adminSecret) {
    next();
  } else {
    res.status(403).json({ error: "管理者権限が必要です" });
  }
};

const checkIPBan = (req, res, next) => {
  const ip = (req.headers["x-forwarded-for"]?.split(",")[0] || req.ip).replace("::ffff:", "");
  db.get("SELECT 1 FROM banned_ips WHERE ip = ?", [ip], (err, row) => {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    if (row) {
      return res.status(403).json({ error: "このIPアドレスからの投稿は制限されています。" });
    }
    next();
  });
};

// --- IP制限管理 API ---
app.get("/api/admin/restrictions", adminOnly, (req, res) => {
  db.all("SELECT * FROM banned_ips ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    res.json(rows || []);
  });
});

app.post("/api/admin/restrictions", csrfProtection, adminOnly, (req, res) => {
  const { ip, reason } = req.body;
  if (!ip) return res.status(400).json({ error: "IPアドレスが必要です" });
  db.run("INSERT INTO banned_ips (ip, reason) VALUES (?, ?)", [ip, reason], function(err) {
    if (err) {
      if (err.message.includes("UNIQUE")) return res.status(400).json({ error: "このIPは既に制限されています" });
      return res.status(500).json({ error: "サーバーエラー" });
    }
    res.json({ success: true, id: this.lastID });
  });
});

app.delete("/api/admin/restrictions/:id", csrfProtection, adminOnly, (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM banned_ips WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    res.json({ success: true });
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

app.get("/api/news", (req, res) => {
  db.all("SELECT * FROM news ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    res.json(rows || []);
  });
});

app.post("/api/news", csrfProtection, adminOnly, (req, res) => {
  const content = escapeHTML(req.body.content);
  db.run("INSERT INTO news (content) VALUES (?)", [content], function(err) {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    res.json({ success: true, id: this.lastID });
  });
});

app.put("/api/news/:id", csrfProtection, adminOnly, (req, res) => {
  const { id } = req.params;
  const content = escapeHTML(req.body.content);
  db.run("UPDATE news SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [content, id], function(err) {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    logger.logAction("EDIT", "news", id, { content });
    res.json({ success: true });
  });
});

app.delete("/api/news/:id", csrfProtection, adminOnly, (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM news WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    logger.logAction("DELETE", "news", id);
    res.json({ success: true });
  });
});

// ===== Web 拍手 =====
app.post("/api/claps", checkIPBan, (req, res) => {
  const { message, device_id } = req.body;
  const ip = (req.headers["x-forwarded-for"]?.split(",")[0] || req.ip).replace("::ffff:", "");
  const cleanMsg = message ? escapeHTML(message.substring(0, 200)) : null;

  db.run("INSERT INTO claps (message, ip, device_id) VALUES (?, ?, ?)", [cleanMsg, ip, device_id], (err) => {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    
    // 拍手数を全クライアントに通知
    db.get("SELECT COUNT(*) as total FROM claps", [], (err, row) => {
      if (!err && row) {
        io.emit("clap_update", { total: row.total });
      }
    });
    
    res.json({ success: true });
  });
});

app.get("/api/claps/count", (req, res) => {
  db.get("SELECT COUNT(*) as total FROM claps", [], (err, row) => {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    res.json(row || { total: 0 });
  });
});

app.get("/api/admin/claps/stats", adminOnly, (req, res) => {
  db.get("SELECT COUNT(*) as total FROM claps", [], (err, row) => {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    res.json(row);
  });
});

app.get("/api/claps", (req, res) => {
  // 公開用: IPやデバイスIDを除いたメッセージのみ
  db.all("SELECT message, created_at FROM claps WHERE message IS NOT NULL AND message != '' ORDER BY created_at DESC LIMIT 50", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    res.json(rows);
  });
});

app.get("/api/admin/claps", adminOnly, (req, res) => {
  db.all("SELECT * FROM claps ORDER BY created_at DESC LIMIT 100", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    res.json(rows);
  });
});

// ===== 最近の近況 =====
app.get("/api/statuses", (req, res) => {
  db.all("SELECT * FROM statuses ORDER BY created_at DESC LIMIT 10", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    res.json(rows || []);
  });
});

app.post("/api/statuses", csrfProtection, adminOnly, (req, res) => {
  const content = escapeHTML(req.body.content);
  db.run("INSERT INTO statuses (content) VALUES (?)", [content], function(err) {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    res.json({ success: true, id: this.lastID });
  });
});

app.delete("/api/statuses/:id", csrfProtection, adminOnly, (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM statuses WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: "サーバーエラー" });
    res.json({ success: true });
  });
});

// 静的ファイルの提供
const path = require("path");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
app.use(express.static(path.join(__dirname, "frontend")));
app.use("/uploads", express.static(UPLOAD_DIR));

// ===== 絵茶ソケット =====
const chatRateLimits = new Map();
io.on("connection", (socket) => {
  // 接続時にチャット履歴を送信 (最新50件)
  db.all("SELECT * FROM (SELECT * FROM chat_messages ORDER BY id DESC LIMIT 50) ORDER BY id ASC", [], (err, rows) => {
    if (err) {
      console.error("Chat history error:", err);
    } else {
      socket.emit("chat_history", rows);
    }
  });

  socket.on("drawing", (data) => {
    socket.broadcast.emit("drawing", data);
  });
  socket.on("clearCanvas", () => {
    io.emit("clearCanvas");
  });
  socket.on("undo", () => {
    socket.broadcast.emit("undo");
  });
  socket.on("redo", () => {
    socket.broadcast.emit("redo");
  });
  socket.on("chat", async (data) => {
    const ip = (socket.handshake.headers["x-forwarded-for"]?.split(",")[0] || socket.handshake.address).replace("::ffff:", "");
    
    // IP制限チェック
    db.get("SELECT 1 FROM banned_ips WHERE ip = ?", [ip], async (err, row) => {
      if (row) {
        socket.emit("chat_error", { message: "投稿が制限されています。" });
        return;
      }

      let { name, message, device_id } = data;
      // チャットのエスケープも重要
      name = escapeHTML(name);
      message = escapeHTML(message);

      const now = Date.now();
      const limitWindow = 30 * 1000;
      const maxMessages = 10;
      if (!chatRateLimits.has(socket.id)) chatRateLimits.set(socket.id, []);
      const timestamps = chatRateLimits.get(socket.id);
      const validTimestamps = timestamps.filter(ts => now - ts < limitWindow);
      if (validTimestamps.length >= maxMessages) {
        socket.emit("chat_error", { message: "チャットの送信が速すぎます。" });
        return;
      }
      
      let finalName = name || "名無しさん";
      validTimestamps.push(now);
      chatRateLimits.set(socket.id, validTimestamps);

      // データベースに保存
      db.run("INSERT INTO chat_messages (name, message, device_id) VALUES (?, ?, ?)", [finalName, message, device_id], (err) => {
        if (err) console.error("Chat save error:", err);
      });

      io.emit("chat", { name: finalName, message, used_name: finalName });
    });
  });
  socket.on("disconnect", () => {
    chatRateLimits.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
