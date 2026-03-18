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

function getDeviceId() {
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
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

    const isAdmin = getAdminToken().length > 0;
    const blogFormArea = document.getElementById("blog_post_form");
    if (isAdmin && blogFormArea) blogFormArea.classList.remove("hidden");

    container.innerHTML = "";
    blogs.forEach(blog => {
      const div = document.createElement("div");
      div.className = "post";
      div.style.marginBottom = "30px";
      div.style.borderBottom = "1px dashed #666";
      div.style.paddingBottom = "10px";

      div.innerHTML = `
        <div class="post_header" style="font-size: 1.2em; font-weight: bold; color: #00FF00;">
          <span class="blog-title"></span>
          <span class="blog-date" style="font-size: 0.7em; color: #ccc; font-weight: normal;"></span>
        </div>
        <div class="post_body">
          <div class="blog-image-container"></div>
          <p class="blog-content" style="white-space: pre-wrap;"></p>
        </div>
        ${isAdmin ? `
          <div style="margin-top: 10px;">
            <button class="blog-delete-btn" data-id="${blog.id}" style="font-size: 10px;">削除</button>
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

      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = "<p>記事の読み込みに失敗しました。</p>";
  }
}

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
  initBlogEvents();
});
