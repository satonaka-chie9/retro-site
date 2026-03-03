const express = require("express");
const cors = require("cors");

const postRoutes = require("./routes/postRoutes");
const counterRoutes = require("./routes/counterRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.set("trust proxy", true);

app.use("/api/posts", postRoutes);
app.use("/api/counter", counterRoutes);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});