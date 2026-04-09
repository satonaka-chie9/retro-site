let csrfToken = "";

// CSRFトークンをサーバーから取得して保存する関数。APIエンドポイントからCSRFトークンを取得し、グローバル変数に保存します。
async function fetchCsrfToken() {
  try {
    const res = await fetch("/api/csrf-token");
    const data = await res.json();
    csrfToken = data.csrfToken;
  } catch (err) {
    console.error("Failed to fetch CSRF token:", err);
  }
}

// 管理者用の統計情報を取得して表示する関数。ここでは、APIから統計情報を取得し、HTMLに整形して表示します。
function getAdminToken() {
  const token = localStorage.getItem("admin_token");
  return (token && token !== "undefined") ? token : "";
}

// 管理者用の統計情報を取得して表示する関数。ここでは、APIから統計情報を取得し、HTMLに整形して表示します。
function formatDate(dateInput) {
  if (!dateInput) return "";
  let date;
  if (dateInput instanceof Date) date = dateInput;
  else if (typeof dateInput === "string") {
    if (dateInput.includes("T") || dateInput.includes("Z")) date = new Date(dateInput);
    else date = new Date(dateInput.replace(" ", "T") + "Z");
  } else date = new Date(dateInput);
  if (isNaN(date.getTime())) return "日付不明"; // 無効な日付の場合のフォールバック
  // 日本時間でのフォーマット
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

// 管理者用の統計と拍手メッセージを取得して表示する関数。ここでは、APIから統計情報を取得し、HTMLに整形して表示します。
async function fetchBans() {
  const token = getAdminToken();
  if (!token) {
    alert("管理者としてログインしてください");
    location.href = "index.html";
    return;
  }

  // APIから制限中のIPリストを取得して表示する部分。ここでは、APIから制限中のIPリストを取得し、HTMLに整形して表示します。
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

    // 取得した制限中のIPリストをHTMLに整形して表示します。ここでは、IPアドレス、理由、作成日時、解除ボタンを表示する例を示しています。
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
    listEl.innerHTML = '<tr><td colspan="4" style="color:red;">データの取得に失敗しました。</td></tr>'; // エラーが発生した場合のユーザーへの通知
  }
}

// 管理者用の統計と拍手メッセージを取得して表示する関数。ここでは、APIから統計情報を取得し、HTMLに整形して表示します。
async function addBan() {
  const ip = document.getElementById("ban-ip").value;
  const reason = document.getElementById("ban-reason").value;
  const token = getAdminToken();

  if (!ip) return alert("IPアドレスを入力してください"); // IPアドレスが入力されていない場合のバリデーション
  if (!csrfToken) await fetchCsrfToken();
  // APIからのレスポンスを処理し、成功した場合はユーザーに追加完了を通知し、入力フィールドをクリアして制限リストを再取得します。失敗した場合はエラーメッセージを表示し、CSRFトークンを再取得します。
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

    // APIからのレスポンスを処理し、成功した場合はユーザーに追加完了を通知し、入力フィールドをクリアして制限リストを再取得します。失敗した場合はエラーメッセージを表示し、CSRFトークンを再取得します。
    const data = await res.json();
    if (res.ok) {
      alert("IP制限を追加しました"); // ユーザーに追加完了を通知します。
      document.getElementById("ban-ip").value = "";
      document.getElementById("ban-reason").value = "";
      fetchBans();
    } else {
      alert(data.error || "追加に失敗しました"); // エラーメッセージがAPIから提供されている場合はそれを表示し、そうでない場合は一般的なエラーメッセージを表示します。
      await fetchCsrfToken();
    }
  } catch (err) {
    alert("エラーが発生しました"); // ネットワークエラーなど、APIリクエスト自体が失敗した場合のユーザーへの通知
  }
}

// IP制限を解除する関数。ユーザーに確認ダイアログを表示し、APIリクエストを送信してIP制限を解除します。成功した場合は制限リストを再取得し、失敗した場合はエラーメッセージを表示します。
async function unbanIP(id) {
  if (!confirm("このIP制限を解除しますか？")) return;
  const token = getAdminToken();
  if (!csrfToken) await fetchCsrfToken();

  // APIからのレスポンスを処理し、成功した場合はユーザーに解除完了を通知し、制限リストを再取得します。失敗した場合はエラーメッセージを表示し、CSRFトークンを再取得します。
  try {
    const res = await fetch(`/api/admin/restrictions/${id}`, {
      method: "DELETE",
      headers: { 
        "X-Admin-Token": token,
        "X-CSRF-Token": csrfToken
      }
    });

    // APIからのレスポンスを処理し、成功した場合はユーザーに解除完了を通知し、制限リストを再取得します。失敗した場合はエラーメッセージを表示し、CSRFトークンを再取得します。
    if (res.ok) {
      fetchBans();
    } else {
      const data = await res.json();
      alert(data.error || "解除に失敗しました"); 
      await fetchCsrfToken();
    }
  } catch (err) {
    alert("エラーが発生しました"); // ネットワークエラーなど、APIリクエスト自体が失敗した場合のユーザーへの通知
  }
}

// 管理者のログアウト関数。ローカルストレージから管理者トークンを削除し、ユーザーにログアウト完了を通知してトップページにリダイレクトします。
function adminLogout() {
  localStorage.removeItem("admin_token");
  alert("ログアウトしました。"); // ユーザーにログアウト完了を通知します。
  location.href = "index.html";
}

// ページが読み込まれたときに、CSRFトークンを取得し、制限中のIPリストを表示する関数を呼び出します。また、追加ボタンとログアウトボタンのクリックイベントを設定します。
document.addEventListener("DOMContentLoaded", async () => {
  await fetchCsrfToken();
  fetchBans();
  const addBtn = document.getElementById("add-ban-btn");
  if (addBtn) addBtn.onclick = addBan;
  const logoutBtn = document.getElementById("admin-logout-btn");
  if (logoutBtn) logoutBtn.onclick = adminLogout;
});
