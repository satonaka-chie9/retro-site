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

async function fetchBans() {
  const token = getAdminToken();
  if (!token) {
    alert("管理者としてログインしてください");
    location.href = "index.html";
    return;
  }

  const listEl = document.getElementById("ban-list");
  try {
    const res = await fetch("/api/admin/restrictions", {
      headers: { "X-Admin-Token": token }
    });
    if (!res.ok) throw new Error("Fetch failed");
    const bans = await res.json();
    
    if (bans.length === 0) {
      listEl.innerHTML = '<tr><td colspan="4">制限中のIPはありません。</td></tr>';
      return;
    }

    listEl.innerHTML = "";
    bans.forEach(b => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${b.ip}</td>
        <td>${b.reason || "-"}</td>
        <td>${formatDate(b.created_at)}</td>
        <td><button class="unban-btn" data-id="${b.id}">解除</button></td>
      `;
      listEl.appendChild(tr);
    });

    document.querySelectorAll(".unban-btn").forEach(btn => {
      btn.onclick = () => unbanIP(btn.dataset.id);
    });

  } catch (err) {
    listEl.innerHTML = '<tr><td colspan="4" style="color:red;">データの取得に失敗しました。</td></tr>';
  }
}

async function addBan() {
  const ip = document.getElementById("ban-ip").value;
  const reason = document.getElementById("ban-reason").value;
  const token = getAdminToken();

  if (!ip) return alert("IPアドレスを入力してください");
  if (!csrfToken) await fetchCsrfToken();

  try {
    const res = await fetch("/api/admin/restrictions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Admin-Token": token,
        "X-CSRF-Token": csrfToken
      },
      body: JSON.stringify({ ip, reason })
    });

    const data = await res.json();
    if (res.ok) {
      alert("IP制限を追加しました");
      document.getElementById("ban-ip").value = "";
      document.getElementById("ban-reason").value = "";
      fetchBans();
    } else {
      alert(data.error || "追加に失敗しました");
      await fetchCsrfToken();
    }
  } catch (err) {
    alert("エラーが発生しました");
  }
}

async function unbanIP(id) {
  if (!confirm("このIP制限を解除しますか？")) return;
  const token = getAdminToken();
  if (!csrfToken) await fetchCsrfToken();

  try {
    const res = await fetch(`/api/admin/restrictions/${id}`, {
      method: "DELETE",
      headers: { 
        "X-Admin-Token": token,
        "X-CSRF-Token": csrfToken
      }
    });

    if (res.ok) {
      fetchBans();
    } else {
      const data = await res.json();
      alert(data.error || "解除に失敗しました");
      await fetchCsrfToken();
    }
  } catch (err) {
    alert("エラーが発生しました");
  }
}

function adminLogout() {
  localStorage.removeItem("admin_token");
  alert("ログアウトしました。");
  location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", async () => {
  await fetchCsrfToken();
  fetchBans();
  const addBtn = document.getElementById("add-ban-btn");
  if (addBtn) addBtn.onclick = addBan;
  const logoutBtn = document.getElementById("admin-logout-btn");
  if (logoutBtn) logoutBtn.onclick = adminLogout;
});
