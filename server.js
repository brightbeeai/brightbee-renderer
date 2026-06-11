const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");
const { exec } = require("child_process");

const app = express();

app.use(express.json({ limit: "50mb" }));

app.get("/", (req, res) => {
res.json({
status: "renderer online"
});
});

app.post("/render", async (req, res) => {
try {

```
console.log("==== RENDER REQUEST RECEIVED ====");

const renderId = req.body.renderId;
const audioUrl = req.body.audioUrl;
const timeline = req.body.timeline || [];

console.log("Render ID:", renderId);
console.log("Audio URL:", audioUrl);
console.log("Timeline Items:", timeline.length);

const workDir = `/tmp/${renderId}`;

await fs.ensureDir(workDir);

let list = "";

for (let i = 0; i < timeline.length; i++) {

  console.log(`Downloading clip ${i}`);

  const clipPath = `${workDir}/clip${i}.mp4`;

  const video = await axios.get(
    timeline[i].url,
    {
      responseType: "arraybuffer",
      timeout: 120000
    }
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

console.log("Video list created");

const audioPath = `${workDir}/audio.mp3`;

const audio = await axios.get(
  audioUrl,
  {
    responseType: "arraybuffer",
    timeout: 120000
  }
);

await fs.writeFile(
  audioPath,
  audio.data
);

console.log("Audio downloaded");

const merged = `${workDir}/merged.mp4`;

await run(
  `ffmpeg -f concat -safe 0 -i ${workDir}/list.txt -c copy ${merged}`
);

console.log("Merged clips");

const finalVideo = `${workDir}/final.mp4`;

await run(
  `ffmpeg -i ${merged} -i ${audioPath} -c:v copy -c:a aac -shortest ${finalVideo}`
);

console.log("Final video created");

res.json({
  success: true,
  renderId,
  status: "completed",
  output: finalVideo
});
```

} catch (e) {

```
console.error("RENDER ERROR:");
console.error(e);

res.status(500).json({
  success: false,
  error: e.toString()
});
```

}
});

function run(cmd) {
return new Promise((resolve, reject) => {

```
console.log("RUNNING:", cmd);

exec(
  cmd,
  { maxBuffer: 1024 * 1024 * 20 },
  (err, stdout, stderr) => {

    if (err) {
      console.error(stderr);
      reject(stderr);
    } else {
      resolve(stdout);
    }

  }
);
```

});
}

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
console.log(`Renderer running on ${PORT}`);
});
