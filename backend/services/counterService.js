// カウンターサービス
const db = require("../db/database");

// データベースのgetをPromise化
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// データベースのrunをPromise化
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

/**
 * アクセスを処理し、必要に応じてカウントアップする
 * @param {string} ip - クライアントのIPアドレス
 * @param {string} deviceId - クライアントのデバイスID (UUID)
 */
async function handleAccess(ip, deviceId) {
  const today = new Date().toISOString().slice(0, 10);

  // 今日、同じIPかつ同じデバイスIDでのアクセスがあるか確認
  const existing = await dbGet(
    "SELECT 1 FROM access_log WHERE ip = ? AND device_id = ? AND accessed_date = ?",
    [ip, deviceId, today]
  );

  if (existing) {
    return { alreadyCounted: true };
  }

  // カウンター行の存在確認と作成
  const counterRow = await dbGet("SELECT count FROM counter WHERE id = 1");
  if (!counterRow) {
    await dbRun("INSERT INTO counter (id, count) VALUES (1, 0)");
  }

  // カウントアップ
  await dbRun("UPDATE counter SET count = count + 1 WHERE id = 1");

  // アクセスログを保存
  await dbRun(
    "INSERT INTO access_log (ip, device_id, accessed_date) VALUES (?, ?, ?)",
    [ip, deviceId, today]
  );

  return { counted: true };
}

// 現在のカウンター値を取得する関数。これにより、フロントエンドは現在の訪問者数を表示できます。
async function getCounter() {
  const row = await dbGet("SELECT count FROM counter WHERE id = 1");
  return row || { count: 0 };
}

module.exports = { handleAccess, getCounter };
