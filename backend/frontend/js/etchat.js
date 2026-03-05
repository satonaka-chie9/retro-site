const socket = io("https://retro-site-test-echa.onrender.com", {
  transports: ["websocket"]
});

const canvas = new fabric.Canvas('c');
canvas.isDrawingMode = false;

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

/* ====== 自分が描く ====== */

canvas.on("mouse:down", function(opt) {
  isDrawing = true;

  const pointer = canvas.getPointer(opt.e);

  currentPath = new fabric.Path(`M ${pointer.x} ${pointer.y}`, {
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
  if (!isDrawing) return;

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

/* ====== 他人の描画を受信 ====== */

let remotePath = null;

socket.on("drawStart", data => {
  remotePath = new fabric.Path(`M ${data.x} ${data.y}`, {
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

/* ====== チャット ====== */

const chatMessages = document.getElementById("chat_messages");

document.getElementById("chatForm").addEventListener("submit", function(e){
  e.preventDefault();

  const name = document.getElementById("chatName").value;
  const message = document.getElementById("chatInput").value;

  socket.emit("chat", { name, message });
  document.getElementById("chatInput").value = "";
});

socket.on("chat", function(data){
  const div = document.createElement("div");
  div.textContent = `${data.name}：${data.message}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});