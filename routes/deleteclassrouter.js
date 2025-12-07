const express = require("express");
const Deletecclass = require("../controllers/deleteclass");
const router = express.Router();
router.delete("/:classId", Deletecclass);

module.exports = router;
