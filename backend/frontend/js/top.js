function getDeviceId() {
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
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

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    console.log("Login response status:", res.status);
    const data = await res.json();
    console.log("Login response data:", data);

    if (res.ok && data.success) {
      localStorage.setItem("admin_token", data.admin_token);
      if (msgArea) {
        msgArea.style.color = "#00FF00";
        msgArea.innerText = "ログイン成功！";
      }
      setTimeout(() => location.reload(), 800);
    } else {
      if (msgArea) {
        msgArea.style.color = "#FF0000";
        msgArea.innerText = "IDまたはパスワードが違います";
      }
      localStorage.removeItem("admin_token");
    }
  } catch (err) {
    if (msgArea) {
      msgArea.style.color = "#FF0000";
      msgArea.innerText = "通信エラーが発生しました";
    }
  }
}

function adminLogout() {
  localStorage.removeItem("admin_token");
  alert("ログアウトしました。");
  location.reload();
}

function updateAdminUI() {
  const token = localStorage.getItem("admin_token");
  const loginArea = document.getElementById("admin-login-area");
  const logoutArea = document.getElementById("admin-logout-area");
  const loginBtn = document.getElementById("admin-login-btn");
  const logoutBtn = document.getElementById("admin-logout-btn");

  if (token && token !== "undefined") {
    if (loginArea) loginArea.style.display = "none";
    if (logoutArea) logoutArea.style.display = "block";
    if (logoutBtn) {
      logoutBtn.onclick = adminLogout;
    }
  } else {
    if (loginArea) loginArea.style.display = "block";
    if (logoutArea) logoutArea.style.display = "none";
    if (loginBtn) {
      loginBtn.onclick = adminLogin;
    }
  }
}

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

// 初期化（BBSページなどでも確実に呼ばれるようにする）
window.addEventListener('DOMContentLoaded', () => {
  updateAdminUI();
  updateCounter();
});

// グローバルに公開
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
