const express = require("express");
const router = express.Router();

const forgotPass = require("../controllers/otps/forgotpassword");
const verifyOtp = require("../controllers/otps/verifytOtp");
const resetPassword = require("../controllers/otps/resetPassword");

router.post("/forgot-password", forgotPass);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);

module.exports = router;
