function getAdminToken() {
  const token = localStorage.getItem("admin_token");
  return (token && token !== "undefined") ? token : "";
}

async function fetchStats() {
  const token = getAdminToken();
  if (!token) {
    alert("管理者としてログインしてください");
    location.href = "index.html";
    return;
  }

  const statsArea = document.getElementById("stats-area");
  try {
    const res = await fetch("/api/admin/claps/stats", {
      headers: { "X-Admin-Token": token }
    });
    if (!res.ok) throw new Error("Stats fetch failed");
    const data = await res.json();
    statsArea.innerHTML = `累計拍手： <span style="font-weight:bold; color:#00FF00;">${data.total}</span> パチ`;
  } catch (err) {
    statsArea.innerHTML = "統計の取得に失敗しました。";
  }
}

async function fetchClaps() {
  const token = getAdminToken();
  const listEl = document.getElementById("claps-list");
  
  try {
    const res = await fetch("/api/admin/claps", {
      headers: { "X-Admin-Token": token }
    });
    if (!res.ok) throw new Error("Claps fetch failed");
    
    const claps = await res.json();
    if (claps.length === 0) {
      listEl.innerHTML = "<p>メッセージはありません。</p>";
      return;
    }

    listEl.innerHTML = "";
    claps.forEach(c => {
      // メッセージがない拍手は無視するか、表示するかお好みで。ここではメッセージありのみを表示。
      if (!c.message) return;

      const dateStr = new Date(c.created_at.replace(" ", "T") + "Z").toLocaleString("ja-JP");
      const div = document.createElement("div");
      div.className = "clap-msg-item";
      div.innerHTML = `
        <div class="clap-date">[${dateStr}] IP: ${c.ip || "unknown"}</div>
        <div class="clap-content"></div>
      `;
      div.querySelector(".clap-content").textContent = c.message;
      listEl.appendChild(div);
    });

    if (listEl.innerHTML === "") {
        listEl.innerHTML = "<p>メッセージ付きの拍手はありません。</p>";
    }
  } catch (err) {
    listEl.innerHTML = "<p style='color:red;'>メッセージの取得に失敗しました。</p>";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  fetchStats();
  fetchClaps();
});
