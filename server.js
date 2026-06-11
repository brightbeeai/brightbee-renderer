const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "renderer online"
  });
});

app.post("/render", (req, res) => {

  console.log("RENDER REQUEST");
  console.log(req.body);

  res.json({
    success: true,
    renderId: req.body.renderId,
    status: "queued"
  });

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Renderer running on " + PORT);
});
