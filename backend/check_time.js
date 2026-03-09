const db = require('./db/database');
db.all("SELECT created_at FROM posts ORDER BY id DESC LIMIT 1", (err, rows) => {
  if (err) console.error(err);
  console.log('Latest post created_at:', rows[0]?.created_at);
  process.exit();
});