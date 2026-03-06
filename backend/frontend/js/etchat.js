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
    strokeLineJoin: 'round',
    selectable: false,
    evented: false
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

/* ===== 他人の描画 (複数人対応) ===== */

const remotePaths = new Map();

socket.on("drawStart", data => {
  const p = new fabric.Path([
    ['M', data.x, data.y]
  ], {
    stroke: data.color,
    strokeWidth: data.size,
    fill: null,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    selectable: false,
    evented: false
  });
  canvas.add(p);
  remotePaths.set(data.id, p);
});

socket.on("drawing", data => {
  const p = remotePaths.get(data.id);
  if (!p) return;

  p.path.push(['L', data.x, data.y]);
  canvas.requestRenderAll();
});

socket.on("drawEnd", data => {
  remotePaths.delete(data.id);
});

/* ===== チャット機能 ===== */

const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatName = document.getElementById("chatName");
const chatMessages = document.getElementById("chat_messages");

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = chatName.value || "名無しさん";
  const message = chatInput.value;
  if (message) {
    socket.emit("chat", { name, message });
    chatInput.value = "";
  }
});

socket.on("chat", (data) => {
  const msgDiv = document.createElement("div");
  msgDiv.className = "chat_message_item";
  msgDiv.innerHTML = `<strong>${data.name}</strong>: ${data.message}`;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

/* ===== アクセスカウンタ ===== */

async function updateCounter() {
  const res = await fetch("/api/counter");
  const data = await res.json();
  document.getElementById("counter").innerText =
    String(data.count).padStart(4, "0");
}
updateCounter();
