let csrfToken = "";

// CSRFトークンをサーバーから取得して保存する関数。APIエンドポイントからCSRFトークンを取得し、グローバル変数に保存します。これにより、後続のAPIリクエストでCSRFトークンを使用してセキュリティを確保できます。
async function fetchCsrfToken() {
  try {
    const res = await fetch("/api/csrf-token");
    const data = await res.json();
    csrfToken = data.csrfToken;
  } catch (err) {
    console.error("Failed to fetch CSRF token:", err);
  }
}

// 描画内容をサーバーに送信する関数。これにより、他のユーザーの画面にもリアルタイムで描画内容が反映されます。描画ツールがペンや消しゴムの場合は、描画の開始点と終了点、色、サイズなどの情報をサーバーに送信します。塗りつぶしツールの場合は、クリックした位置と塗りつぶす色の情報をサーバーに送信します。
function getAdminToken() {
  const token = localStorage.getItem("admin_token");
  return (token && token !== "undefined") ? token : "";
}

// デバイスIDをローカルストレージに保存して取得する関数。これにより、同じブラウザからの投稿を識別できます。
function getDeviceId() {
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
}

// 日付を日本時間で「YYYY/MM/DD HH:mm:ss」形式に整形する関数。デフォルトだと日本でもUTCで表示されるため、明示的に日本時間でフォーマットします。
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

