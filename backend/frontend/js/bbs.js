const API_BASE = "";

// デバイスIDをローカルストレージに保存して管理する関数。初回アクセス時にUUIDを生成し、以降は同じIDを使用します。
//これにより、ユーザーが同じブラウザから投稿した内容を識別できるようになり、各ユーザーが自分の投稿を編集・削除できるようになります。
function getDeviceId() {
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
}

// 管理者トークンをローカルストレージから取得する関数。トークンが存在しない場合は空文字を返します。
function getAdminToken() {
  const token = localStorage.getItem("admin_token");
  return (token && token !== "undefined") ? token : "";
}

// 管理者トークンをローカルストレージに保存する関数。ログイン成功時に呼び出されます。
//これにより、管理者はログイン状態を維持でき、ページをリロードしても再度ログインする必要がなくなります。
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
  // 無効な日付の場合のフォールバック
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

let selectedThreadId = null;
let selectedThreadTitle = "";

// 管理者用の統計と拍手メッセージを取得して表示する関数。ここでは、APIから統計情報を取得し、HTMLに整形して表示します。
async function loadThreads() {
  const res = await fetch(API_BASE + "/api/threads");
  const data = await res.json();

  const threadsList = document.getElementById("threads_list");
  if (!threadsList) return;
  threadsList.innerHTML = "";

  if (data.length === 0) {
    threadsList.innerHTML = "<p>スレッドがありません。</p>";
    return;
  }

  const adminToken = getAdminToken();
  const currentDeviceId = getDeviceId();
  const isAdmin = adminToken.length > 0;

  data.forEach(thread => {
    const div = document.createElement("div");
    div.className = "thread_item";
    div.style.margin = "10px 0";
    div.style.padding = "5px";
    div.style.borderBottom = "1px dotted #888";

    const created = formatDate(thread.created_at);
    const isOwner = thread.device_id === currentDeviceId;

    div.innerHTML = `
      <a href="#" class="thread_link" data-id="${thread.id}" data-title="${thread.title}">${thread.title}</a>
      <span style="font-size: 0.8em; color: #666; margin-left: 10px;">(${created})</span>
      ${(isOwner || isAdmin) ? `<button class="delete-thread-btn" data-id="${thread.id}" style="font-size: 0.7em; margin-left: 5px;">削除</button>` : ""}
    `;

    div.querySelector(".thread_link").addEventListener("click", (e) => {
      e.preventDefault();
      selectThread(thread.id, thread.title);
    });

    div.querySelector(".delete-thread-btn")?.addEventListener("click", async () => {
      if (confirm("このスレッドと内のすべての投稿を削除しますか？")) {
        await deleteThread(thread.id);
      }
    });

    threadsList.appendChild(div);
  });
}

function selectThread(id, title) {
  selectedThreadId = id;
  selectedThreadTitle = title;
  
  document.getElementById("thread_list_container").classList.add("hidden");
  document.getElementById("thread_view").classList.remove("hidden");
  document.getElementById("current_thread_title").textContent = title;
  
  loadPosts();
}

function showThreadList() {
  selectedThreadId = null;
  selectedThreadTitle = "";
  
  document.getElementById("thread_list_container").classList.remove("hidden");
  document.getElementById("thread_view").classList.add("hidden");
  
  loadThreads();
}

async function deleteThread(id) {
  let token = window.csrfToken;
  if (!token && typeof window.getSharedCsrfToken === "function") {
    token = await window.getSharedCsrfToken();
  }

  const res = await fetch(API_BASE + "/api/threads/" + id, {
    method: "DELETE",
    headers: { 
      "Content-Type": "application/json",
      "X-Admin-Token": getAdminToken(),
      "X-CSRF-Token": token
    },
    body: JSON.stringify({
      device_id: getDeviceId()
    })
  });

  if (res.ok) {
    loadThreads();
  } else {
    const data = await res.json();
    alert(data.error || "スレッドの削除に失敗しました。");
  }
}

