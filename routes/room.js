const express = require("express");
const openclass = require(`../controllers/openclass`);
const router = express.Router();
router.post("/:classCode", openclass);
module.exports = router;
