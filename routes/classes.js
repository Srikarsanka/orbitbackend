const express = require("express");
const router = express.Router();

const getclass = require("../controllers/myclass");
// now this is a function

router.post("/myclass", getclass);

module.exports = router;
