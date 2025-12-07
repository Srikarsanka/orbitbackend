const express = require("express");
const { createclass } = require("../controllers/createclass");
const router = express.Router();
router.post("/create", createclass);
module.exports = router;
