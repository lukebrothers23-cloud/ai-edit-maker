import express from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const upload = multer({ dest: "uploads/" });
app.use("/uploads", express.static("uploads"));
app.use("/output", express.static("output"));
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("output")) fs.mkdirSync("output");

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>AI Edit Maker</title>
<style>
body{font-family:sans-serif;background:linear-gradient(135deg,#dff1ff,#aee1ff);
margin:0;padding:2rem;text-align:center}
h1{color:#004b75}
section{background:white;padding:1.5rem;border-radius:1rem;max-width:480px;margin:1rem auto;
box-shadow:0 0 10px rgba(0,0,0,.1)}
input,button{margin:.5rem 0;width:100%;padding:.5rem}
video{max-width:100%;border-radius:.5rem;margin-top:1rem}
</style>
</head>
<body>
<h1>🎬 AI Edit Maker</h1>

<section>
<h2>Create New Edit</h2>
<form id="editForm" enctype="multipart/form-data">
  <input type="file" name="video" accept="video/*" required />
  <input type="file" name="audio" accept="audio/*" required />
  <button type="submit">Generate Edit</button>
</form>
<div id="output1"></div>
</section>

<section>
<h2>Recreate Existing Edit</h2>
<form id="recreateForm" enctype="multipart/form-data">
  <input type="file" name="edit" accept="video/*" required />
  <input type="text" name="theme" placeholder="New theme (e.g. Star Wars)" required />
  <button type="submit">Recreate Edit</button>
</form>
<div id="output2"></div>
</section>

<script>
async function postForm(url, form, outputDiv){
  const fd = new FormData(form);
  const res = await fetch(url,{method:"POST",body:fd});
  const data = await res.json();
  document.getElementById(outputDiv).innerHTML =
    data.output
      ? '<h3>Done!</h3><video controls src="'+data.output+'"></video>'
      : '<p style="color:red">'+(data.error||"Error")+'</p>';
}

document.getElementById("editForm").addEventListener("submit",e=>{
  e.preventDefault(); postForm("/edit", e.target, "output1");
});
document.getElementById("recreateForm").addEventListener("submit",e=>{
  e.preventDefault(); postForm("/recreate", e.target, "output2");
});
</script>
</body></html>`);
});

app.post("/edit", upload.fields([{ name: "video" }, { name: "audio" }]), async (req, res) => {
  try {
    const vid = req.files["video"][0].path;
    const aud = req.files["audio"][0].path;
    const out = path.join("output", `edit-${Date.now()}.mp4`);

    await new Promise((resolve, reject) => {
      ffmpeg(vid)
        .input(aud)
        .outputOptions([
          "-shortest",
          "-vf",
          "fade=t=in:st=0:d=1,fade=t=out:st=4:d=1",
          "-af",
          "afade=t=in:st=0:d=1,afade=t=out:st=4:d=1",
        ])
        .on("end", resolve)
        .on("error", reject)
        .save(out);
    });

    res.json({ output: "/" + out });
  } catch (e) {
    console.error(e);
    res.json({ error: "Processing failed." });
  }
});

// --- New Feature: Recreate existing edit with new theme (placeholder) ---
app.post("/recreate", upload.single("edit"), async (req, res) => {
  try {
    const file = req.file.path;
    const theme = req.body.theme;
    const infoOut = path.join("output", `recreated-${Date.now()}.mp4`);

    // simple placeholder: just duplicate + log theme
    console.log("Recreate theme requested:", theme);

    await new Promise((resolve, reject) => {
      ffmpeg(file)
        .outputOptions([
          "-vf",
          "fade=t=in:st=0:d=1,fade=t=out:st=4:d=1",
        ])
        .on("end", resolve)
        .on("error", reject)
        .save(infoOut);
    });

    res.json({ output: "/" + infoOut });
  } catch (e) {
    console.error(e);
    res.json({ error: "Recreate failed." });
  }
});

app.listen(5000, () => console.log("✅ AI Edit Maker running at http://localhost:5000"));