// ブログ記事をAPIから取得して表示する関数。APIエンドポイントからブログ記事のリストを取得し、HTMLに整形して表示します。管理者の場合は、記事の編集や削除のオプションも表示されます。
async function loadBlogs() {
  const container = document.getElementById("blog_container");
  if (!container) return;
  try {
    const res = await fetch("/api/blog");
    const blogs = await res.json();
    
    if (blogs.length === 0) {
      container.innerHTML = "<p>まだ記事がありません。</p>";
      return;
    }

    // 管理者かどうかを判定し、管理者の場合は記事の投稿フォームを表示します。これにより、管理者は新しい記事を投稿できるようになります。
    const isAdmin = getAdminToken().length > 0;
    const blogFormArea = document.getElementById("blog_post_form");
    if (isAdmin && blogFormArea) blogFormArea.classList.remove("hidden");

    // 取得したブログ記事をHTMLに整形して表示します。記事のタイトル、作成日時、内容、画像などを表示し、管理者の場合は編集や削除のオプションも表示します。
    container.innerHTML = "";
    blogs.forEach(blog => {
      const div = document.createElement("div");
      div.className = "post";
      div.style.marginBottom = "30px";
      div.style.borderBottom = "1px dashed #666";
      div.style.paddingBottom = "10px";

      // ブログ記事の内容をHTMLに整形して表示する部分。記事のタイトル、作成日時、内容、画像などを表示します。管理者の場合は編集や削除のオプションも表示します。
      div.innerHTML = `
        <div class="post_header" style="font-size: 1.2em; font-weight: bold; color: #00FF00;">
          <span class="blog-title"></span>
          <span class="blog-date" style="font-size: 0.7em; color: #ccc; font-weight: normal;"></span>
        </div>
        <div class="post_body blog-content-area">
          <div class="blog-image-container"></div>
          <p class="blog-content" style="white-space: pre-wrap;"></p>
        </div>

        <!-- インライン編集フォーム -->
        <div class="inline-form hidden blog-edit-area">
          <p style="margin: 0 0 5px 0; font-size: 11px;">記事の編集：</p>
          <div>タイトル：<input type="text" class="edit-blog-title" style="width: 80%;"></div>
          <div style="margin-top: 5px;">本文：<br>
            <textarea class="edit-blog-content" style="width: 95%; height: 150px;"></textarea>
          </div>
          <div style="margin-top: 5px;">
            <button class="save-blog-btn">保存</button>
            <button class="cancel-blog-btn">キャンセル</button>
          </div>
        </div>

        <!-- インライン削除確認 -->
        <div class="inline-confirm hidden blog-delete-confirm-area">
          <span class="confirm-msg">この記事を削除しますか？</span>
          <button class="confirm-delete-btn">はい、削除します</button>
          <button class="cancel-delete-btn">いいえ</button>
        </div>

        ${isAdmin ? `
          <div class="blog-footer" style="margin-top: 10px;">
            <button class="blog-edit-btn" style="font-size: 10px;">編集</button>
            <button class="blog-delete-btn" style="font-size: 10px;">削除</button>
          </div>
        ` : ""}
      `;

      div.querySelector(".blog-title").textContent = blog.title;
      div.querySelector(".blog-date").textContent = ` - ${formatDate(blog.created_at)}`;
      div.querySelector(".blog-content").textContent = blog.content;

      if (blog.image_url) {
        const img = document.createElement("img");
        img.src = blog.image_url;
        img.style.maxWidth = "100%";
        img.style.margin = "10px 0";
        img.style.border = "1px solid #333";
        div.querySelector(".blog-image-container").appendChild(img);
      }

      // イベントリスナーの設置
      if (isAdmin) {
        const editArea = div.querySelector(".blog-edit-area");
        const deleteArea = div.querySelector(".blog-delete-confirm-area");
        const contentArea = div.querySelector(".blog-content-area");
        const footerArea = div.querySelector(".blog-footer");

        div.querySelector(".blog-edit-btn").onclick = () => {
          div.querySelector(".edit-blog-title").value = blog.title;
          div.querySelector(".edit-blog-content").value = blog.content;
          editArea.classList.remove("hidden");
          contentArea.classList.add("hidden");
          footerArea.classList.add("hidden");
        };

        div.querySelector(".save-blog-btn").onclick = () => {
          const title = div.querySelector(".edit-blog-title").value;
          const content = div.querySelector(".edit-blog-content").value;
          saveEditBlog(blog.id, title, content);
        };

        div.querySelector(".cancel-blog-btn").onclick = () => {
          editArea.classList.add("hidden");
          contentArea.classList.remove("hidden");
          footerArea.classList.remove("hidden");
        };

        div.querySelector(".blog-delete-btn").onclick = () => {
          deleteArea.classList.remove("hidden");
          footerArea.classList.add("hidden");
        };

        div.querySelector(".confirm-delete-btn").onclick = () => {
          performDeleteBlog(blog.id);
        };

        div.querySelector(".cancel-delete-btn").onclick = () => {
          deleteArea.classList.add("hidden");
          footerArea.classList.remove("hidden");
        };
      }

      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = "<p>記事の読み込みに失敗しました。</p>";
  }
}

async function saveEditBlog(id, title, content) {
  if (!csrfToken) await fetchCsrfToken();
  try {
    const res = await fetch(`/api/blog/${id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "X-Admin-Token": getAdminToken(),
        "X-CSRF-Token": csrfToken
      },
      body: JSON.stringify({ title, content })
    });
    if (res.ok) {
      loadBlogs();
    } else {
      const data = await res.json();
      alert(data.error || "更新に失敗しました");
      await fetchCsrfToken();
    }
  } catch (err) {
    alert("エラーが発生しました");
  }
}

async function performDeleteBlog(id) {
  if (!csrfToken) await fetchCsrfToken();
  try {
    const res = await fetch(`/api/blog/${id}`, {
      method: "DELETE",
      headers: { 
        "X-Admin-Token": getAdminToken(),
        "X-CSRF-Token": csrfToken
      }
    });
    if (res.ok) {
      loadBlogs();
    } else {
      const data = await res.json();
      alert(data.error || "削除に失敗しました");
      await fetchCsrfToken();
    }
  } catch (err) {
    alert("エラーが発生しました");
  }
}

const blogForm = document.getElementById("blogForm");
const blogImageInput = document.getElementById("blog_image");
const fileNameDisplay = document.getElementById("file_name_display");

if (blogImageInput && fileNameDisplay) {
  blogImageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    fileNameDisplay.innerText = file ? file.name : "選択されていません";
  });
}

if (blogForm) {
  blogForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!csrfToken) await fetchCsrfToken();
    const formData = new FormData(blogForm);
    formData.append("admin_token", getAdminToken());
    try {
      const res = await fetch("/api/blog", {
        method: "POST",
        headers: { 
          "X-CSRF-Token": csrfToken,
          "X-Admin-Token": getAdminToken()
        },
        body: formData
      });
      if (res.ok) {
        blogForm.reset();
        if (fileNameDisplay) fileNameDisplay.innerText = "選択されていません";
        loadBlogs();
      } else {
        const data = await res.json();
        alert(data.error || "投稿に失敗しました");
        await fetchCsrfToken();
      }
    } catch (err) {
      alert("通信エラーが発生しました");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await fetchCsrfToken();
  loadBlogs();
});
