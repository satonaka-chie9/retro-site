const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// 既存のルート
const counterRoutes = require("./routes/counterRoutes");
const postRoutes = require("./routes/postRoutes");
app.use("/api", counterRoutes);
app.use("/api", postRoutes);

// 静的ファイルの提供
const path = require("path");

app.use(express.static(path.join(__dirname, "frontend")));

// ===== 絵茶ソケット =====
io.on("connection", (socket) => {
  console.log("ユーザー接続:", socket.id);

  socket.on("draw", (data) => {
    socket.broadcast.emit("draw", data);
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