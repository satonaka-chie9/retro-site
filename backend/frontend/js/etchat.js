const socket = io();
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let drawing = false;

canvas.addEventListener("mousedown", () => drawing = true);
canvas.addEventListener("mouseup", () => drawing = false);
canvas.addEventListener("mouseout", () => drawing = false);

canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  draw(x, y);
  socket.emit("draw", { x, y });
});

socket.on("draw", (data) => {
  draw(data.x, data.y);
});

function draw(x, y) {
  ctx.fillRect(x, y, 2, 2);
}