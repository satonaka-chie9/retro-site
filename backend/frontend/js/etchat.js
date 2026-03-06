// Socket.io の接続
const socket = io();

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let drawing = false;
let current = {
  color: '#000000',
  size: 3
};

// 履歴管理
let history = [];
let historyIndex = -1;

function saveState() {
  historyIndex++;
  if (historyIndex < history.length) {
    history.splice(historyIndex);
  }
  history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
}

// 初期状態を保存
saveState();

// UI 操作
const colorPicker = document.getElementById("colorPicker");
const brushSize = document.getElementById("brushSize");

colorPicker.addEventListener("change", e => {
  current.color = e.target.value;
});

brushSize.addEventListener("input", e => {
  current.size = parseInt(e.target.value);
});

// 消しゴムとペン
document.getElementById("btn_pen").addEventListener("click", () => {
  current.color = colorPicker.value;
});

document.getElementById("btn_eraser").addEventListener("click", () => {
  current.color = "#ffffff";
});

// 戻る / 進む
document.getElementById("btn_undo").addEventListener("click", () => {
  if (historyIndex > 0) {
    historyIndex--;
    ctx.putImageData(history[historyIndex], 0, 0);
  }
});

document.getElementById("btn_redo").addEventListener("click", () => {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    ctx.putImageData(history[historyIndex], 0, 0);
  }
});

// 全消し
document.getElementById("btn_clear").addEventListener("click", () => {
  if (confirm("キャンバスをすべて消去しますか？")) {
    socket.emit("clearCanvas");
  }
});

socket.on("clearCanvas", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  saveState();
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
  const rect = canvas.getBoundingClientRect();
  current.x = (e.clientX || e.touches[0].clientX) - rect.left;
  current.y = (e.clientY || e.touches[0].clientY) - rect.top;
}

function onMouseUp(e) {
  if (!drawing) return;
  drawing = false;
  // マウスを離したときに履歴を保存
  saveState();
}

function onMouseMove(e) {
  if (!drawing) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX || (e.touches ? e.touches[0].clientX : 0)) - rect.left;
  const y = (e.clientY || (e.touches ? e.touches[0].clientY : 0)) - rect.top;
  
  drawLine(current.x, current.y, x, y, current.color, current.size, true);
  current.x = x;
  current.y = y;
}

// マウスイベント
canvas.addEventListener('mousedown', onMouseDown, false);
canvas.addEventListener('mouseup', onMouseUp, false);
canvas.addEventListener('mouseout', onMouseUp, false);
canvas.addEventListener('mousemove', onMouseMove, false);

// タッチイベント
canvas.addEventListener('touchstart', onMouseDown, { passive: false });
canvas.addEventListener('touchend', onMouseUp, { passive: false });
canvas.addEventListener('touchcancel', onMouseUp, { passive: false });
canvas.addEventListener('touchmove', onMouseMove, { passive: false });

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
  await fetch("/api/counter/increment", { method: "POST" });
  const res = await fetch("/api/counter");
  const data = await res.json();
  document.getElementById("counter").innerText =
    String(data.count).padStart(6, "0");
}
updateCounter();
