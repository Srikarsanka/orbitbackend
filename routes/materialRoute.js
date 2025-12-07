const express = require("express");
const router = express.Router();
const upload = require("../utlils/multer");
const controller = require("../controllers/materialscontroller");

router.post("/upload", upload.single("material"), controller.uploadMaterial);
router.get("/:classId", controller.getMaterials);
router.delete("/delete/:id", controller.deleteMaterial);

module.exports = router;
