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

  socket.emit("draw", data);

  // ← ここ追加：自分の線を一旦消す
  canvas.remove(path);
});

socket.on("draw", function(data) {

  fabric.util.enlivenObjects([data], function(objects) {
    objects.forEach(obj => {
      canvas.add(obj);
    });
    canvas.requestRenderAll();
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