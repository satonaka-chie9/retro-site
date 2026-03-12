const API_BASE = "";
let csrfToken = "";

async function fetchCsrfToken() {
  try {
    const res = await fetch(API_BASE + "/api/csrf-token");
    const data = await res.json();
    csrfToken = data.csrfToken;
  } catch (err) {
    console.error("Failed to fetch CSRF token:", err);
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
    const res = await fetch(API_BASE + "/api/admin/login", {
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
      if (msgArea) {
        msgArea.style.color = "#00FF00";
        msgArea.innerText = "ログイン成功！";
      }
      setTimeout(() => {
        updateAdminUI();
        loadPosts();
      }, 500);
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
  updateAdminUI();
  loadPosts();
}

function updateAdminUI() {
  const token = getAdminToken();
  const loginArea = document.getElementById("admin-login-area");
  const logoutArea = document.getElementById("admin-logout-area");
  const loginBtn = document.getElementById("admin-login-btn");
  const logoutBtn = document.getElementById("admin-logout-btn");

  if (token) {
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
    const msgArea = document.getElementById("admin-msg");
    if (msgArea) msgArea.innerText = "";
  }
}

function formatDate(dateInput) {
  if (!dateInput) return "";
  
  let date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === "string") {
    if (dateInput.includes("T") || dateInput.includes("Z")) {
      date = new Date(dateInput);
    } else {
      // SQLite format "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM:SSZ" (UTC)
      date = new Date(dateInput.replace(" ", "T") + "Z");
    }
  } else {
    date = new Date(dateInput);
  }

  // 無効な日付のチェック
  if (isNaN(date.getTime())) return "日付不明";

  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const p = {};
  parts.forEach(part => p[part.type] = part.value);

  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

async function loadPosts() {
  const res = await fetch(API_BASE + "/api/posts");
  const data = await res.json();

  const container = document.getElementById("posts_container");
  container.innerHTML = "";

  const adminToken = getAdminToken();
  const currentDeviceId = getDeviceId();
  const isAdmin = adminToken.length > 0;

  data.forEach(post => {
    const div = document.createElement("div");
    div.className = "post";

    const created = formatDate(post.created_at);
    let editedMark = "";
    if (post.updated_at) {
      editedMark = `（編集済: ${formatDate(post.updated_at)}）`;
    }

    const isOwner = post.device_id === currentDeviceId;
    
    div.innerHTML = `
      <div class="post_header">
        No.<span class="post-id"></span> <span class="post-name"></span>
        <span class="post-date"></span> <span class="post-edited"></span>
      </div>
      <pre class="post_body"></pre>
      <div class="post_footer">
        ${(isOwner || isAdmin) ? `
          <button class="edit-btn">編集</button>
          <button class="delete-btn">削除</button>
        ` : ''}
      </div>
    `;

    div.querySelector(".post-id").textContent = post.id;
    div.querySelector(".post-name").textContent = post.name;
    div.querySelector(".post-date").textContent = created;
    div.querySelector(".post-edited").textContent = editedMark;
    div.querySelector(".post_body").textContent = post.content;

    const editBtn = div.querySelector(".edit-btn");
    const delBtn = div.querySelector(".delete-btn");

    if (editBtn) {
      editBtn.addEventListener("click", () => {
        editPost(post.id, post.name, post.content);
      });
    }
    if (delBtn) {
      delBtn.addEventListener("click", () => {
        deletePost(post.id);
      });
    }

    container.appendChild(div);
  });
}

function restoreUserName() {
  const savedName = localStorage.getItem("bbs_user_name");
  if (savedName) {
    const nameInput = document.getElementById("name");
    if (nameInput) {
      nameInput.value = savedName;
    }
  }
}

const postForm = document.getElementById("postForm");
if (postForm) {
  postForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById("name");
    const messageInput = document.getElementById("message");
    const name = nameInput.value || "名無しさん";
    const content = messageInput.value;

    localStorage.setItem("bbs_user_name", name);

    if (!csrfToken) await fetchCsrfToken();

    const res = await fetch(API_BASE + "/api/posts", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken
      },
      body: JSON.stringify({
        name,
        content,
        device_id: getDeviceId()
      })
    });

    if (res.ok) {
      const resultData = await res.json();
      const finalName = resultData.used_name || name;
      localStorage.setItem("bbs_user_name", finalName);
      nameInput.value = finalName; // 入力欄も連番付きの名前に更新
      messageInput.value = "";
      loadPosts();
    } else {
      const errorData = await res.json();
      alert(errorData.error || "投稿に失敗しました。");
      await fetchCsrfToken();
    }
  });
}

async function editPost(id, currentName, currentContent) {
  const newContent = prompt("内容を編集", currentContent);
  if (!newContent) return;

  if (!csrfToken) await fetchCsrfToken();

  const res = await fetch(API_BASE + "/api/posts/" + id, {
    method: "PUT",
    headers: { 
      "Content-Type": "application/json",
      "X-Admin-Token": getAdminToken(),
      "X-CSRF-Token": csrfToken
    },
    body: JSON.stringify({
      name: currentName,
      content: newContent,
      device_id: getDeviceId(),
      admin_token: getAdminToken()
    })
  });

  if (res.ok) {
    loadPosts();
  } else {
    const data = await res.json();
    alert(data.error || "編集に失敗しました。");
    await fetchCsrfToken();
  }
}

async function deletePost(id) {
  if (!confirm("本当に削除しますか？")) return;

  if (!csrfToken) await fetchCsrfToken();

  const res = await fetch(API_BASE + "/api/posts/" + id, {
    method: "DELETE",
    headers: { 
      "Content-Type": "application/json",
      "X-Admin-Token": getAdminToken(),
      "X-CSRF-Token": csrfToken
    },
    body: JSON.stringify({
      device_id: getDeviceId(),
      admin_token: getAdminToken()
    })
  });

  if (res.ok) {
    loadPosts();
  } else {
    const data = await res.json();
    alert(data.error || "削除に失敗しました。");
    await fetchCsrfToken();
  }
}

async function updateCounter() {
  const device_id = getDeviceId();
  try {
    await fetch(API_BASE + "/api/counter/increment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id }),
    });

    const res = await fetch(API_BASE + "/api/counter");
    const data = await res.json();

    const counterElement = document.getElementById("counter");
    if (counterElement) {
      counterElement.textContent = String(data.count).padStart(6, "0");
    }
  } catch (err) {
    console.error(err);
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  await fetchCsrfToken();
  updateAdminUI();
  updateCounter();
  loadPosts();
  restoreUserName();
});

// 万が一 DOMContentLoaded が発火済みのケースに対応
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  updateAdminUI();
}

setInterval(loadPosts, 5000);
