import express from "express";
import multer from "multer";
import { Dropbox } from "dropbox";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();
const app = express();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/heic", "image/heif"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Ungültiger Dateityp: " + file.mimetype));
    }
    cb(null, true);
  }
});

const dbx = new Dropbox({
  clientId: process.env.DROPBOX_APP_KEY,
  clientSecret: process.env.DROPBOX_APP_SECRET,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      console.error("❌ Keine Datei empfangen");
      return res.status(400).json({ success: false, step: "file-check", error: "Keine Datei hochgeladen" });
    }

    const orderNumber = req.body.orderNumber || "unbekannt";
    const originalName = req.file.originalname;
    const fileName = `${orderNumber}-${originalName}`;
    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath);

    console.log("📂 Upload gestartet:", fileName);

    // Upload
    const uploadResult = await dbx.filesUpload({
      path: `/returns/${fileName}`,
      contents: fileContent,
      mode: { ".tag": "overwrite" }
    });

    fs.unlinkSync(filePath);
    console.log("✅ Datei in Dropbox:", uploadResult.result.path_display);

    let publicLink;
    try {
      const linkResponse = await dbx.sharingCreateSharedLinkWithSettings({
        path: `/returns/${fileName}`
      });
      publicLink = linkResponse.result.url.replace("?dl=0", "?dl=1");
      console.log("🔗 Neuer Link erstellt:", publicLink);
    } catch (err) {
      console.warn("⚠️ Neuer Link konnte nicht erstellt werden, versuche bestehenden zu holen...");
      const existing = await dbx.sharingListSharedLinks({
        path: `/returns/${fileName}`,
        direct_only: true
      });
      if (existing.result.links.length > 0) {
        publicLink = existing.result.links[0].url.replace("?dl=0", "?dl=1");
        console.log("🔗 Existierender Link gefunden:", publicLink);
      } else {
        throw new Error("Kein Freigabelink verfügbar");
      }
    }

    return res.status(200).json({
      success: true,
      step: "done",
      message: "Upload erfolgreich",
      fileLink: publicLink
    });
  } catch (err) {
    console.error("❌ Fehler beim Upload:", err.message);
    return res.status(500).json({
      success: false,
      step: "catch",
      error: err.message
    });
  }
});

app.get("/", (req, res) => {
  res.send("Server läuft 🚀 Debug-Version mit Logging");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server läuft auf Port ${port}`));
