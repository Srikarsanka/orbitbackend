const express = require("express");
const updatepass = require("../controllers/updatepass");
const router = express.Router();
router.post("/updatepassword", updatepass);
module.exports = router;
