const express = require("express");
const { signup } = require("../controllers/signup");
const { login } = require("../controllers/login");

const { redirectUser } = require("../controllers/redirect");
const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);

router.get("/redirect", redirectUser);
module.exports = router;
