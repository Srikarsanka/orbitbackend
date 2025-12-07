const express = require("express");
const update = require("../controllers/classnamechange");
const router = express.Router();

router.put("/updateclassname/:classid", update);

module.exports = router;