// 管理者用の統計と拍手メッセージを取得して表示する関数。ここでは、APIから統計情報を取得し、HTMLに整形して表示します。
async function loadPosts() {
  if (selectedThreadId === null) return;

  const res = await fetch(API_BASE + "/api/posts?thread_id=" + selectedThreadId);
  const data = await res.json();


  // 取得した投稿データをループしてHTML要素を生成し、ページに表示します。各投稿には編集・削除ボタンがあり、ユーザーは自分の投稿を管理できます。
  const container = document.getElementById("posts_container");
  if (!container) return;
  container.innerHTML = "";

  // 管理者トークンとデバイスIDを取得して、現在のユーザーが管理者かどうかを判断します。
  const adminToken = getAdminToken();
  const currentDeviceId = getDeviceId();
  const isAdmin = adminToken.length > 0;

  // 取得した投稿データをループしてHTML要素を生成し、ページに表示します。各投稿には編集・削除ボタンがあり、ユーザーは自分の投稿を管理できます。
  data.forEach(post => {
    const div = document.createElement("div");
    div.className = "post";


    // 日付のフォーマットと編集マークの表示
    const created = formatDate(post.created_at);
    let editedMark = "";
    if (post.updated_at) {
      editedMark = `（編集済: ${formatDate(post.updated_at)}）`;
    }

    // 投稿の所有者か管理者であれば編集・削除ボタンを表示するためのフラグを設定します。これにより、ユーザーは自分の投稿を編集・削除でき、管理者はすべての投稿を管理できます。
    const isOwner = post.device_id === currentDeviceId;
    
    // 投稿のHTML構造を定義します。投稿のID、名前、内容、作成日時、編集日時などを表示し、必要に応じて編集・削除ボタンを追加します。
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
    

    // 投稿の内容をHTML要素にセットします。これには、投稿のID、名前、作成日時、編集マーク、内容などが含まれます。
    div.querySelector(".post-id").textContent = post.id;
    div.querySelector(".post-name").textContent = post.name;
    div.querySelector(".post-date").textContent = created;
    div.querySelector(".post-edited").textContent = editedMark;
    div.querySelector(".post_body").textContent = post.content;
    
    // 編集・削除ボタンのイベントリスナーを設定します。編集ボタンをクリックすると、投稿内容を編集するためのフォームが表示され、削除ボタンをクリックすると、削除確認のダイアログが表示されます。
    const editBtn = div.querySelector(".edit-btn");
    const delBtn = div.querySelector(".delete-btn");
    const editArea = div.querySelector(".edit-form-area");
    const delArea = div.querySelector(".delete-confirm-area");
    const contentArea = div.querySelector(".post_content_area");
    const footerArea = div.querySelector(".post_footer");
    
    // 編集ボタンのイベントリスナーを設定します。クリックすると、投稿内容を編集するためのフォームが表示され、元の内容エリアとフッターが非表示になります。
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        const textarea = div.querySelector(".edit-textarea");
        textarea.value = post.content;
        editArea.classList.remove("hidden");
        contentArea.classList.add("hidden");
        footerArea.classList.add("hidden");
      });
    }

    // 保存ボタンのイベントリスナーを設定します。クリックすると、編集内容がサーバーに送信され、投稿が更新されます。
    div.querySelector(".save-edit-btn")?.addEventListener("click", async () => {
      const newContent = div.querySelector(".edit-textarea").value;
      await performEditPost(post.id, post.name, newContent);
    });

    // キャンセルボタンのイベントリスナーを設定します。クリックすると、編集フォームが非表示になり、元の内容エリアとフッターが再表示されます。
    div.querySelector(".cancel-edit-btn")?.addEventListener("click", () => {
      editArea.classList.add("hidden");
      contentArea.classList.remove("hidden");
      footerArea.classList.remove("hidden");
    });

    // 削除ボタンのイベントリスナーを設定します。クリックすると、削除確認のダイアログが表示され、元の内容エリアとフッターが非表示になります。
    if (delBtn) {
      delBtn.addEventListener("click", () => {
        delArea.classList.remove("hidden");
        footerArea.classList.add("hidden");
      });
    }

    // 削除確認の「はい」ボタンのイベントリスナーを設定します。クリックすると、投稿がサーバーから削除されます。
    div.querySelector(".confirm-delete-btn")?.addEventListener("click", async () => {
      await performDeletePost(post.id);
    });

    // 削除確認の「いいえ」ボタンのイベントリスナーを設定します。クリックすると、削除確認ダイアログが非表示になり、元の内容エリアとフッターが再表示されます。
    div.querySelector(".cancel-delete-btn")?.addEventListener("click", () => {
      delArea.classList.add("hidden");
      footerArea.classList.remove("hidden");
    });

    container.appendChild(div);
  });
}

// ユーザー名をローカルストレージから復元して入力欄にセットする関数。これにより、ユーザーは前回使用した名前を再利用できます。
function restoreUserName() {
  const savedName = localStorage.getItem("bbs_user_name");
  if (savedName) {
    const nameInput = document.getElementById("name");
    if (nameInput) {
      nameInput.value = savedName;
    }
  }
}

// 管理者トークンをローカルストレージに保存する関数。ログイン成功時に呼び出されます。これにより、管理者はログイン状態を維持でき、ページをリロードしても再度ログインする必要がなくなります。
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

    // 投稿内容をサーバーに送信する関数。成功した場合は投稿一覧を更新し、失敗した場合はエラーメッセージを表示します。
    const res = await fetch(API_BASE + "/api/posts", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-CSRF-Token": token
      },
      body: JSON.stringify({
        name,
        content,
        thread_id: selectedThreadId,
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

const threadForm = document.getElementById("threadForm");
if (threadForm) {
  threadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById("thread_title");
    const title = titleInput.value;

    let token = window.csrfToken;
    if (!token && typeof window.getSharedCsrfToken === "function") {
      token = await window.getSharedCsrfToken();
    }

    const res = await fetch(API_BASE + "/api/threads", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-CSRF-Token": token
      },
      body: JSON.stringify({
        title,
        device_id: getDeviceId()
      })
    });

    if (res.ok) {
      const resultData = await res.json();
      titleInput.value = "";
      selectThread(resultData.id, title);
    } else {
      const errorData = await res.json();
      alert(errorData.error || "スレッドの作成に失敗しました。");
    }
  });
}

document.getElementById("back_to_threads")?.addEventListener("click", showThreadList);

// 実際の編集処理
async function performEditPost(id, currentName, newContent) {
  if (!newContent) return;
  
  // sidebar.jsが取得したトークンを使用。なければ取得を待つ。
  let token = window.csrfToken;
  if (!token && typeof window.getSharedCsrfToken === "function") {
    token = await window.getSharedCsrfToken();
  }

  // 編集内容をサーバーに送信する関数。成功した場合は投稿一覧を更新し、失敗した場合はエラーメッセージを表示します。
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

  // 削除内容をサーバーに送信する関数。成功した場合は投稿一覧を更新し、失敗した場合はエラーメッセージを表示します。
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
  socket.on("thread_update", () => {
    loadThreads();
  });
}

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  loadThreads();
  restoreUserName();
});
