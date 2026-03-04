async function updateCounter() {
  await fetch("/api/counter/increment", { method: "POST" });
  const res = await fetch("/api/counter");
  const data = await res.json();
  document.getElementById("counter").innerText =
    String(data.count).padStart(6, "0");
}
updateCounter();