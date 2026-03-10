const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const server = http.createServer(app);

// セキュリティヘッダーの設定
app.use(helmet());

// CORSの設定
app.use(cors());

// レート制限 (全体)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // IPごとに100リクエストまで
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// プロキシ信頼設定 (Rate LimitやIP取得のため)
app.set('trust proxy', 1);

const io = new Server(server, {
  cors: {
    origin: "*", // 必要に応じて適切なオリジンに制限してください
    methods: ["GET", "POST"]
  }
});

app.use(express.json());

// 管理者ログイン
const db = require("./db/database");
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  console.log(`Login attempt for user: ${username}`);
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
    if (err) {
      console.error("Login DB error:", err);
      return res.status(500).json({ error: "サーバーエラー" });
    }
    if (!row) {
      console.log("Login failed: User not found or password mismatch");
      return res.status(401).json({ error: "ログイン失敗" });
    }
    console.log("Login success!");
    // 環境変数からトークンを取得
    const adminToken = process.env.ADMIN_TOKEN || "default-secret-token";
    res.json({ success: true, admin_token: adminToken });
  });
});

// 既存のルート
const counterRoutes = require("./routes/counterRoutes");
const postRoutes = require("./routes/postRoutes");
app.use("/api/counter", counterRoutes);
app.use("/api/posts", postRoutes);

// 静的ファイルの提供
const path = require("path");

app.use(express.static(path.join(__dirname, "frontend")));

// ===== 絵茶ソケット =====
const chatRateLimits = new Map();

io.on("connection", (socket) => {
  console.log("ユーザー接続:", socket.id);

  // 描画
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

  // ★ チャット追加 (名前の重複チェックとレート制限付き)
  socket.on("chat", async (data) => {
    let { name, message, device_id } = data;
    const now = Date.now();
    const limitWindow = 30 * 1000; // 30秒
    const maxMessages = 10;

    if (!chatRateLimits.has(socket.id)) {
      chatRateLimits.set(socket.id, []);
    }

    const timestamps = chatRateLimits.get(socket.id);
    const validTimestamps = timestamps.filter(ts => now - ts < limitWindow);
    
    if (validTimestamps.length >= maxMessages) {
      socket.emit("chat_error", { message: "チャットの送信が速すぎます。少し待ってください。" });
      return;
    }

    // 名前の重複チェック (BBSと共通のロジック)
    let finalName = name || "名無しさん";
    if (finalName !== "名無しさん" && device_id) {
      let suffix = 0;
      let nameCandidate = finalName;
      
      const checkName = (cand) => new Promise((resolve) => {
        db.get("SELECT device_id FROM posts WHERE name = ? LIMIT 1", [cand], (err, row) => {
          if (!row || row.device_id === device_id) resolve(true);
          else resolve(false);
        });
      });

      while (!(await checkName(nameCandidate))) {
        suffix++;
        nameCandidate = `${finalName}.${suffix}`;
      }
      finalName = nameCandidate;
    }

    validTimestamps.push(now);
    chatRateLimits.set(socket.id, validTimestamps);

    io.emit("chat", { name: finalName, message, used_name: finalName });
  });

  socket.on("disconnect", () => {
    console.log("切断:", socket.id);
    chatRateLimits.delete(socket.id);
  });
});

// server.listen に変更
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
