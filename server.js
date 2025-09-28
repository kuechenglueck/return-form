import express from "express";
import multer from "multer";
import { Dropbox } from "dropbox";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();
const app = express();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // max 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/heic"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Ungültiger Dateityp"));
    }
    cb(null, true);
  }
});

const dbx = new Dropbox({
  clientId: process.env.DROPBOX_APP_KEY,
  clientSecret: process.env.DROPBOX_APP_SECRET,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN
});

// Upload Endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "Keine Datei hochgeladen" });
    }

    const orderNumber = req.body.orderNumber || "unbekannt";
    const originalName = req.file.originalname;
    const fileName = `${orderNumber}-${originalName}`;
    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath);

    // Datei nach Dropbox hochladen
    await dbx.filesUpload({
      path: `/returns/${fileName}`,
      contents: fileContent,
      mode: { ".tag": "add" }
    });

    fs.unlinkSync(filePath);

    // Freigabelink erzeugen
    const linkResponse = await dbx.sharingCreateSharedLinkWithSettings({
      path: `/returns/${fileName}`
    });

    const publicLink = linkResponse.result.url.replace("?dl=0", "?dl=1");

    res.status(200).json({
      success: true,
      message: "Upload erfolgreich",
      fileLink: publicLink
    });
  } catch (err) {
    console.error("Upload Fehler:", err.message);
    res.status(500).json({ success: false, error: "Upload fehlgeschlagen" });
  }
});

app.get("/", (req, res) => {
  res.send("Server läuft 🚀 mit Dropbox Upload, Bestellnummer im Dateinamen und Link-Erstellung");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server läuft auf Port ${port}`));
