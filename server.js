const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs");
const fetch = require("node-fetch");

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const upload = multer({ dest: "uploads/" });

const SUPABASE_URL = "https://ugffezktrojjhfbaxrrq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnZmZlemt0cm9qamhmYmF4cnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODg3NzIsImV4cCI6MjA5MTI2NDc3Mn0.gzFuLSj225QRnxdwyrH25Xpe1YZqPiK7fp_nrsETsW8";

app.post("/compress-video", upload.single("video"), async (req, res) => {
  const inputPath = req.file.path;
  const outputPath = `uploads/compressed-${Date.now()}.mp4`;

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          "-vcodec libx264",
          "-crf 30",
          "-preset medium",
          "-vf scale=720:-2",
          "-movflags +faststart"
        ])
        .save(outputPath)
        .on("end", resolve)
        .on("error", reject);
    });

    const buffer = fs.readFileSync(outputPath);
    const base64 = buffer.toString("base64");

    const uploadRes = await fetch(
      `${SUPABASE_URL}/functions/v1/generate-r2-upload-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          fileBase64: base64,
          fileName: req.file.originalname.replace(/\.\w+$/, ".mp4"),
          fileType: "video/mp4",
          folder: "products"
        })
      }
    );

    const data = await uploadRes.json();

    if (!uploadRes.ok) {
      throw new Error(data.error || "Upload to R2 failed");
    }

    res.json({
      publicUrl: data.publicUrl
    });

  } catch (error) {
    console.error("VIDEO ERROR:", error);
    res.status(500).json({
      error: error.message
    });

  } finally {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
});

app.get("/", (req, res) => {
  res.send("Video compressor running");
});

app.listen(10000, () => {
  console.log("Server running on port 10000");
});


        
