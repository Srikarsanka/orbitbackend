// Importing core modules
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser"); // Optional, but included
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express(); // Initialize Express App

//-------------------------------------------------------------
// 🔐 Middleware Setup
//-------------------------------------------------------------

// Parse cookies from frontend requests
app.use(cookieParser());

// Enable CORS so frontend (Angular) can communicate with backend
app.use(
  cors({
    origin: "http://localhost:4200", // Angular app URL
    credentials: true, // Allow cookies / tokens
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);

// Parse incoming JSON request bodies (instead of bodyParser.json())
app.use(express.json({ limit: "50mb" })); // Set limit to allow images / base64

//-------------------------------------------------------------
// 📌 Logging Middleware (for debugging each request)
//-------------------------------------------------------------
app.use((req, res, next) => {
  console.log(
    "Incoming Request =>",
    req.method,
    req.url,
    "Time:",
    new Date().toISOString()
  );
  next();
});

//-------------------------------------------------------------
// 🌍 MongoDB Connection
//-------------------------------------------------------------
mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1); // Stop server if DB not connected
  });

//-------------------------------------------------------------
// 🚏 Import & Register Routes
//-------------------------------------------------------------

// Auth / Login / Signup
const authRoutes = require("./routes/auth");
app.use("/auth", authRoutes);

// Create or Join Class
const classRoutes = require("./routes/class");
app.use("/api/class", classRoutes);

// Fetch all classes for student / faculty
const classesRoutes = require("./routes/classes");
app.use("/api/classes", classesRoutes);

// Update Profile
app.use("/api/faculty", require("./routes/updateprofile"));

// Update Password
app.use("/api", require("./routes/updatepassword.js"));

// Announcements
app.use("/api/announcements", require("./routes/anouncementroute.js"));

// Open Class / Start Meeting Room
app.use("/api/openclass", require("./routes/room.js"));

// Class-wise announcement
app.use(
  "/api/announcements/class",
  require("./routes/classannoucementroute.js")
);

// Change class name ✔ FIXED missing slash
app.use("/api/change", require("./routes/classname.js"));

//it is used for material uploads
app.use("/api/material", require("./routes/materialRoute.js"));
app.use("/uploads", express.static("uploads"));

// it is use for the deletion of classess

app.use("/api/deleteclass", require("./routes/deleteclassrouter.js"));

// for reset password

app.use("/otp", require("./routes/otp"));

//-------------------------------------------------------------
// 🛑 Error Handling Middleware (for backend crashes)
//-------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

//-------------------------------------------------------------
// ❌ 404 Handler (Route not found)
//-------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

//-------------------------------------------------------------
// 🚀 Start Server
//-------------------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
