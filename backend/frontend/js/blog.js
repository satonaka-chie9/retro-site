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

function getAdminToken() {
  const token = localStorage.getItem("admin_token");
  return (token && token !== "undefined") ? token : "";
}

// 管理者ログイン (既存のものを流用)
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
      setTimeout(() => location.reload(), 500);
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
  location.reload();
}

function updateAdminUI() {
  const token = getAdminToken();
  const loginArea = document.getElementById("admin-login-area");
  const logoutArea = document.getElementById("admin-logout-area");
  const loginBtn = document.getElementById("admin-login-btn");
  const logoutBtn = document.getElementById("admin-logout-btn");
  const blogFormArea = document.getElementById("blog_post_form");

  if (token) {
    if (loginArea) loginArea.style.display = "none";
    if (logoutArea) logoutArea.style.display = "block";
    if (blogFormArea) blogFormArea.style.display = "block";
    if (logoutBtn) {
      logoutBtn.onclick = adminLogout;
    }
  } else {
    if (loginArea) loginArea.style.display = "block";
    if (logoutArea) logoutArea.style.display = "none";
    if (blogFormArea) blogFormArea.style.display = "none";
    if (loginBtn) {
      loginBtn.onclick = adminLogin;
    }
  }
}

async function loadBlogs() {
  const container = document.getElementById("blog_container");
  try {
    const res = await fetch("/api/blog");
    const blogs = await res.json();
    
    if (blogs.length === 0) {
      container.innerHTML = "<p>まだ記事がありません。</p>";
      return;
    }

    const isAdmin = getAdminToken().length > 0;

    container.innerHTML = blogs.map(blog => `
      <div class="post" style="margin-bottom: 30px; border-bottom: 1px dashed #666; padding-bottom: 10px;">
        <div class="post_header" style="font-size: 1.2em; font-weight: bold; color: #00FF00;">
          ${blog.title} 
          <span style="font-size: 0.7em; color: #ccc; font-weight: normal;"> - ${formatDate(blog.created_at)}</span>
        </div>
        <div class="post_body">
          ${blog.image_url ? `<img src="${blog.image_url}" style="max-width: 100%; margin: 10px 0; border: 1px solid #333;">` : ""}
          <p style="white-space: pre-wrap;">${blog.content}</p>
        </div>
        ${isAdmin ? `
          <div style="margin-top: 10px;">
            <button class="blog-delete-btn" data-id="${blog.id}" style="font-size: 10px;">削除</button>
          </div>
        ` : ""}
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = "<p>記事の読み込みに失敗しました。</p>";
  }
}

// イベント委譲によるブログ操作
function initBlogEvents() {
  const container = document.getElementById("blog_container");
  if (!container) return;

  container.addEventListener("click", (e) => {
    if (e.target.classList.contains("blog-delete-btn")) {
      const id = e.target.dataset.id;
      deleteBlog(id);
    }
  });
}

async function deleteBlog(id) {
  if (!confirm("本当にこの記事を削除しますか？")) return;
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

function formatDate(dateStr) {
  const date = new Date(dateStr.replace(" ", "T") + "Z");
  return date.toLocaleString("ja-JP");
}

const blogForm = document.getElementById("blogForm");
if (blogForm) {
  blogForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!csrfToken) await fetchCsrfToken();

    const formData = new FormData(blogForm);
    // 管理者トークンも追加
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

async function updateCounter() {
  const device_id = localStorage.getItem("device_id") || "guest";
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
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await fetchCsrfToken();
  updateAdminUI();
  updateCounter();
  loadBlogs();
  initBlogEvents();
});
