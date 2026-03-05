const socket = io();

/* ====== Fabric描画 ====== */
const canvas = new fabric.Canvas('c', {
  isDrawingMode: true
});

canvas.freeDrawingBrush.width = 3;
canvas.freeDrawingBrush.color = "#000000";

document.getElementById("colorPicker").addEventListener("change", e => {
  canvas.freeDrawingBrush.color = e.target.value;
});

document.getElementById("brushSize").addEventListener("input", e => {
  canvas.freeDrawingBrush.width = parseInt(e.target.value);
});

canvas.on("path:created", function(opt) {
  const data = opt.path.toObject();
  data.sender = socket.id;
  socket.emit("draw", data);
});

socket.on("draw", function(data) {
  if (data.sender === socket.id) return;

  fabric.Path.fromObject(data, function(path) {
    canvas.add(path);
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