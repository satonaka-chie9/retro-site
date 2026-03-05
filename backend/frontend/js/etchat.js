const socket = io();

const canvas = new fabric.Canvas('c', {
  isDrawingMode: true
});

canvas.freeDrawingBrush.width = 3;
canvas.freeDrawingBrush.color = "#000000";

// 色変更
document.getElementById("colorPicker").addEventListener("change", (e) => {
  canvas.freeDrawingBrush.color = e.target.value;
});

// 太さ変更
document.getElementById("brushSize").addEventListener("input", (e) => {
  canvas.freeDrawingBrush.width = parseInt(e.target.value);
});

// 描いたら送信（ID付き）
canvas.on("path:created", function(opt) {
  const pathData = opt.path.toObject();
  pathData.sender = socket.id;
  socket.emit("draw", pathData);
});

// 受信
socket.on("draw", function(data) {

  // 自分が送ったものは無視
  if (data.sender === socket.id) return;

  fabric.Path.fromObject(data, function(path) {
    canvas.add(path);
  });
});