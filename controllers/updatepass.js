const User = require("../models/user");
const bcrypt = require("bcryptjs");

const updatepass = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Missing required feilds" });
    } else {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "User Not Found" });
      } else {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        user.password = hash;
        await user.save();
        return res
          .status(200)
          .json({ message: "Password Updated Successully.." });
      }
    }
  } catch (e) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = updatepass;
