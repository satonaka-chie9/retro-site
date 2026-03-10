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
let saveTimeout = null;

function saveState() {
  historyIndex++;
  if (historyIndex < history.length) {
    history.splice(historyIndex);
  }
  history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
}

// 初期状態を保存
saveState();

// 描画を受信したときに履歴を保存するためのタイマー
function requestSaveState() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveState();
  }, 500); // 描画が止まって0.5秒後に保存
}

// UI 操作
const colorPicker = document.getElementById("colorPicker");
const brushSize = document.getElementById("brushSize");

if (colorPicker) {
  colorPicker.addEventListener("change", e => {
    current.color = e.target.value;
  });
}

if (brushSize) {
  brushSize.addEventListener("input", e => {
    current.size = parseInt(e.target.value);
  });
}

// 消しゴムとペン
const btnPen = document.getElementById("btn_pen");
if (btnPen) {
  btnPen.addEventListener("click", () => {
    current.color = colorPicker.value;
  });
}

const btnEraser = document.getElementById("btn_eraser");
if (btnEraser) {
  btnEraser.addEventListener("click", () => {
    current.color = "#ffffff";
  });
}

// 戻る / 進む (同期)
function performUndo(emit = false) {
  if (historyIndex > 0) {
    historyIndex--;
    ctx.putImageData(history[historyIndex], 0, 0);
    if (emit) socket.emit("undo");
  }
}

function performRedo(emit = false) {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    ctx.putImageData(history[historyIndex], 0, 0);
    if (emit) socket.emit("redo");
  }
}

const btnUndo = document.getElementById("btn_undo");
if (btnUndo) {
  btnUndo.addEventListener("click", () => performUndo(true));
}

const btnRedo = document.getElementById("btn_redo");
if (btnRedo) {
  btnRedo.addEventListener("click", () => performRedo(true));
}

socket.on("undo", () => performUndo(false));
socket.on("redo", () => performRedo(false));

// 全消し
const btnClear = document.getElementById("btn_clear");
if (btnClear) {
  btnClear.addEventListener("click", () => {
    if (confirm("キャンバスをすべて消去しますか？")) {
      socket.emit("clearCanvas");
    }
  });
}

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
  current.x = (e.clientX || (e.touches ? e.touches[0].clientX : 0)) - rect.left;
  current.y = (e.clientY || (e.touches ? e.touches[0].clientY : 0)) - rect.top;
}

function onMouseUp(e) {
  if (!drawing) return;
  drawing = false;
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
  requestSaveState(); // 受信後にも保存を予約
});

/* ===== チャット機能 ===== */

const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatName = document.getElementById("chatName");
const chatMessages = document.getElementById("chat_messages");

// ユーザー名を復元
function restoreChatName() {
  const savedName = localStorage.getItem("bbs_user_name");
  if (savedName && chatName) {
    chatName.value = savedName;
  }
}

if (chatForm) {
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = chatName.value || "名無しさん";
    const message = chatInput.value;
    
    // ユーザー名を保存 (暫定的)
    localStorage.setItem("bbs_user_name", name);

    if (message) {
      socket.emit("chat", { 
        name, 
        message, 
        device_id: localStorage.getItem("device_id") 
      });
      chatInput.value = "";
    }
  });
}

socket.on("chat", (data) => {
  // 自分が送った場合のリネーム反映
  if (data.used_name && localStorage.getItem("bbs_user_name") !== data.used_name) {
    // 自分が入力していた名前と一致する場合のみ更新
    if (chatName && chatName.value === localStorage.getItem("bbs_user_name")) {
      localStorage.setItem("bbs_user_name", data.used_name);
      chatName.value = data.used_name;
    }
  }

  const msgDiv = document.createElement("div");
  msgDiv.className = "chat_message_item";
  msgDiv.innerHTML = `<strong>${data.name}</strong>: ${data.message}`;
  if (chatMessages) {
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});

socket.on("chat_error", (data) => {
  alert(data.message);
});

/* ===== アクセスカウンタ ===== */

async function updateCounter() {
  const device_id = localStorage.getItem("device_id") || "guest";
  try {
    await fetch("/api/counter/increment", { 
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id })
    });
    const res = await fetch("/api/counter");
    const data = await res.json();
    const counterElement = document.getElementById("counter");
    if (counterElement) {
      counterElement.innerText = String(data.count).padStart(6, "0");
    }
  } catch (err) {
    console.error(err);
  }
}

// 初期化
restoreChatName();
updateCounter();
