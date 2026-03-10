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
  const username = prompt("管理者ユーザー名を入力してください");
  const password = prompt("管理者パスワードを入力してください");

  if (!username || !password) return;

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
  const loginBtn = document.getElementById("admin-login-btn");
  const logoutBtn = document.getElementById("admin-logout-btn");

  if (token) {
    if (loginBtn) loginBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "block";
  } else {
    if (loginBtn) {
       loginBtn.style.display = "block";
       loginBtn.innerText = "管理者ログイン";
       loginBtn.onclick = adminLogin;
    }
    if (logoutBtn) logoutBtn.style.display = "none";
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
