// 動的なSocket URL（ローカルと本番両方に対応）
const socket = io(window.location.host, {
  transports: ["websocket", "polling"]
});

const canvas = new fabric.Canvas('c');

let isDrawing = false;
let currentPath = null;
let brushColor = "#000000";
let brushSize = 3;

document.getElementById("colorPicker").addEventListener("change", e => {
  brushColor = e.target.value;
});

document.getElementById("brushSize").addEventListener("input", e => {
  brushSize = parseInt(e.target.value);
});

/* ===== 自分の描画 ===== */

canvas.on("mouse:down", function(opt) {
  isDrawing = true;
  const pointer = canvas.getPointer(opt.e);

  currentPath = new fabric.Path([
    ['M', pointer.x, pointer.y]
  ], {
    stroke: brushColor,
    strokeWidth: brushSize,
    fill: null,
    strokeLineCap: 'round',
    strokeLineJoin: 'round'
  });

  canvas.add(currentPath);

  socket.emit("drawStart", {
    x: pointer.x,
    y: pointer.y,
    color: brushColor,
    size: brushSize
  });
});

canvas.on("mouse:move", function(opt) {
  if (!isDrawing || !currentPath) return;

  const pointer = canvas.getPointer(opt.e);

  currentPath.path.push(['L', pointer.x, pointer.y]);
  canvas.requestRenderAll();

  socket.emit("drawing", {
    x: pointer.x,
    y: pointer.y
  });
});

canvas.on("mouse:up", function() {
  isDrawing = false;
  currentPath = null;
  socket.emit("drawEnd");
});

/* ===== 他人の描画 ===== */

let remotePath = null;

socket.on("drawStart", data => {
  remotePath = new fabric.Path([
    ['M', data.x, data.y]
  ], {
    stroke: data.color,
    strokeWidth: data.size,
    fill: null,
    strokeLineCap: 'round',
    strokeLineJoin: 'round'
  });

  canvas.add(remotePath);
});

socket.on("drawing", data => {
  if (!remotePath) return;

  remotePath.path.push(['L', data.x, data.y]);
  canvas.requestRenderAll();
});

socket.on("drawEnd", () => {
  remotePath = null;
});