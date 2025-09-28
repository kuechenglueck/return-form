import express from "express";
import multer from "multer";
import { Dropbox } from "dropbox";
import dotenv from "dotenv";
import fs from "fs";
import cors from "cors";

dotenv.config();
const app = express();

// ✅ CORS richtig setzen (gegen CORB geschützt)
app.use(cors({
  origin: [
    "https://kuechenglueck.ch",
    "https://www.kuechenglueck.ch"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true
}));

// Multer Setup (Dateiupload)
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/heic", "image/heif"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Ungültiger Dateityp: " + file.mimetype));
    }
    cb(null, true);
  }
});

// Dropbox Setup
const dbx = new Dropbox({
  clientId: process.env.DROPBOX_APP_KEY,
  clientSecret: process.env.DROPBOX_APP_SECRET,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN
});

// Upload Endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Keine Datei hochgeladen"
      });
    }

    const orderNumber = req.body.orderNumber || "unbekannt";
    const originalName = req.file.originalname;
    const fileName = `${orderNumber}-${originalName}`;
    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath);

    console.log("📂 Upload gestartet:", fileName);

    // Datei nach Dropbox hochladen
    await dbx.filesUpload({
      path: `/returns/${fileName}`,
      contents: fileContent,
      mode: { ".tag": "overwrite" }
    });
    fs.unlinkSync(filePath);

    console.log("✅ Datei in Dropbox:", `/returns/${fileName}`);

    // Freigabelink erstellen oder bestehenden Link holen
    let publicLink;
    try {
      const linkResponse = await dbx.sharingCreateSharedLinkWithSettings({
        path: `/returns/${fileName}`
      });
      publicLink = linkResponse.result.url.replace("?dl=0", "?dl=1");
      console.log("🔗 Neuer Link erstellt:", publicLink);
    } catch (err) {
      console.warn("⚠️ Link existiert schon, hole bestehenden...");
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

    // Erfolgreiche Antwort an Frontend
    return res.status(200).json({
      success: true,
      message: "Upload erfolgreich",
      fileLink: publicLink
    });

  } catch (err) {
    console.error("❌ Fehler beim Upload:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Root Endpoint (Test)
app.get("/", (req, res) => {
  res.send("✅ Server läuft mit Dropbox-Upload + CORS-Schutz");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server läuft auf Port ${port}`));
