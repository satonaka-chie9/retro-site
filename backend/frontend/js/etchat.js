const socket = io();

const canvas = new fabric.Canvas('c', {
  isDrawingMode: true
});

// 初期ブラシ設定
canvas.freeDrawingBrush.width = 3;
canvas.freeDrawingBrush.color = "#000000";

// UI操作
document.getElementById("colorPicker").addEventListener("change", (e) => {
  canvas.freeDrawingBrush.color = e.target.value;
});

document.getElementById("brushSize").addEventListener("input", (e) => {
  canvas.freeDrawingBrush.width = parseInt(e.target.value);
});

// 描いたら送信
canvas.on("path:created", function(opt) {
  const pathData = opt.path.toObject();
  socket.emit("draw", pathData);
});

// 受信して描画
socket.on("draw", function(data) {
  fabric.Path.fromObject(data, function(path) {
    canvas.add(path);
  });
});