import express from "express";
import multer from "multer";
import { Dropbox } from "dropbox";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();
const app = express();
const upload = multer({ dest: "uploads/" });

const dbx = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN });

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileContent = fs.readFileSync(filePath);

    await dbx.filesUpload({
      path: `/${fileName}`,
      contents: fileContent,
    });

    fs.unlinkSync(filePath);
    res.json({ message: "Upload erfolgreich!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload fehlgeschlagen" });
  }
});

app.get("/", (req, res) => {
  res.send("Server läuft 🚀");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server läuft auf Port ${port}`));
