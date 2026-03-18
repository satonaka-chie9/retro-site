const socket = io();
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const brushCursor = document.getElementById('brush-cursor');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');

let drawing = false;
let currentTool = 'pen';
let startX, startY;
let snapshot;

function getDeviceId() {
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
}

// ツールボタンの切り替え
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
  });
});

// キャンバス操作
canvas.addEventListener('mousedown', (e) => {
  drawing = true;
  const rect = canvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
  
  if (currentTool === 'fill') {
    fill(startX, startY, colorPicker.value);
    syncCanvas();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // ブラシカーソルの更新
  const size = parseInt(brushSize.value);
  brushCursor.style.display = 'block';
  // キャンバス内の相対座標 (x, y) を使用して位置を合わせる
  brushCursor.style.left = `${x - size / 2}px`;
  brushCursor.style.top = `${y - size / 2}px`;
  brushCursor.style.width = `${size}px`;
  brushCursor.style.height = `${size}px`;

  if (!drawing || currentTool === 'fill') return;

  if (currentTool === 'pen' || currentTool === 'eraser') {
    ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = colorPicker.value;
    ctx.lineWidth = brushSize.value;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    
    socket.emit('drawing', {
      type: 'pen',
      x, y,
      lastX: startX, lastY: startY,
      color: colorPicker.value,
      size: brushSize.value,
      isEraser: currentTool === 'eraser'
    });
    startX = x;
    startY = y;
  } else {
    // 直線や四角はプレビュー表示のためスナップショットを戻す
    ctx.putImageData(snapshot, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = colorPicker.value;
    ctx.lineWidth = brushSize.value;
    
    if (currentTool === 'line') {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (currentTool === 'rect') {
      ctx.strokeRect(startX, startY, x - startX, y - startY);
    }
  }
});

canvas.addEventListener('mouseleave', () => {
  brushCursor.style.display = 'none';
});

canvas.addEventListener('mouseup', (e) => {
  if (!drawing) return;
  drawing = false;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (currentTool === 'line' || currentTool === 'rect') {
    socket.emit('drawing', {
      type: currentTool,
      startX, startY, x, y,
      color: colorPicker.value,
      size: brushSize.value
    });
  }
});

// 塗りつぶし (簡易版シードフィル)
function fill(startX, startY, fillColor) {
  const targetColor = getPixelColor(startX, startY);
  const fillRGB = hexToRgb(fillColor);
  if (colorsMatch(targetColor, fillRGB)) return;

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const stack = [[Math.round(startX), Math.round(startY)]];
  
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const currentPos = (y * canvas.width + x) * 4;
    
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
    if (!colorsMatch(getPixelAt(pixels, x, y), targetColor)) continue;

    setPixelAt(pixels, x, y, fillRGB);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(pixels, 0, 0);
  
  socket.emit('drawing', {
    type: 'fill',
    x: startX, y: startY,
    color: fillColor
  });
}

function getPixelColor(x, y) {
  const p = ctx.getImageData(x, y, 1, 1).data;
  return { r: p[0], g: p[1], b: p[2], a: p[3] };
}
function getPixelAt(imgData, x, y) {
  const i = (y * imgData.width + x) * 4;
  return { r: imgData.data[i], g: imgData.data[i+1], b: imgData.data[i+2], a: imgData.data[i+3] };
}
function setPixelAt(imgData, x, y, rgb) {
  const i = (y * imgData.width + x) * 4;
  imgData.data[i] = rgb.r; imgData.data[i+1] = rgb.g; imgData.data[i+2] = rgb.b; imgData.data[i+3] = 255;
}
function colorsMatch(c1, c2) {
  return c1.r === c2.r && c1.g === c2.g && c1.b === c2.b;
}
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

// ソケット受信
socket.on('drawing', (data) => {
  ctx.globalCompositeOperation = data.isEraser ? 'destination-out' : 'source-over';
  ctx.strokeStyle = data.color;
  ctx.lineWidth = data.size;
  ctx.lineCap = 'round';

  if (data.type === 'pen') {
    ctx.beginPath();
    ctx.moveTo(data.lastX, data.lastY);
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
  } else if (data.type === 'line') {
    ctx.beginPath();
    ctx.moveTo(data.startX, data.startY);
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
  } else if (data.type === 'rect') {
    ctx.strokeRect(data.startX, data.startY, data.x - data.startX, data.y - data.startY);
  } else if (data.type === 'fill') {
    fill(data.x, data.y, data.color);
  }
});

socket.on('chat_history', (rows) => {
  const chatMessages = document.getElementById('chat_messages');
  chatMessages.innerHTML = '';
  rows.forEach(appendMessage);
});

socket.on('chat', appendMessage);

function appendMessage(data) {
  const chatMessages = document.getElementById('chat_messages');
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<span class="chat-name"></span>: <span class="chat-text"></span>`;
  div.querySelector('.chat-name').textContent = data.name;
  div.querySelector('.chat-text').textContent = data.message;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 操作ボタン
document.getElementById('btn_undo').onclick = () => socket.emit('undo');
document.getElementById('btn_redo').onclick = () => socket.emit('redo');
document.getElementById('btn_clear').onclick = () => {
  if (confirm('キャンバスを全消去しますか？')) {
    socket.emit('clearCanvas');
  }
};

socket.on('clearCanvas', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// チャット
document.getElementById('chatForm').onsubmit = (e) => {
  e.preventDefault();
  const name = document.getElementById('chatName').value;
  const message = document.getElementById('chatInput').value;
  socket.emit('chat', { name, message, device_id: getDeviceId() });
  document.getElementById('chatInput').value = '';
};

// キャンバス全同期 (Undo/Redoなどで使用)
function syncCanvas() {
  // 本来は画像データを送るが、ここでは簡易化のため省略
}
