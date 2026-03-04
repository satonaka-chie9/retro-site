const API_BASE = "http://localhost:3000";

async function loadPosts() {
  const res = await fetch(API_BASE + "/api/posts");
  const data = await res.json();

  const container = document.getElementById("posts_container");
  container.innerHTML = "";

 data.forEach(post => {
  const div = document.createElement("div");
  div.className = "post";

  const created = new Date(post.created_at).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo"
  });

  let editedMark = "";

  if (post.updated_at) {
    editedMark = "（編集済）";
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

  // ★ これが必要
  div.querySelector(".edit-btn").addEventListener("click", () => {
    editPost(post.id, post.content);
  });

  div.querySelector(".delete-btn").addEventListener("click", () => {
    deletePost(post.id);
  });

  container.appendChild(div);
}); // ← forEach閉じる
} // ← loadPosts閉じる

document.getElementById("postForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value;
  const content = document.getElementById("message").value;

  await fetch(API_BASE + "/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, content })
  });

  document.getElementById("message").value = "";
  loadPosts();
});

loadPosts();

async function editPost(id, currentContent) {
  const newContent = prompt("内容を編集", currentContent);
  if (!newContent) return;

  await fetch(API_BASE + "/api/posts/" + id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "名無しさん",
      content: newContent
    })
  });

  loadPosts();
}

async function deletePost(id) {
  if (!confirm("本当に削除しますか？")) return;

  await fetch(API_BASE + "/api/posts/" + id, {
    method: "DELETE"
  });

  loadPosts();
}


//ページアクセス時にカウンタを増やす
async function updateCounter() {
  await fetch(API_BASE + "/api/counter/increment", {
    method: "POST"
  });

  const res = await fetch(API_BASE + "/api/counter");
  const data = await res.json();

  document.getElementById("counter").textContent = String(data.count).padStart(6, "0");
}

updateCounter();