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

app.use(express.static(path.join(__dirname, "frontend")));

// ===== 絵茶ソケット =====
io.on("connection", (socket) => {
  console.log("ユーザー接続:", socket.id);

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
