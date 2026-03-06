const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());

// 既存のルート
const counterRoutes = require("./routes/counterRoutes");
const postRoutes = require("./routes/postRoutes");
app.use("/api/counter", counterRoutes);
app.use("/api/posts", postRoutes);

// 静的ファイルの提供
const path = require("path");
const fs = require("fs");

app.use(express.static(path.join(__dirname, "frontend")));

// ログ記録関数
function logChat(filename, message) {
  const logDir = path.join(__dirname, "log");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
  const logPath = path.join(logDir, filename);
  const timestamp = new Date().toLocaleString("ja-JP");
  fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
}

// ===== 絵茶ソケット =====
io.on("connection", (socket) => {
  const ip = socket.handshake.headers["x-forwarded-for"]?.split(",")[0] || socket.handshake.address.replace("::ffff:", "");
  console.log("ユーザー接続:", socket.id, "IP:", ip);

  // 描画
  socket.on("drawing", (data) => {
    socket.broadcast.emit("drawing", data);
  });

  socket.on("clearCanvas", () => {
    io.emit("clearCanvas");
  });

  // ★ チャット追加
  socket.on("chat", (data) => {
    io.emit("chat", data);
    // ログに追記
    logChat("etchat.log", `IP:${ip} | NAME:${data.name} | MSG:${data.message}`);
  });

  socket.on("disconnect", () => {
    console.log("切断:", socket.id);
  });
});

// server.listen に変更
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
