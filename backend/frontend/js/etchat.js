// Socket.io の接続
const socket = io();

let csrfToken = "";

async function fetchCsrfToken() {
  try {
    const res = await fetch("/api/csrf-token");
    const data = await res.json();
    csrfToken = data.csrfToken;
  } catch (err) {
    console.error("Failed to fetch CSRF token:", err);
  }
}

function getAdminToken() {
  const token = localStorage.getItem("admin_token");
  return (token && token !== "undefined") ? token : "";
}

// 管理者ログイン
async function adminLogin() {
  const userInput = document.getElementById("admin-user");
  const passInput = document.getElementById("admin-pass");
  const msgArea = document.getElementById("admin-msg");
  
  if (!userInput || !passInput) return;

  const username = userInput.value;
  const password = passInput.value;

  if (msgArea) {
    msgArea.style.color = "#00FF00";
    msgArea.innerText = "認証中...";
  }

  if (!csrfToken) await fetchCsrfToken();

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken
      },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      localStorage.setItem("admin_token", data.admin_token);
      setTimeout(() => location.reload(), 500);
    } else {
      if (msgArea) {
        msgArea.style.color = "#FF0000";
        msgArea.innerText = "ID/PASSが違います";
      }
      localStorage.removeItem("admin_token");
      await fetchCsrfToken();
    }
  } catch (err) {
    if (msgArea) {
      msgArea.style.color = "#FF0000";
      msgArea.innerText = "通信エラー";
    }
  }
}

function adminLogout() {
  localStorage.removeItem("admin_token");
  alert("ログアウトしました。");
  location.reload();
}

function updateAdminUI() {
  const token = getAdminToken();
  const loginArea = document.getElementById("admin-login-area");
  const logoutArea = document.getElementById("admin-logout-area");
  const loginBtn = document.getElementById("admin-login-btn");
  const logoutBtn = document.getElementById("admin-logout-btn");

  if (token) {
    if (loginArea) loginArea.style.display = "none";
    if (logoutArea) logoutArea.classList.remove("hidden");
    if (logoutBtn) {
      logoutBtn.onclick = adminLogout;
    }
  } else {
    if (loginArea) loginArea.style.display = "block";
    if (logoutArea) logoutArea.classList.add("hidden");
    if (loginBtn) {
      loginBtn.onclick = adminLogin;
    }
  }
}

function getDeviceId() {
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
}

// ===== Web 拍手機能 =====
async function updateClapCountDisplay() {
  try {
    const res = await fetch("/api/claps/count");
    const data = await res.json();
    const countEl = document.getElementById("clap-count");
    if (countEl) countEl.innerText = `${data.total} 拍手`;
  } catch (err) {
    console.error("Clap count error:", err);
  }
}

socket.on("clap_update", (data) => {
  const countEl = document.getElementById("clap-count");
  if (countEl) countEl.innerText = `${data.total} 拍手`;
});

function initClapEvents() {
  const openBtn = document.getElementById("open-clap-modal");
  const closeBtn = document.getElementById("close-clap-modal");
  const sendBtn = document.getElementById("send-clap");
  const modal = document.getElementById("clap-modal");
  const overlay = document.getElementById("clap-overlay");
  const messageInput = document.getElementById("clap-message");

  if (!openBtn || !modal || !overlay) return;

  const openModal = () => {
    modal.style.display = "block";
    overlay.style.display = "block";
    messageInput.value = "";
    messageInput.focus();
  };

  const closeModal = () => {
    modal.style.display = "none";
    overlay.style.display = "none";
  };

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);

  sendBtn.addEventListener("click", async () => {
    const message = messageInput.value;
    const device_id = getDeviceId();

    try {
      const res = await fetch("/api/claps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, device_id })
      });

      if (res.ok) {
        alert("拍手を送信しました！ありがとうございます！");
        closeModal();
      } else {
        alert("送信に失敗しました。");
      }
    } catch (err) {
      alert("通信エラーが発生しました。");
    }
  });
}

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const brushCursor = document.getElementById('brush-cursor');

let drawing = false;
let startX, startY;
let snapshot; // プレビュー用のキャンバス状態保存

let current = {
  color: '#000000',
  size: 3,
  tool: 'pen'
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

// 初期状態を保存 (背景をグレーで塗りつぶす)
ctx.fillStyle = "#808080";
ctx.fillRect(0, 0, canvas.width, canvas.height);
saveState();

function requestSaveState() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveState();
  }, 500);
}

