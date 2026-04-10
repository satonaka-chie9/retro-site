// 管理者用の拍手メッセージ表示と統計表示のJavaScriptコード
function getAdminToken() {
  const token = localStorage.getItem("admin_token");
  return (token && token !== "undefined") ? token : "";
}

// 日付を日本時間で「YYYY/MM/DD HH:mm:ss」形式に整形する関数
//デフォルトだと日本でもUTCで表示されるため、明示的に日本時間でフォーマットする
function formatDate(dateInput) {
  // dateInputがnullやundefinedの場合は空文字を返す
  if (!dateInput) return "";
  let date;
  // dateInputがDateオブジェクトか文字列かを判定してDateオブジェクトに変換
  if (dateInput instanceof Date) date = dateInput;
  // 文字列の場合、ISO形式かスペース区切りかを判定して適切に変換
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
  // フォーマットされた日付をパーツに分解して組み立てる
  const parts = formatter.formatToParts(date);
  const p = {};
  parts.forEach(part => p[part.type] = part.value);
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

// 管理者用の統計と拍手メッセージを取得して表示する関数
async function fetchStats() {
  const token = getAdminToken();
  if (!token) {
    alert("管理者としてログインしてください"); // トークンがない場合はログインページへリダイレクト
    location.href = "index.html";
    return;
  }
// 統計情報を取得して表示する部分。ここでは累計拍手数を表示する例を示していますが、必要に応じて他の統計も追加できます。
  const statsArea = document.getElementById("stats-area");
  // APIから統計情報を取得する際にエラーハンドリングを行い、失敗した場合はユーザーに通知します。
  try {
    // 管理者トークンをヘッダーに含めてAPIから統計情報を取得するリクエストを送信します。
    const res = await fetch("/api/admin/claps/stats", {
      headers: { "X-Admin-Token": token }
    });
    // レスポンスが正常でない場合はエラーを投げる
    if (!res.ok) throw new Error("Stats fetch failed");
    const data = await res.json();
    statsArea.innerHTML = `累計拍手： <span style="font-weight:bold; color:#00FF00;">${data.total}</span> パチ`; // 取得した統計情報をHTMLに表示します。ここでは累計拍手数を緑色で強調しています。
  } catch (err) {
    statsArea.innerHTML = "統計の取得に失敗しました。"; // エラーが発生した場合のユーザーへの通知
  }
}

// 管理者用の拍手メッセージを取得して表示する関数。ここでは、APIから拍手メッセージのリストを取得し、HTMLに整形して表示します。
async function fetchClaps() {
  const token = getAdminToken();
  const listEl = document.getElementById("claps-list");
  
  // APIから拍手メッセージを取得する際にエラーハンドリングを行い、失敗した場合はユーザーに通知します。
  try {
    // 管理者トークンをヘッダーに含めてAPIから拍手メッセージのリストを取得するリクエストを送信します。
    const res = await fetch("/api/admin/claps", {
      headers: { "X-Admin-Token": token }
    });
    if (!res.ok) throw new Error("Claps fetch failed"); // レスポンスが正常でない場合はエラーを投げる
    
    // 取得した拍手メッセージのリストをJSON形式で解析します。
    const claps = await res.json();
    if (claps.length === 0) {
      listEl.innerHTML = "<p>メッセージはありません。</p>";
      return;
    }

    listEl.innerHTML = "";
    claps.forEach(c => {
      // メッセージがない拍手は無視するか、表示するかお好みで。ここではメッセージありのみを表示。
      if (!c.message) return;
      // c.created_atを日本時間で「YYYY/MM/DD HH:mm:ss」形式に整形して表示するためのコードです。
      const dateStr = formatDate(c.created_at);
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
        listEl.innerHTML = "<p>メッセージ付きの拍手はありません。</p>"; // メッセージ付きの拍手が一件もない場合のフォールバック表示
    }
  } catch (err) {
    listEl.innerHTML = "<p style='color:red;'>メッセージの取得に失敗しました。</p>"; // エラーが発生した場合のユーザーへの通知
  }
}

// 管理者用のログアウト関数。ローカルストレージから管理者トークンを削除し、ユーザーにログアウト完了を通知してからログインページへリダイレクトします。
function adminLogout() {
  localStorage.removeItem("admin_token");
  alert("ログアウトしました。"); // ユーザーにログアウト完了を通知します。
  location.href = "index.html";
}

//ページロード時に統計と拍手メッセージを取得して表示するためベントリスナー
document.addEventListener("DOMContentLoaded", () => {
  fetchStats();
  fetchClaps();
  const logoutBtn = document.getElementById("admin-logout-btn");
  if (logoutBtn) logoutBtn.onclick = adminLogout;
});
