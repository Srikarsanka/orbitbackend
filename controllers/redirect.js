const jwt = require("jsonwebtoken");
const User = require("../models/user");
require("dotenv").config();

const redirectUser = async (req, res) => {
  try {
    const token = req.cookies.orbit_user;

    if (!token) {
      return res.json({ redirectTo: "/login" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch full user details from DB
    const user = await User.findById(decoded.id).select(
      "fullName email role profilePhoto"
    );

    if (!user) {
      return res.json({ redirectTo: "/login" });
    }

    const redirectTo =
      user.role === "faculty" ? "/teacherdashboard" : "/studentdashboard";

    return res.json({
      redirectTo,
      user: {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        photo: user.profilePhoto,
      },
    });
  } catch (err) {
    return res.json({ redirectTo: "/login" });
  }
};

module.exports = { redirectUser };
