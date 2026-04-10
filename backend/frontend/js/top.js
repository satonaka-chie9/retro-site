// 共通のCSRFトークンを使用
async function fetchCsrfToken() {
  if (window.getSharedCsrfToken) {
    return await window.getSharedCsrfToken();
  }
  return "";
}
// トップページのJavaScript。お知らせや近況の表示、管理者用の投稿機能などを担当します。
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

// お知らせをAPIから取得して表示する関数。APIエンドポイントからお知らせのリストを取得し、HTMLに整形して表示します。管理者の場合は、編集や削除のオプションも表示されます。
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

    // 管理者かどうかを判定するためのフラグ。管理者の場合は、編集や削除のオプションを表示します。
    const isAdmin = (localStorage.getItem("admin_token") || "").length > 0;

    listEl.innerHTML = "";
    newsItems.forEach(item => {
      const dateVal = item.created_at || item.updated_at;
      const dateStr = formatDate(dateVal);
      
      // お知らせアイテムのHTML構造を作成します。管理者の場合は、編集と削除のボタンも表示されます。編集フォームと削除確認も同じ構造内に用意しておき、必要に応じて表示・非表示を切り替えます。
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
            <div style="font-size: 11px;" class="news-controls-${item.id}">
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

        <!-- インライン削除確認 -->
        <div class="inline-confirm hidden" id="news-delete-confirm-${item.id}">
          <span class="confirm-msg">この記事を削除しますか？</span>
          <button class="news-btn" data-id="${item.id}" data-action="confirm-delete">はい</button>
          <button class="news-btn" data-id="${item.id}" data-action="cancel-delete">いいえ</button>
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
    else if (action === "delete") showDeleteNewsConfirm(id);
    else if (action === "confirm-delete") performDeleteNews(id);
    else if (action === "cancel-delete") hideDeleteNewsConfirm(id);
    else if (action === "save") saveEditNews(id);
    else if (action === "cancel") cancelEditNews(id);
  });
}

