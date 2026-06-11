const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");
const { exec } = require("child_process");

const app = express();

app.use(express.json({ limit: "100mb" }));

app.get("/", (req, res) => {
  res.json({
    status: "youtube-shorts-renderer-online"
  });
});

app.post("/render", async (req, res) => {

  let workDir = null;

  try {

    const { renderId, audioUrl, timeline } = req.body;

    if (!renderId) {
      return res.status(400).json({
        success: false,
        error: "renderId required"
      });
    }

    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        error: "audioUrl required"
      });
    }

    if (!timeline || !timeline.length) {
      return res.status(400).json({
        success: false,
        error: "timeline required"
      });
    }

    workDir = `/tmp/${renderId}`;

    await fs.ensureDir(workDir);

    console.log("START RENDER:", renderId);

    const processedClips = [];

    for (let i = 0; i < timeline.length; i++) {

      const item = timeline[i];

      const rawClip =
        `${workDir}/raw_${i}.mp4`;

      const clip =
        `${workDir}/clip_${i}.mp4`;

      console.log(`DOWNLOAD CLIP ${i}`);

      const video = await axios.get(
        item.url,
        {
          responseType: "arraybuffer",
          timeout: 120000
        }
      );

      await fs.writeFile(
        rawClip,
        video.data
      );

      console.log(`NORMALIZE CLIP ${i}`);

      await run(
        `ffmpeg -y -i "${rawClip}" ` +
        `-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" ` +
        `-r 30 ` +
        `-c:v libx264 ` +
        `-preset veryfast ` +
        `-crf 23 ` +
        `-pix_fmt yuv420p ` +
        `-an ` +
        `"${clip}"`
      );

      processedClips.push(clip);
    }

    let listContent = "";

    processedClips.forEach((file) => {
      listContent += `file '${file}'\n`;
    });

    const listFile =
      `${workDir}/list.txt`;

    await fs.writeFile(
      listFile,
      listContent
    );

    console.log("MERGE CLIPS");

    const mergedVideo =
      `${workDir}/merged.mp4`;

    await run(
      `ffmpeg -y ` +
      `-f concat ` +
      `-safe 0 ` +
      `-i "${listFile}" ` +
      `-c:v libx264 ` +
      `-preset veryfast ` +
      `-crf 23 ` +
      `"${mergedVideo}"`
    );

    console.log("DOWNLOAD AUDIO");

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

    console.log("ADD AUDIO");

    const finalVideo =
      `${workDir}/final.mp4`;

    await run(
      `ffmpeg -y ` +
      `-i "${mergedVideo}" ` +
      `-i "${audioPath}" ` +
      `-map 0:v ` +
      `-map 1:a ` +
      `-c:v copy ` +
      `-c:a aac ` +
      `-b:a 192k ` +
      `-shortest ` +
      `"${finalVideo}"`
    );

    res.json({
      success: true,
      renderId,
      status: "completed",
      output: finalVideo
    });

  } catch (e) {

    console.error("RENDER ERROR");
    console.error(e);

    res.status(500).json({
      success: false,
      error: String(e)
    });

  }
});

function run(cmd) {

  return new Promise((resolve, reject) => {

    exec(
      cmd,
      {
        maxBuffer: 1024 * 1024 * 100
      },
      (err, stdout, stderr) => {

        if (err) {

          console.error(stderr);

          reject(stderr);

        } else {

          resolve(stdout);

        }

      }
    );

  });

}

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Renderer running on port ${PORT}`);
});
