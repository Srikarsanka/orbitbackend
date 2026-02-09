const jwt = require("jsonwebtoken");
const User = require("../models/user");
require("dotenv").config();

const redirectUser = async (req, res) => {
  console.log("🔍 [REDIRECT] API called");
  
  try {
    let token = req.cookies.orbit_user;
    let tokenSource = "cookie";

    // 🔥 PRIORITIZE Authorization Header (Fixes loop if cookie is stale)
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
      tokenSource = "header";
    }

    console.log("🔍 [REDIRECT] Token source:", tokenSource);
    console.log("🔍 [REDIRECT] Token present:", !!token);

    if (!token) {
      console.log("❌ [REDIRECT] No token found - redirecting to /login");
      return res.json({ redirectTo: "/login" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🔍 [REDIRECT] Decoded JWT:", { id: decoded.id, email: decoded.email, role: decoded.role });

    // Fetch full user details from DB
    const user = await User.findById(decoded.id).select(
      "fullName email role profilePhoto"
    );

    console.log("🔍 [REDIRECT] User found in DB:", !!user);
    
    if (!user) {
      console.log("❌ [REDIRECT] User not found in DB - redirecting to /login");
      return res.json({ redirectTo: "/login" });
    }

    console.log("🔍 [REDIRECT] User details:", { 
      email: user.email, 
      role: user.role, 
      fullName: user.fullName 
    });

    const redirectTo =
      user.role === "faculty" ? "/teacherdashboard" : "/studentdashboard";

    console.log(`✅ [REDIRECT] Sending redirect response: ${redirectTo} for role: ${user.role}`);

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
    console.error("❌ [REDIRECT] Error:", err.message);
    return res.json({ redirectTo: "/login" });
  }
};

module.exports = { redirectUser };
