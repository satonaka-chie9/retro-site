// Socket.io の接続（引数なしで自動的に同じホストに接続）
const socket = io();

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let drawing = false;
let current = {
  color: '#000000',
  size: 3
};

// 色と太さの同期
document.getElementById("colorPicker").addEventListener("change", e => {
  current.color = e.target.value;
});

document.getElementById("brushSize").addEventListener("input", e => {
  current.size = parseInt(e.target.value);
});

/* ===== 描画ロジック ===== */

function drawLine(x0, y0, x1, y1, color, size, emit) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.closePath();

  if (!emit) return;
  const w = canvas.width;
  const h = canvas.height;

  // 画面サイズが違っても大丈夫なように割合で送るか、単純に座標で送るか
  // ここでは単純な座標で送ります
  socket.emit('drawing', {
    x0: x0,
    y0: y0,
    x1: x1,
    y1: y1,
    color: color,
    size: size
  });
}

function onMouseDown(e) {
  drawing = true;
  current.x = e.offsetX || e.touches[0].clientX - canvas.getBoundingClientRect().left;
  current.y = e.offsetY || e.touches[0].clientY - canvas.getBoundingClientRect().top;
}

function onMouseUp(e) {
  if (!drawing) return;
  drawing = false;
  drawLine(current.x, current.y, e.offsetX || e.touches[0].clientX - canvas.getBoundingClientRect().left, e.offsetY || e.touches[0].clientY - canvas.getBoundingClientRect().top, current.color, current.size, true);
}

function onMouseMove(e) {
  if (!drawing) return;
  const x = e.offsetX || (e.touches ? e.touches[0].clientX - canvas.getBoundingClientRect().left : 0);
  const y = e.offsetY || (e.touches ? e.touches[0].clientY - canvas.getBoundingClientRect().top : 0);
  
  drawLine(current.x, current.y, x, y, current.color, current.size, true);
  current.x = x;
  current.y = y;
}

// マウスイベント
canvas.addEventListener('mousedown', onMouseDown, false);
canvas.addEventListener('mouseup', onMouseUp, false);
canvas.addEventListener('mouseout', onMouseUp, false);
canvas.addEventListener('mousemove', onMouseMove, false);

// タッチイベント（スマホ対応）
canvas.addEventListener('touchstart', onMouseDown, false);
canvas.addEventListener('touchend', onMouseUp, false);
canvas.addEventListener('touchcancel', onMouseUp, false);
canvas.addEventListener('touchmove', onMouseMove, false);

// サーバーからの描画データ受信
socket.on('drawing', (data) => {
  drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size);
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
