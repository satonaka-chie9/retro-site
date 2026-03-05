const socket = io("https://retro-site-test-echa.onrender.com", {
  transports: ["websocket"]
});

/* ====== Fabric描画 ====== */
const canvas = new fabric.Canvas('c', {
  isDrawingMode: true
});

canvas.renderOnAddRemove = false;

canvas.freeDrawingBrush.width = 3;
canvas.freeDrawingBrush.color = "#000000";

document.getElementById("colorPicker").addEventListener("change", e => {
  canvas.freeDrawingBrush.color = e.target.value;
});

document.getElementById("brushSize").addEventListener("input", e => {
  canvas.freeDrawingBrush.width = parseInt(e.target.value);
});

canvas.on("path:created", function(opt) {
  const path = opt.path;

  const data = path.toObject([
    'path',
    'fill',
    'stroke',
    'strokeWidth',
    'strokeLineCap',
    'strokeLineJoin'
  ]);

  data.sender = socket.id;

  socket.emit("draw", data);
});

socket.on("draw", function(data) {
  if (data.sender === socket.id) return;

  fabric.util.enlivenObjects([data], function(objects) {
    objects.forEach(obj => {
      canvas.add(obj);
    });
    canvas.requestRenderAll(); // ←これが超重要
  });
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