// UI 操作
const colorPicker = document.getElementById("colorPicker");
const brushSize = document.getElementById("brushSize");
const toolButtons = document.querySelectorAll(".tool-btn");

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

// ツール切り替え (CSP準拠のイベントリスナー)
toolButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const tool = btn.dataset.tool;
    current.tool = tool;
    
    // アクティブ表示の切り替え
    toolButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    if (tool === 'eraser') {
      current.color = '#808080'; // 背景色と同じ
    } else if (tool === 'pen' || tool === 'line' || tool === 'rect' || tool === 'fill') {
      current.color = colorPicker.value;
    }
  });
});

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

document.getElementById("btn_undo").addEventListener("click", () => performUndo(true));
document.getElementById("btn_redo").addEventListener("click", () => performRedo(true));

socket.on("undo", () => performUndo(false));
socket.on("redo", () => performRedo(false));

// 全消し
document.getElementById("btn_clear").addEventListener("click", () => {
  if (confirm("キャンバスをすべて消去しますか？")) {
    socket.emit("clearCanvas");
  }
});

socket.on("clearCanvas", () => {
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  saveState();
});

/* ===== 描画ロジック ===== */

function drawFreeLine(x0, y0, x1, y1, color, size, emit) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.closePath();

  if (emit) {
    socket.emit('drawing', { type: 'pen', x0, y0, x1, y1, color, size });
  }
}

function drawShape(type, x0, y0, x1, y1, color, size, emit) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  if (type === 'line') {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  } else if (type === 'rect') {
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
  }
  ctx.stroke();
  ctx.closePath();

  if (emit) {
    socket.emit('drawing', { type, x0, y0, x1, y1, color, size });
  }
}

// 塗りつぶし (Flood Fill)
function floodFill(startX, startY, fillColor, emit) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const targetColor = getPixel(startX, startY, data);
  const fillRGB = hexToRgb(fillColor);

  if (colorsMatch(targetColor, [fillRGB.r, fillRGB.g, fillRGB.b, 255])) return;

  const stack = [[startX, startY]];
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    let currentY = y;
    while (currentY >= 0 && colorsMatch(getPixel(x, currentY, data), targetColor)) {
      currentY--;
    }
    currentY++;
    let reachLeft = false;
    let reachRight = false;
    while (currentY < canvas.height && colorsMatch(getPixel(x, currentY, data), targetColor)) {
      setPixel(x, currentY, fillRGB, data);
      if (x > 0) {
        if (colorsMatch(getPixel(x - 1, currentY, data), targetColor)) {
          if (!reachLeft) {
            stack.push([x - 1, currentY]);
            reachLeft = true;
          }
        } else if (reachLeft) {
          reachLeft = false;
        }
      }
      if (x < canvas.width - 1) {
        if (colorsMatch(getPixel(x + 1, currentY, data), targetColor)) {
          if (!reachRight) {
            stack.push([x + 1, currentY]);
            reachRight = true;
          }
        } else if (reachRight) {
          reachRight = false;
        }
      }
      currentY++;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  if (emit) {
    socket.emit('drawing', { type: 'fill', x: startX, y: startY, color: fillColor });
  }
}

function getPixel(x, y, data) {
  const i = (y * canvas.width + x) * 4;
  return [data[i], data[i+1], data[i+2], data[i+3]];
}

function setPixel(x, y, rgb, data) {
  const i = (y * canvas.width + x) * 4;
  data[i] = rgb.r;
  data[i+1] = rgb.g;
  data[i+2] = rgb.b;
  data[i+3] = 255;
}

function colorsMatch(c1, c2) {
  return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2] && c1[3] === c2[3];
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/* ===== イベントハンドラ ===== */

function updateBrushCursor(e) {
  if (!brushCursor) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX || (e.touches ? e.touches[0].clientX : 0)) - rect.left;
  const y = (e.clientY || (e.touches ? e.touches[0].clientY : 0)) - rect.top;

  brushCursor.style.width = current.size + 'px';
  brushCursor.style.height = current.size + 'px';
  brushCursor.style.left = (x - current.size / 2) + 'px';
  brushCursor.style.top = (y - current.size / 2) + 'px';
  brushCursor.style.display = 'block';
}

function onMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  startX = (e.clientX || (e.touches ? e.touches[0].clientX : 0)) - rect.left;
  startY = (e.clientY || (e.touches ? e.touches[0].clientY : 0)) - rect.top;
  
  if (current.tool === 'fill') {
    floodFill(Math.floor(startX), Math.floor(startY), current.color, true);
    saveState();
    return;
  }

  drawing = true;
  current.x = startX;
  current.y = startY;
  snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function onMouseMove(e) {
  updateBrushCursor(e);
  if (!drawing) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX || (e.touches ? e.touches[0].clientX : 0)) - rect.left;
  const y = (e.clientY || (e.touches ? e.touches[0].clientY : 0)) - rect.top;

  if (current.tool === 'pen' || current.tool === 'eraser') {
    drawFreeLine(current.x, current.y, x, y, current.color, current.size, true);
    current.x = x;
    current.y = y;
  } else if (current.tool === 'line' || current.tool === 'rect') {
    ctx.putImageData(snapshot, 0, 0); // プレビューのために一度戻す
    drawShape(current.tool, startX, startY, x, y, current.color, current.size, false);
  }
}

function onMouseUp(e) {
  if (!drawing) return;
  drawing = false;

  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX || (e.touches ? e.touches[0].clientX : 0)) - rect.left;
  const y = (e.clientY || (e.touches ? e.touches[0].clientY : 0)) - rect.top;

  if (current.tool === 'line' || current.tool === 'rect') {
    drawShape(current.tool, startX, startY, x, y, current.color, current.size, true);
  }

  saveState();
}

// マウス・タッチイベント登録
canvas.addEventListener('mousedown', onMouseDown, false);
canvas.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('mouseup', onMouseUp, false);

canvas.addEventListener('mouseenter', (e) => {
  if (brushCursor) brushCursor.style.display = 'block';
});
canvas.addEventListener('mouseleave', (e) => {
  if (brushCursor) brushCursor.style.display = 'none';
});

canvas.addEventListener('touchstart', onMouseDown, { passive: false });
canvas.addEventListener('touchmove', onMouseMove, { passive: false });
window.addEventListener('touchend', onMouseUp, { passive: false });

// サーバーからの描画データ受信
socket.on('drawing', (data) => {
  if (data.type === 'pen' || !data.type) {
    drawFreeLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, false);
  } else if (data.type === 'line' || data.type === 'rect') {
    drawShape(data.type, data.x0, data.y0, data.x1, data.y1, data.color, data.size, false);
  } else if (data.type === 'fill') {
    floodFill(Math.floor(data.x), Math.floor(data.y), data.color, false);
  }
  requestSaveState();
});

/* ===== チャット・カウンタ (既存のまま) ===== */

const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatName = document.getElementById("chatName");
const chatMessages = document.getElementById("chat_messages");

function getDeviceId() {
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
}

function restoreChatName() {
  const savedName = localStorage.getItem("bbs_user_name");
  if (savedName && chatName) {
    chatName.value = savedName;
  }
}

// 入力時に保存するようにして、送信しなくても保持されるようにする
if (chatName) {
  chatName.addEventListener("input", (e) => {
    localStorage.setItem("bbs_user_name", e.target.value);
  });
}

if (chatForm) {
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = chatName.value || "名無しさん";
    const message = chatInput.value;
    localStorage.setItem("bbs_user_name", name);
    if (message) {
      socket.emit("chat", { name, message, device_id: getDeviceId() });
      chatInput.value = "";
    }
  });
}

function addChatMessage(data) {
  const msgDiv = document.createElement("div");
  msgDiv.className = "chat_message_item";
  
  const nameSpan = document.createElement("strong");
  nameSpan.textContent = data.name;
  
  const msgSpan = document.createElement("span");
  msgSpan.textContent = `: ${data.message}`;
  
  msgDiv.appendChild(nameSpan);
  msgDiv.appendChild(msgSpan);

  if (chatMessages) {
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

socket.on("chat", (data) => {
  addChatMessage(data);
});

socket.on("chat_history", (history) => {
  if (chatMessages) chatMessages.innerHTML = "";
  history.forEach(data => {
    addChatMessage(data);
  });
});

async function updateCounter() {
  const device_id = getDeviceId();
  try {
    await fetch("/api/counter/increment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device_id }) });
    const res = await fetch("/api/counter");
    const data = await res.json();
    const counterElement = document.getElementById("counter");
    if (counterElement) counterElement.innerText = String(data.count).padStart(6, "0");
  } catch (err) { console.error(err); }
}

// ページ読み込み完了時に実行
document.addEventListener('DOMContentLoaded', async () => {
  await fetchCsrfToken();
  updateAdminUI();
  restoreChatName();
  updateCounter();
  initClapEvents();
  updateClapCountDisplay();
});

// 万が一 DOMContentLoaded が発火済みのケースに対応
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  updateAdminUI();
}

// グローバルに公開
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