// 新規投稿機能の初期化
function initNewsPosting() {
  const postBtn = document.getElementById("news-post-btn");
  const inputEl = document.getElementById("news-new-input");
  if (!postBtn) return;

  const getAdminToken = () => localStorage.getItem("admin_token") || "";

  postBtn.onclick = async () => {
    const content = inputEl.value;
    if (!content) return;
    if (!window.csrfToken) await fetchCsrfToken();

    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": window.csrfToken,
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
  const controlsEl = document.querySelector(`.news-controls-${id}`);
  inputEl.value = textEl.innerText;
  textEl.style.display = "none";
  formEl.style.display = "block";
  if (controlsEl) controlsEl.style.display = "none";
};

window.cancelEditNews = (id) => {
  const textEl = document.getElementById(`news-content-${id}`);
  const formEl = document.getElementById(`news-edit-form-${id}`);
  const controlsEl = document.querySelector(`.news-controls-${id}`);
  textEl.style.display = "block";
  formEl.style.display = "none";
  if (controlsEl) controlsEl.style.display = "block";
};

window.saveEditNews = async (id) => {
  const inputEl = document.getElementById(`news-edit-input-${id}`);
  const content = inputEl.value;
  const adminToken = localStorage.getItem("admin_token") || "";
  if (!window.csrfToken) await fetchCsrfToken();

  try {
    const res = await fetch(`/api/news/${id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "X-CSRF-Token": window.csrfToken,
        "X-Admin-Token": adminToken
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

window.showDeleteNewsConfirm = (id) => {
  const confirmEl = document.getElementById(`news-delete-confirm-${id}`);
  const controlsEl = document.querySelector(`.news-controls-${id}`);
  confirmEl.classList.remove("hidden");
  if (controlsEl) controlsEl.style.display = "none";
};

window.hideDeleteNewsConfirm = (id) => {
  const confirmEl = document.getElementById(`news-delete-confirm-${id}`);
  const controlsEl = document.querySelector(`.news-controls-${id}`);
  confirmEl.classList.add("hidden");
  if (controlsEl) controlsEl.style.display = "block";
};

window.performDeleteNews = async (id) => {
  const adminToken = localStorage.getItem("admin_token") || "";
  if (!window.csrfToken) await fetchCsrfToken();

  try {
    const res = await fetch(`/api/news/${id}`, {
      method: "DELETE",
      headers: { 
        "X-CSRF-Token": window.csrfToken,
        "X-Admin-Token": adminToken
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

async function fetchStatuses() {
  const listEl = document.getElementById("status-list");
  if (!listEl) return;

  try {
    const res = await fetch("/api/statuses");
    const items = await res.json();
    
    if (items.length === 0) {
      listEl.innerHTML = '<p class="text-gray">近況はありません。</p>';
      return;
    }

    // 管理者かどうかを判定するためのフラグ。管理者の場合は、編集や削除のオプションを表示します。
    const isAdmin = (localStorage.getItem("admin_token") || "").length > 0;
    listEl.innerHTML = "";
    items.forEach(item => {
      const dateStr = formatDate(item.created_at);
      const div = document.createElement("div");
      div.className = "news-item";
      div.style.marginBottom = "10px";
      div.style.borderBottom = "1px dotted #333";
      div.style.paddingBottom = "5px";

      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-size: 0.8em; color: #888;">[${dateStr}]</span>
          ${isAdmin ? `
            <div id="status-controls-${item.id}" style="font-size: 10px;">
              <button onclick="startEditStatus(${item.id})" style="font-size: 10px;">編集</button>
              <button onclick="showDeleteStatusConfirm(${item.id})" style="font-size: 10px;">削除</button>
            </div>
          ` : ''}
        </div>
        <p id="status-content-${item.id}" style="margin: 5px 0; white-space: pre-wrap; font-size: 0.9em;"></p>
        
        <!-- インライン編集フォーム -->
        <div id="status-edit-form-${item.id}" class="inline-form hidden">
          <textarea id="status-edit-input-${item.id}" style="width: 100%; height: 40px; font-size: 0.9em;"></textarea>
          <div style="margin-top: 5px;">
            <button onclick="saveEditStatus(${item.id})" style="font-size: 10px;">保存</button>
            <button onclick="cancelEditStatus(${item.id})" style="font-size: 10px;">取消</button>
          </div>
        </div>

        <!-- インライン削除確認 -->
        <div id="status-delete-confirm-${item.id}" class="inline-confirm hidden">
          <span class="confirm-msg" style="font-size: 11px;">削除しますか？</span>
          <button onclick="performDeleteStatus(${item.id})" style="font-size: 10px;">はい</button>
          <button onclick="hideDeleteStatusConfirm(${item.id})" style="font-size: 10px;">いいえ</button>
        </div>
      `;
      div.querySelector("p").textContent = item.content;
      listEl.appendChild(div);
    });
  } catch (err) {
    listEl.innerHTML = '<p style="color: #F00;">近況の読み込みに失敗しました。</p>';
  }
}

