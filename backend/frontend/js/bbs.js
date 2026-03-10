const API_BASE = "";

function getDeviceId() {
  let deviceId = localStorage.getItem("device_id");

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("device_id", deviceId);
  }

  return deviceId;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  
  // Date オブジェクトを作成
  // SQLite の YYYY-MM-DD HH:MM:SS 形式 (UTC) を正しく解釈するため
  // スペースを 'T' に置換し、末尾に 'Z' を付与して ISO 形式（UTC）にする
  const date = (dateStr.includes("T") || dateStr.includes("Z")) 
    ? new Date(dateStr) 
    : new Date(dateStr.replace(" ", "T") + "Z");

  // ブラウザのタイムゾーンに関わらず常に日本時間（Asia/Tokyo）でフォーマット
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

  data.forEach(post => {
    const div = document.createElement("div");
    div.className = "post";

    const created = formatDate(post.created_at);
    let editedMark = "";
    if (post.updated_at) {
      editedMark = `（編集済: ${formatDate(post.updated_at)}）`;
    }

    div.innerHTML = `
      <div class="post_header">
        No.${post.id} ${post.name}
        ${created} ${editedMark}
      </div>
      <pre class="post_body"></pre>
      <button class="edit-btn">編集</button>
      <button class="delete-btn">削除</button>
    `;

    div.querySelector(".post_body").textContent = post.content;

    // 編集ボタン
    div.querySelector(".edit-btn").addEventListener("click", () => {
      editPost(post.id, post.content);
    });

    // 削除ボタン
    div.querySelector(".delete-btn").addEventListener("click", () => {
      deletePost(post.id);
    });

    container.appendChild(div);
  });
}

// ページ読み込み時に保存されたユーザー名を復元
function restoreUserName() {
  const savedName = localStorage.getItem("bbs_user_name");
  if (savedName) {
    const nameInput = document.getElementById("name");
    if (nameInput) {
      nameInput.value = savedName;
    }
  }
}

document.getElementById("postForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const nameInput = document.getElementById("name");
  const messageInput = document.getElementById("message");
  const name = nameInput.value || "名無しさん";
  const content = messageInput.value;

  // ユーザー名を保存
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

async function editPost(id, currentContent) {
  const newContent = prompt("内容を編集", currentContent);
  if (!newContent) return;

  const res = await fetch(API_BASE + "/api/posts/" + id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: localStorage.getItem("bbs_user_name") || "名無しさん",
      content: newContent,
      device_id: getDeviceId()
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device_id: getDeviceId()
    })
  });

  if (res.ok) {
    loadPosts();
  } else {
    const data = await res.json();
    alert(data.error || "削除に失敗しました。");
  }
}

// ページアクセス時にカウンタを増やす
async function updateCounter() {
  const device_id = getDeviceId();
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
}

// 初期化
loadPosts();
restoreUserName();
updateCounter();

// 定期的に投稿を更新（3秒おき）
setInterval(loadPosts, 3000);
