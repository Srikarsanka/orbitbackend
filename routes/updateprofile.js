const express = require("express");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const updatefacultyprofile = require("../controllers/updatefacultyprofile");

const router = express.Router();

router.post("/updateprofilepic", upload.single("photo"), updatefacultyprofile);

module.exports = router;
