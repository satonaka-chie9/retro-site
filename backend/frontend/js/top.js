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
  
  if (!userInput || !passInput) return;

  const username = userInput.value;
  const password = passInput.value;

  if (!username || !password) {
    alert("ユーザー名とパスワードを入力してください。");
    return;
  }

  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (data.success) {
    localStorage.setItem("admin_token", data.admin_token);
    alert("管理者としてログインしました。");
    location.reload();
  } else {
    alert("ログインに失敗しました。");
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

  if (token) {
    if (loginArea) loginArea.style.display = "none";
    if (logoutArea) logoutArea.style.display = "block";
  } else {
    if (loginArea) loginArea.style.display = "block";
    if (logoutArea) logoutArea.style.display = "none";
  }
}

async function updateCounter() {
  const device_id = getDeviceId();
  updateAdminUI();
  await fetch("/api/counter/increment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_id }),
  });
  const res = await fetch("/api/counter");
  const data = await res.json();
  document.getElementById("counter").innerText =
    String(data.count).padStart(6, "0");
}
updateCounter();

// グローバルに公開
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
