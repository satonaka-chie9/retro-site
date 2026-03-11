const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log("Recreating news table...");
  db.run("DROP TABLE IF EXISTS news");
  db.run(`
    CREATE TABLE news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("Done.");
});
db.close();
