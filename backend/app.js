const express = require("express");
const cors = require("cors");

const postRoutes = require("./routes/postRoutes");
const counterRoutes = require("./routes/counterRoutes");

const app = express();

app.use(cors());
const path = require("path");

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.use(express.json());
app.set("trust proxy", true);

app.use("/api/posts", postRoutes);
app.use("/api/counter", counterRoutes);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});