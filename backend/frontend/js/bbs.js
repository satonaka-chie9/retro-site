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

function formatDate(dateStr) {
  if (!dateStr) return "";
  
  const date = (dateStr.includes("T") || dateStr.includes("Z")) 
    ? new Date(dateStr) 
    : new Date(dateStr.replace(" ", "T") + "Z");

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
  // トークンが空でないなら管理者とみなす
  const isAdmin = adminToken.length > 0;

  data.forEach(post => {
    const div = document.createElement("div");
    div.className = "post";

    const created = formatDate(post.created_at);
    let editedMark = "";
    if (post.updated_at) {
      editedMark = `（編集済: ${formatDate(post.updated_at)}）`;
    }

    // 投稿者本人、または管理者の場合にボタンを表示
    const isOwner = post.device_id === currentDeviceId;
    
    div.innerHTML = `
      <div class="post_header">
        No.${post.id} ${post.name}
        ${created} ${editedMark}
      </div>
      <pre class="post_body"></pre>
      <div class="post_footer">
        ${(isOwner || isAdmin) ? `
          <button class="edit-btn">編集</button>
          <button class="delete-btn">削除</button>
        ` : ''}
      </div>
    `;

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

    const res = await fetch(API_BASE + "/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        content,
        device_id: getDeviceId()
      })
    });

    if (!res.ok) {
      const errorData = await res.json();
      alert(errorData.error || "投稿に失敗しました。");
      return;
    }

    messageInput.value = "";
    loadPosts();
  });
}

async function editPost(id, currentName, currentContent) {
  const newContent = prompt("内容を編集", currentContent);
  if (!newContent) return;

  const res = await fetch(API_BASE + "/api/posts/" + id, {
    method: "PUT",
    headers: { 
      "Content-Type": "application/json",
      "X-Admin-Token": getAdminToken()
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

  const res = await fetch(API_BASE + "/api/posts/" + id, {
    method: "DELETE",
    headers: { 
      "Content-Type": "application/json",
      "X-Admin-Token": getAdminToken()
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

// 初期化
loadPosts();
restoreUserName();

setInterval(loadPosts, 5000);
