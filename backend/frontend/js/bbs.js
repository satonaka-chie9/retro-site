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
      <div class="post_content_area">
        <pre class="post_body"></pre>
      </div>
      
      <!-- インライン編集フォーム -->
      <div class="inline-form hidden edit-form-area">
        <p style="margin: 0 0 5px 0; font-size: 11px;">編集内容を入力してください：</p>
        <textarea class="edit-textarea" style="width: 95%; height: 80px;"></textarea>
        <div style="margin-top: 5px;">
          <button class="save-edit-btn">保存</button>
          <button class="cancel-edit-btn">キャンセル</button>
        </div>
      </div>

      <!-- インライン削除確認 -->
      <div class="inline-confirm hidden delete-confirm-area">
        <span class="confirm-msg">この投稿を削除しますか？</span>
        <button class="confirm-delete-btn">はい、削除します</button>
        <button class="cancel-delete-btn">いいえ</button>
      </div>

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
    const editArea = div.querySelector(".edit-form-area");
    const delArea = div.querySelector(".delete-confirm-area");
    const contentArea = div.querySelector(".post_content_area");
    const footerArea = div.querySelector(".post_footer");

    if (editBtn) {
      editBtn.addEventListener("click", () => {
        const textarea = div.querySelector(".edit-textarea");
        textarea.value = post.content;
        editArea.classList.remove("hidden");
        contentArea.classList.add("hidden");
        footerArea.classList.add("hidden");
      });
    }

    div.querySelector(".save-edit-btn")?.addEventListener("click", async () => {
      const newContent = div.querySelector(".edit-textarea").value;
      await performEditPost(post.id, post.name, newContent);
    });

    div.querySelector(".cancel-edit-btn")?.addEventListener("click", () => {
      editArea.classList.add("hidden");
      contentArea.classList.remove("hidden");
      footerArea.classList.remove("hidden");
    });

    if (delBtn) {
      delBtn.addEventListener("click", () => {
        delArea.classList.remove("hidden");
        footerArea.classList.add("hidden");
      });
    }

    div.querySelector(".confirm-delete-btn")?.addEventListener("click", async () => {
      await performDeletePost(post.id);
    });

    div.querySelector(".cancel-delete-btn")?.addEventListener("click", () => {
      delArea.classList.add("hidden");
      footerArea.classList.remove("hidden");
    });

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

// 実際の編集処理
async function performEditPost(id, currentName, newContent) {
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

// 実際の削除処理
async function performDeletePost(id) {
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
