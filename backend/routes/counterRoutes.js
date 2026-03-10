const express = require("express");
const router = express.Router();
const { handleAccess, getCounter } = require("../services/counterService");

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress
  );
}

router.post("/increment", async (req, res) => {
  try {
    const ip = getClientIp(req);
    const { device_id } = req.body;
    const result = await handleAccess(ip, device_id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const data = await getCounter();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;