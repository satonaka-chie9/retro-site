/**
 * 共通サイドバーの制御スクリプト
 */

window.csrfToken = ""; // グローバルに共有

async function fetchCsrfToken() {
  try {
    const res = await fetch("/api/csrf-token");
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    window.csrfToken = data.csrfToken;
    console.log("CSRF token updated");
    return window.csrfToken;
  } catch (err) {
    console.error("Failed to fetch CSRF token:", err);
    return "";
  }
}

// 他のJSからも呼び出せるように公開
window.getSharedCsrfToken = fetchCsrfToken;

function getDeviceId() {
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
}

function getAdminToken() {
  const token = localStorage.getItem("admin_token");
  return (token && token !== "undefined") ? token : "";
}

// サイドバーのHTMLを読み込んで挿入する
async function loadSidebar() {
  const sidebarPlaceholder = document.getElementById("sidebar-placeholder");
  if (!sidebarPlaceholder) return;

  try {
    const response = await fetch("sidebar.html");
    const html = await response.text();
    sidebarPlaceholder.innerHTML = html;

    // サイドバー挿入後に初期化処理を実行
    await initSidebarFeatures();
  } catch (err) {
    console.error("Failed to load sidebar:", err);
  }
}

async function initSidebarFeatures() {
  updateAdminUI();
  updateCounter();
  initClapEvents();
  updateClapCountDisplay();
  
  // CSRFトークンをここで1回だけ取得
  await fetchCsrfToken();
}

// 管理者UIの更新
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

  // トークンがなければ取得
  if (!window.csrfToken) {
    await fetchCsrfToken();
  }
  const token = window.csrfToken;

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-CSRF-Token": token
      },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      localStorage.setItem("admin_token", data.admin_token);
      if (msgArea) {
        msgArea.style.color = "#00FF00";
        msgArea.innerText = "成功！";
      }
      setTimeout(() => location.reload(), 500);
    } else {
      if (msgArea) {
        msgArea.style.color = "#FF0000";
        msgArea.innerText = data.error || "NG";
      }
      localStorage.removeItem("admin_token");
      // エラー時はトークンをクリアして再取得を促す
      window.csrfToken = "";
      await fetchCsrfToken();
    }
  } catch (err) {
    if (msgArea) msgArea.innerText = "ERR";
  }
}

function adminLogout() {
  localStorage.removeItem("admin_token");
  location.reload();
}

// アクセスカウンターの更新
async function updateCounter() {
  const device_id = getDeviceId();
  try {
    await fetch("/api/counter/increment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id }),
    });
    const res = await fetch("/api/counter");
    const data = await res.json();
    const counterElement = document.getElementById("counter");
    if (counterElement) {
      counterElement.innerText = String(data.count).padStart(6, "0");
    }
  } catch (err) {
    console.error("Counter error:", err);
  }
}

// Web拍手
function initClapEvents() {
  const openBtn = document.getElementById("open-clap-modal");
  const closeBtn = document.getElementById("close-clap-modal");
  const sendBtn = document.getElementById("send-clap");
  const modal = document.getElementById("clap-modal");
  const overlay = document.getElementById("clap-overlay");
  const messageInput = document.getElementById("clap-message");

  if (!openBtn || !modal || !overlay) return;

  openBtn.onclick = () => {
    modal.style.display = "block";
    overlay.style.display = "block";
    messageInput.value = "";
    messageInput.focus();
  };

  const closeModal = () => {
    modal.style.display = "none";
    overlay.style.display = "none";
  };

  closeBtn.onclick = closeModal;
  overlay.onclick = closeModal;

  sendBtn.onclick = async () => {
    const message = messageInput.value;
    const device_id = getDeviceId();

    try {
      const res = await fetch("/api/claps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, device_id })
      });

      if (res.ok) {
        alert("ありがとうございます！");
        closeModal();
      } else {
        alert("送信失敗");
      }
    } catch (err) {
      alert("通信エラー");
    }
  };
}

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

// Socket.io の設定 (拍手更新通知用)
if (typeof io !== "undefined") {
  const socket = io();
  socket.on("clap_update", (data) => {
    const countEl = document.getElementById("clap-count");
    if (countEl) countEl.innerText = `${data.total} 拍手`;
  });
}

// 実行開始
document.addEventListener("DOMContentLoaded", loadSidebar);
