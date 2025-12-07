const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema(
  {
    classId: { type: String, required: true },
    title: { type: String, required: true },
    uploadedBy: { type: String, required: true },

    // For uploaded files
    fileUrl: { type: String },

    // For external links
    externalLink: { type: String },

    type: { type: String, required: true }, // "file" or "link"
  },
  { timestamps: true }
);

module.exports = mongoose.model("Material", materialSchema);
