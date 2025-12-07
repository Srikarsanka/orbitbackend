const mongoose = require("mongoose");
const express = require("express");
const anouncementSchema = new mongoose.Schema(
  {
    classId: { type: String, required: true },
    className: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    sendEmail: { type: Boolean, required: true },
    facultyEmail: { type: String, required: true },
    facultyName: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Announcement", anouncementSchema);
