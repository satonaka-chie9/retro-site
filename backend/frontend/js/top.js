let csrfToken = "";

async function fetchCsrfToken() {
  try {
    const res = await fetch("/api/csrf-token");
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

function formatDate(dateInput) {
  if (!dateInput) return "";
  let date;
  if (dateInput instanceof Date) date = dateInput;
  else if (typeof dateInput === "string") {
    if (dateInput.includes("T") || dateInput.includes("Z")) date = new Date(dateInput);
    else date = new Date(dateInput.replace(" ", "T") + "Z");
  } else date = new Date(dateInput);
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

  // トークンがない場合は再取得を試みる
  if (!csrfToken) await fetchCsrfToken();

  try {
    const res = await fetch("/api/admin/login", {
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
      setTimeout(() => location.reload(), 500);
    } else {
      if (msgArea) {
        msgArea.style.color = "#FF0000";
        msgArea.innerText = data.error || "ID/PASSが違います";
      }
      localStorage.removeItem("admin_token");
      // エラー時はトークンを再取得（有効期限切れなどの対策）
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
  location.reload();
}

function updateAdminUI() {
  const token = getAdminToken();
  const loginArea = document.getElementById("admin-login-area");
  const logoutArea = document.getElementById("admin-logout-area");
  const loginBtn = document.getElementById("admin-login-btn");
  const logoutBtn = document.getElementById("admin-logout-btn");
  const newsPostArea = document.getElementById("news-post-area");

  if (token) {
    if (loginArea) loginArea.style.display = "none";
    if (logoutArea) logoutArea.style.display = "block";
    if (newsPostArea) newsPostArea.style.display = "block";
    if (logoutBtn) {
      logoutBtn.onclick = adminLogout;
    }
  } else {
    if (loginArea) loginArea.style.display = "block";
    if (logoutArea) logoutArea.style.display = "none";
    if (newsPostArea) newsPostArea.style.display = "none";
    if (loginBtn) {
      loginBtn.onclick = adminLogin;
    }
  }
}

async function fetchNews() {
  const listEl = document.getElementById("news-list");
  if (!listEl) return;

  try {
    const res = await fetch("/api/news");
    const newsItems = await res.json();
    
    if (newsItems.length === 0) {
      listEl.innerHTML = '<p style="color: #666;">お知らせはありません。</p>';
      return;
    }

    const isAdmin = getAdminToken().length > 0;

    listEl.innerHTML = "";
    newsItems.forEach(item => {
      const dateVal = item.created_at || item.updated_at;
      const dateStr = formatDate(dateVal);
      
      const div = document.createElement("div");
      div.className = "news-item";
      div.id = `news-item-${item.id}`;
      div.style.marginBottom = "15px";
      div.style.borderBottom = "1px dotted #333";
      div.style.paddingBottom = "10px";

      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px;">
          <span style="font-size: 0.8em; color: #888;" class="news-date-display"></span>
          ${isAdmin ? `
            <div style="font-size: 11px;">
              <button class="news-btn" data-id="${item.id}" data-action="edit">編集</button>
              <button class="news-btn" data-id="${item.id}" data-action="delete">削除</button>
            </div>
          ` : ''}
        </div>
        <p class="news-content-text" id="news-content-${item.id}" style="margin: 0; white-space: pre-wrap; line-height: 1.4;"></p>
        
        <div class="news-edit-form" id="news-edit-form-${item.id}" style="display: none; margin-top: 10px;">
          <textarea id="news-edit-input-${item.id}" style="width: 100%; height: 50px; background-color: #222; color: #00FF00; border: 1px solid #00FF00;"></textarea>
          <div style="margin-top: 5px;">
            <button class="news-btn" data-id="${item.id}" data-action="save">保存</button>
            <button class="news-btn" data-id="${item.id}" data-action="cancel">キャンセル</button>
          </div>
        </div>
      `;

      div.querySelector(".news-date-display").textContent = `[${dateStr}]`;
      div.querySelector(".news-content-text").textContent = item.content;

      listEl.appendChild(div);
    });
  } catch (err) {
    listEl.innerHTML = '<p style="color: #F00;">お知らせの読み込みに失敗しました。</p>';
  }
}

// イベント委譲によるお知らせ操作
function initNewsEvents() {
  const listEl = document.getElementById("news-list");
  if (!listEl) return;

  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".news-btn");
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === "edit") startEditNews(id);
    else if (action === "delete") deleteNews(id);
    else if (action === "save") saveEditNews(id);
    else if (action === "cancel") cancelEditNews(id);
  });
}

// 新規投稿機能の初期化
function initNewsPosting() {
  const postBtn = document.getElementById("news-post-btn");
  const inputEl = document.getElementById("news-new-input");
  if (!postBtn) return;

  postBtn.onclick = async () => {
    const content = inputEl.value;
    if (!content) return;
    if (!csrfToken) await fetchCsrfToken();

    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
          "X-Admin-Token": getAdminToken()
        },
        body: JSON.stringify({ content })
      });

      if (res.ok) {
        inputEl.value = "";
        fetchNews();
      } else {
        const data = await res.json();
        alert(data.error || "投稿に失敗しました。");
        await fetchCsrfToken();
      }
    } catch (err) {
      alert("通信エラーが発生しました。");
    }
  };
}

// 編集・削除関連のグローバル関数
window.startEditNews = (id) => {
  const textEl = document.getElementById(`news-content-${id}`);
  const formEl = document.getElementById(`news-edit-form-${id}`);
  const inputEl = document.getElementById(`news-edit-input-${id}`);
  inputEl.value = textEl.innerText;
  textEl.style.display = "none";
  formEl.style.display = "block";
};

window.cancelEditNews = (id) => {
  const textEl = document.getElementById(`news-content-${id}`);
  const formEl = document.getElementById(`news-edit-form-${id}`);
  textEl.style.display = "block";
  formEl.style.display = "none";
};

window.saveEditNews = async (id) => {
  const inputEl = document.getElementById(`news-edit-input-${id}`);
  const content = inputEl.value;
  if (!csrfToken) await fetchCsrfToken();

  try {
    const res = await fetch(`/api/news/${id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
        "X-Admin-Token": getAdminToken()
      },
      body: JSON.stringify({ content })
    });

    if (res.ok) {
      fetchNews();
    } else {
      const data = await res.json();
      alert(data.error || "更新に失敗しました。");
      await fetchCsrfToken();
    }
  } catch (err) {
    alert("エラーが発生しました。");
  }
};

window.deleteNews = async (id) => {
  if (!confirm("この記事を削除しますか？")) return;
  if (!csrfToken) await fetchCsrfToken();

  try {
    const res = await fetch(`/api/news/${id}`, {
      method: "DELETE",
      headers: { 
        "X-CSRF-Token": csrfToken,
        "X-Admin-Token": getAdminToken()
      }
    });

    if (res.ok) {
      fetchNews();
    } else {
      const data = await res.json();
      alert(data.error || "削除に失敗しました。");
      await fetchCsrfToken();
    }
  } catch (err) {
    alert("エラーが発生しました。");
  }
};

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

// ===== Web 拍手機能 =====
function initClapEvents() {
  const openBtn = document.getElementById("open-clap-modal");
  const closeBtn = document.getElementById("close-clap-modal");
  const sendBtn = document.getElementById("send-clap");
  const modal = document.getElementById("clap-modal");
  const overlay = document.getElementById("clap-overlay");
  const messageInput = document.getElementById("clap-message");

  if (!openBtn || !modal || !overlay) return;

  const openModal = () => {
    modal.style.display = "block";
    overlay.style.display = "block";
    messageInput.value = "";
    messageInput.focus();
  };

  const closeModal = () => {
    modal.style.display = "none";
    overlay.style.display = "none";
  };

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);

  sendBtn.addEventListener("click", async () => {
    const message = messageInput.value;
    const device_id = getDeviceId();

    try {
      const res = await fetch("/api/claps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, device_id })
      });

      if (res.ok) {
        alert("拍手を送信しました！ありがとうございます！");
        closeModal();
      } else {
        alert("送信に失敗しました。");
      }
    } catch (err) {
      alert("通信エラーが発生しました。");
    }
  });
}

// 管理者用拍手メッセージ表示
async function fetchAdminClaps() {
  const token = getAdminToken();
  if (!token) return;

  const mainContent = document.querySelector(".main_content");
  if (!mainContent) return;

  try {
    const res = await fetch("/api/admin/claps", {
      headers: { "X-Admin-Token": token }
    });
    if (!res.ok) return;

    const claps = await res.json();
    if (claps.length === 0) return;

    const clapSection = document.createElement("div");
    clapSection.style.marginTop = "30px";
    clapSection.style.border = "1px solid #00FF00";
    clapSection.style.padding = "10px";
    clapSection.innerHTML = `<h3 style="margin-top:0; color:#00FF00; border-bottom:1px solid #00FF00;">◆ 拍手メッセージ (最新100件)</h3>`;
    
    const list = document.createElement("div");
    list.style.maxHeight = "300px";
    list.style.overflowY = "auto";
    list.style.fontSize = "12px";

    claps.forEach(c => {
      if (!c.message) return;
      const item = document.createElement("div");
      item.style.marginBottom = "8px";
      item.style.borderBottom = "1px solid #222";
      const dateStr = new Date(c.created_at.replace(" ", "T") + "Z").toLocaleString("ja-JP");
      item.innerHTML = `
        <span style="color:#888;">[${dateStr}]</span> 
        <span style="color:#00FF00;">${c.message}</span>
      `;
      list.appendChild(item);
    });

    clapSection.appendChild(list);
    mainContent.appendChild(clapSection);
  } catch (err) {
    console.error("Clap fetch error:", err);
  }
}

// ページ読み込み完了時に実行
document.addEventListener('DOMContentLoaded', async () => {
  await fetchCsrfToken(); // 最初にトークンを取得
  updateAdminUI();
  updateCounter();
  fetchNews();
  initNewsPosting();
  initNewsEvents(); // イベントリスナーの設定
  initClapEvents();
  fetchAdminClaps();
});

// 万が一 DOMContentLoaded が発火済みのケースに対応
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  updateAdminUI();
}

// グローバルに公開
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
