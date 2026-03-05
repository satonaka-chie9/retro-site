const canvas = new fabric.Canvas('c', { isDrawingMode: true });
canvas.freeDrawingBrush.width = 3;
canvas.freeDrawingBrush.color = "black";

canvas.on("path:created", function(opt) {
  const data = opt.path.toObject();
  socket.emit("draw", data);
});

socket.on("draw", function(data) {
  fabric.Path.fromObject(data, function(path) {
    canvas.add(path);
  });
});