const API_BASE = "";

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

function formatDate(dateInput) {
  if (!dateInput) return "";
  let date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === "string") {
    if (dateInput.includes("T") || dateInput.includes("Z")) {
      date = new Date(dateInput);
    } else {
      date = new Date(dateInput.replace(" ", "T") + "Z");
    }
  } else {
    date = new Date(dateInput);
  }
  if (isNaN(date.getTime())) return "日付不明";
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: false
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
  if (!container) return;
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
        ${isAdmin ? `<span class="post-ip" style="color: #888; font-size: 0.8em; margin-left: 5px;">[IP: ${post.ip || "unknown"}]</span>` : ""}
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

    // sidebar.jsが取得したトークンを使用。なければ取得を待つ。
    let token = window.csrfToken;
    if (!token && typeof window.getSharedCsrfToken === "function") {
      token = await window.getSharedCsrfToken();
    }

    const res = await fetch(API_BASE + "/api/posts", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-CSRF-Token": token
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
      nameInput.value = finalName;
      messageInput.value = "";
      loadPosts();
    } else {
      const errorData = await res.json();
      alert(errorData.error || "投稿に失敗しました。");
      // エラー時はトークンを再取得
      if (typeof window.getSharedCsrfToken === "function") {
        window.csrfToken = "";
        await window.getSharedCsrfToken();
      }
    }
  });
}

async function editPost(id, currentName, currentContent) {
  const newContent = prompt("内容を編集", currentContent);
  if (!newContent) return;
  
  let token = window.csrfToken;
  if (!token && typeof window.getSharedCsrfToken === "function") {
    token = await window.getSharedCsrfToken();
  }

  const res = await fetch(API_BASE + "/api/posts/" + id, {
    method: "PUT",
    headers: { 
      "Content-Type": "application/json",
      "X-Admin-Token": getAdminToken(),
      "X-CSRF-Token": token
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
  }
}

async function deletePost(id) {
  if (!confirm("本当に削除しますか？")) return;
  
  let token = window.csrfToken;
  if (!token && typeof window.getSharedCsrfToken === "function") {
    token = await window.getSharedCsrfToken();
  }

  const res = await fetch(API_BASE + "/api/posts/" + id, {
    method: "DELETE",
    headers: { 
      "Content-Type": "application/json",
      "X-Admin-Token": getAdminToken(),
      "X-CSRF-Token": token
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
  }
}

// Socket.io の設定
if (typeof io !== "undefined") {
  const socket = io();
  socket.on("post_update", () => {
    loadPosts();
  });
}

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  loadPosts();
  restoreUserName();
});
