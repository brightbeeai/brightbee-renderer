const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");
const { exec } = require("child_process");

const app = express();

app.use(express.json({ limit: "50mb" }));

app.get("/", (req, res) => {
  res.json({ status: "renderer online" });
});

app.post("/render", async (req, res) => {

  try {

    console.log("=== START RENDER ===");

    const renderId = req.body.renderId;
    const audioUrl = req.body.audioUrl;
    const timeline = req.body.timeline;

    console.log("renderId =", renderId);
    console.log("audioUrl =", audioUrl);
    console.log("timeline =", timeline);

    const renderId = req.body.renderId;
    const audioUrl = req.body.audioUrl;
    const timeline = req.body.timeline;

    const workDir = `/tmp/${renderId}`;

    await fs.ensureDir(workDir);

    let list = "";

    for (let i = 0; i < timeline.length; i++) {

      const clipPath = `${workDir}/clip${i}.mp4`;

      const video = await axios.get(
        timeline[i].url,
        { responseType: "arraybuffer" }
      );

      await fs.writeFile(
        clipPath,
        video.data
      );

      list += `file '${clipPath}'\n`;
    }

    await fs.writeFile(
      `${workDir}/list.txt`,
      list
    );

    const audioPath = `${workDir}/audio.mp3`;

    const audio = await axios.get(
      audioUrl,
      { responseType: "arraybuffer" }
    );

    await fs.writeFile(
      audioPath,
      audio.data
    );

    const merged = `${workDir}/merged.mp4`;

    await run(
      `ffmpeg -f concat -safe 0 -i ${workDir}/list.txt -c copy ${merged}`
    );

    const finalVideo = `${workDir}/final.mp4`;

    await run(
      `ffmpeg -i ${merged} -i ${audioPath} -c:v copy -c:a aac -shortest ${finalVideo}`
    );

    res.json({
      success: true,
      renderId,
      status: "completed",
      output: finalVideo
    });

  catch (e) {

  console.error("ERROR:");
  console.error(e);

  res.status(500).json({
    success:false,
    error:e.message
  });

}

});

function run(cmd) {

  return new Promise((resolve, reject) => {

    exec(cmd, (err, stdout, stderr) => {

      if (err) reject(stderr);

      else resolve(stdout);

    });

  });

}

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Renderer running on ${PORT}`);
});
