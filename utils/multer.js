const multer = require("multer");
const path = require("path");
const os = require("os");
const fs = require("fs");

// Use OS temp dir for temporary storage (works on Render's ephemeral filesystem)
const uploadsDir = path.join(os.tmpdir(), 'orbit-materials');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max
});

module.exports = upload;
