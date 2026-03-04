const db = require("../db/database");

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function handleAccess(ip) {
  const today = new Date().toISOString().slice(0, 10);

  const existing = await dbGet(
    "SELECT 1 FROM access_log WHERE ip = ? AND accessed_date = ?",
    [ip, today]
  );

  if (existing) return { alreadyCounted: true };

  // ★ まずcounter行が存在するか確認
  const counterRow = await dbGet(
    "SELECT count FROM counter WHERE id = 1"
  );

  if (!counterRow) {
    await dbRun(
      "INSERT INTO counter (id, count) VALUES (1, 0)"
    );
  }

  await dbRun(
    "UPDATE counter SET count = count + 1 WHERE id = 1"
  );

  await dbRun(
    "INSERT INTO access_log (ip, accessed_date) VALUES (?, ?)",
    [ip, today]
  );

  return { counted: true };
}

module.exports = { handleAccess, getCounter };