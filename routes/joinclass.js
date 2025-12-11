const express = require("express");
const router = express.Router();
const joinclass = require("../controllers/joinclass");

router.post("/join", joinclass);

module.exports = router;
