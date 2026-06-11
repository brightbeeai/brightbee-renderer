const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");
const { exec } = require("child_process");

const app = express();

app.use(express.json({ limit: "100mb" }));

app.get("/", (req, res) => {
res.json({
status: "renderer online"
});
});

app.post("/render", async (req, res) => {

let workDir = null;

try {

```
const {
  renderId,
  audioUrl,
  timeline
} = req.body;

if (
  !renderId ||
  !audioUrl ||
  !timeline ||
  !timeline.length
) {
  return res.status(400).json({
    success: false,
    error: "Missing renderId, audioUrl or timeline"
  });
}

workDir = `/tmp/${renderId}`;

await fs.ensureDir(workDir);

console.log("Starting render:", renderId);

const clipPaths = await Promise.all(

  timeline.map(async (item, index) => {

    const rawClip =
      `${workDir}/raw_${index}.mp4`;

    console.log(`Downloading clip ${index}`);

    const response = await axios.get(
      item.url,
      {
        responseType: "arraybuffer",
        timeout: 120000
      }
    );

    await fs.writeFile(
      rawClip,
      response.data
    );

    const normalizedClip =
      `${workDir}/clip_${index}.mp4`;

    await run(
      `ffmpeg -y \
      -i "${rawClip}" \
      -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
      -r 30 \
      -c:v libx264 \
      -preset veryfast \
      -crf 23 \
      -c:a aac \
      "${normalizedClip}"`
    );

    return normalizedClip;

  })

);

let concatList = "";

clipPaths.forEach((file) => {
  concatList += `file '${file}'\n`;
});

const listFile =
  `${workDir}/list.txt`;

await fs.writeFile(
  listFile,
  concatList
);

console.log("Downloading audio");

const audioPath =
  `${workDir}/audio.mp3`;

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

const mergedVideo =
  `${workDir}/merged.mp4`;

console.log("Merging clips");

await run(
  `ffmpeg -y \
  -f concat \
  -safe 0 \
  -i "${listFile}" \
  -c:v libx264 \
  -preset veryfast \
  -crf 23 \
  -c:a aac \
  "${mergedVideo}"`
);

const finalVideo =
  `${workDir}/final.mp4`;

console.log("Adding audio");

await run(
  `ffmpeg -y \
  -i "${mergedVideo}" \
  -i "${audioPath}" \
  -map 0:v \
  -map 1:a \
  -c:v copy \
  -c:a aac \
  -shortest \
  "${finalVideo}"`
);

res.json({
  success: true,
  renderId,
  status: "completed",
  output: finalVideo
});

setTimeout(async () => {

  try {

    await fs.remove(workDir);

    console.log(
      "Temporary files removed:",
      workDir
    );

  } catch (e) {

    console.error(e);

  }

}, 60 * 60 * 1000);
```

} catch (e) {

```
console.error("RENDER ERROR");
console.error(e);

if (workDir) {

  try {

    await fs.remove(workDir);

  } catch (_) {}

}

res.status(500).json({
  success: false,
  error: String(e)
});
```

}

});

function run(cmd) {

return new Promise(
(resolve, reject) => {

```
  exec(
    cmd,
    {
      maxBuffer:
        1024 * 1024 * 100
    },
    (
      err,
      stdout,
      stderr
    ) => {

      if (err) {

        console.error(stderr);

        reject(stderr);

      } else {

        resolve(stdout);

      }

    }
  );

}
```

);

}

const PORT =
process.env.PORT || 8080;

app.listen(PORT, () => {

console.log(
`Renderer running on ${PORT}`
);

});
