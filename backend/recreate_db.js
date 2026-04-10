// データベースの再作成スクリプト。開発中にテーブル構造を変更した際などに使用します。

const db = require("./db/database");

async function recreateNews() {
  console.log("Recreating news table...");
  db.run("DROP TABLE IF EXISTS news", [], (err) => {
    if (err) console.error(err);
    const createSql = db.isPostgres ? 
      `CREATE TABLE news (
        id SERIAL PRIMARY KEY,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )` :
      `CREATE TABLE news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`;
      
    db.run(createSql, [], (err) => {
      if (err) console.error(err);
      console.log("Done.");
    });
  });
}

recreateNews();
