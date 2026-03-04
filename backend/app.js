const express = require("express");
const cors = require("cors");
const path = require("path");

const postRoutes = require("./routes/postRoutes");
const counterRoutes = require("./routes/counterRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.set("trust proxy", true);

// 静的ファイル配信
app.use(express.static(path.resolve(__dirname, "frontend")));

// API
app.use("/api/posts", postRoutes);
app.use("/api/counter", counterRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});