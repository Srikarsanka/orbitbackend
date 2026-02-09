// middleware/auth.js
const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

const auth = (req, res, next) => {
  let token = req.cookies.orbit_user;

  // 🔥 PRIORITIZE Authorization Header (Fixes loop if cookie is stale)
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = { token: req.headers.authorization.split(" ")[1] }; // Wrap to match cookie structure
  } else if (token && typeof token === 'string') {
     // Handle case where cookie is just the string (some setups)
     token = { token: token };
  }

  if (!token || !token.token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(cookie.token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.log("JWT ERROR:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = auth;
