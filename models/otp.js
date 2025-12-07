const mongoose = require("mongoose");
const otp = new mongoose.Schema(
  {
    email: { type: String, required: true },
    otp: { type: String, required: true },
    resetToken: { type: String, required: false },

    createdAt: { type: Date, default: Date.now(), index: { expires: 300 } },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Otp", otp);
