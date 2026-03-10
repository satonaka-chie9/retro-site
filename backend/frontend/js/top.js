function getDeviceId() {
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
}

async function updateCounter() {
  const device_id = getDeviceId();
  await fetch("/api/counter/increment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_id }),
  });
  const res = await fetch("/api/counter");
  const data = await res.json();
  document.getElementById("counter").innerText =
    String(data.count).padStart(6, "0");
}
updateCounter();