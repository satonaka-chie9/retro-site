const API_BASE = "http://localhost:3000";

async function loadPosts() {
  const res = await fetch(API_BASE + "/api/posts");
  const data = await res.json();

  const container = document.getElementById("posts_container");
  container.innerHTML = "";

  data.forEach(post => {
    const div = document.createElement("div");
    div.className = "post";

    div.innerHTML = `
      <div class="post_header">
        No.${post.id} ${post.name} 
        ${new Date(post.created_at).toLocaleString("ja-JP", {
            timeZone: "Asia/Tokyo"
        })}
      </div>
      <pre class="post_body">${post.content}</pre>
    `;

    container.appendChild(div);
  });
}

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