// 近況投稿機能の初期化
function initStatusPosting() {
  const postBtn = document.getElementById("status-post-btn");
  const inputEl = document.getElementById("status-new-input");
  if (!postBtn) return;

  // 管理者トークンを取得する関数。管理者がログインしている場合はトークンを返す
  const getAdminToken = () => localStorage.getItem("admin_token") || "";

  postBtn.onclick = async () => {
    const content = inputEl.value;
    if (!content) return;
    if (!window.csrfToken) await fetchCsrfToken();

    try {
      const res = await fetch("/api/statuses", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": window.csrfToken,
          "X-Admin-Token": getAdminToken()
        },
        body: JSON.stringify({ content })
      });

      // APIからのレスポンスを処理し、成功した場合は入力フィールドをクリアして近況リストを再取得します。失敗した場合はエラーメッセージを表示し、CSRFトークンを再取得します。
      if (res.ok) {
        inputEl.value = "";
        fetchStatuses();
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

window.startEditStatus = (id) => {
  const textEl = document.getElementById(`status-content-${id}`);
  const formEl = document.getElementById(`status-edit-form-${id}`);
  const inputEl = document.getElementById(`status-edit-input-${id}`);
  const controlsEl = document.getElementById(`status-controls-${id}`);
  inputEl.value = textEl.innerText;
  textEl.style.display = "none";
  formEl.classList.remove("hidden");
  if (controlsEl) controlsEl.style.display = "none";
};

window.cancelEditStatus = (id) => {
  const textEl = document.getElementById(`status-content-${id}`);
  const formEl = document.getElementById(`status-edit-form-${id}`);
  const controlsEl = document.getElementById(`status-controls-${id}`);
  textEl.style.display = "block";
  formEl.classList.add("hidden");
  if (controlsEl) controlsEl.style.display = "block";
};

window.saveEditStatus = async (id) => {
  const inputEl = document.getElementById(`status-edit-input-${id}`);
  const content = inputEl.value;
  const adminToken = localStorage.getItem("admin_token") || "";
  if (!window.csrfToken) await fetchCsrfToken();

  try {
    const res = await fetch(`/api/statuses/${id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "X-CSRF-Token": window.csrfToken,
        "X-Admin-Token": adminToken
      },
      body: JSON.stringify({ content })
    });

    if (res.ok) {
      fetchStatuses();
    } else {
      const data = await res.json();
      alert(data.error || "更新に失敗しました。");
      await fetchCsrfToken();
    }
  } catch (err) {
    alert("エラーが発生しました。");
  }
};

window.showDeleteStatusConfirm = (id) => {
  const confirmEl = document.getElementById(`status-delete-confirm-${id}`);
  const controlsEl = document.getElementById(`status-controls-${id}`);
  confirmEl.classList.remove("hidden");
  if (controlsEl) controlsEl.style.display = "none";
};

window.hideDeleteStatusConfirm = (id) => {
  const confirmEl = document.getElementById(`status-delete-confirm-${id}`);
  const controlsEl = document.getElementById(`status-controls-${id}`);
  confirmEl.classList.add("hidden");
  if (controlsEl) controlsEl.style.display = "block";
};

window.performDeleteStatus = async (id) => {
  const adminToken = localStorage.getItem("admin_token") || "";
  if (!window.csrfToken) await fetchCsrfToken();

  try {
    const res = await fetch(`/api/statuses/${id}`, {
      method: "DELETE",
      headers: { 
        "X-CSRF-Token": window.csrfToken,
        "X-Admin-Token": adminToken
      }
    });

    if (res.ok) {
      fetchStatuses();
    } else {
      const data = await res.json();
      alert(data.error || "削除に失敗しました。");
      await fetchCsrfToken();
    }
  } catch (err) {
    alert("エラーが発生しました。");
  }
};

// 拍手メッセージ表示 (全ユーザー公開)
async function fetchPublicClaps() {
  const isTopPage = location.pathname === "/" || location.pathname.endsWith("/index.html");
  if (!isTopPage) return;

  const mainContent = document.querySelector(".main_content");
  if (!mainContent) return;

  try {
    const res = await fetch("/api/claps");
    if (!res.ok) return;

    const claps = await res.json();
    if (claps.length === 0) return;

    const clapSection = document.createElement("div");
    clapSection.className = "admin-clap-section";
    clapSection.innerHTML = `<h3>◆ 届いた拍手メッセージ</h3>`;
    
    const list = document.createElement("div");
    list.className = "admin-clap-list";

    claps.forEach(c => {
      const item = document.createElement("div");
      item.className = "admin-clap-item";
      const dateStr = formatDate(c.created_at);
      const msg = c.message || "";
      if (!msg) return;

      item.innerHTML = `
        <span class="date">[${dateStr}]</span> 
        <span class="msg"></span>
      `;
      item.querySelector(".msg").textContent = msg;
      list.appendChild(item);
    });

    if (list.children.length === 0) return;

    clapSection.appendChild(list);
    mainContent.appendChild(clapSection);
  } catch (err) {
    console.error("Clap fetch error:", err);
  }
}

// ページ読み込み完了時に実行
document.addEventListener('DOMContentLoaded', async () => {
  await fetchCsrfToken();
  
  // 管理者用投稿エリアの表示制御
  const adminToken = localStorage.getItem("admin_token");
  if (adminToken && adminToken !== "undefined") {
    const newsPostArea = document.getElementById("news-post-area");
    const statusPostArea = document.getElementById("status-post-area");
    if (newsPostArea) newsPostArea.style.display = "block";
    if (statusPostArea) statusPostArea.style.display = "block";
  }

  fetchNews();
  initNewsPosting();
  initNewsEvents();
  fetchStatuses();
  initStatusPosting();
  fetchPublicClaps();
});
