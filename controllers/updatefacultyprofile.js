const User = require("../models/user");
const cloudinary = require("../config/cloudinary");

const updatefacultyprofile = async (req, res) => {
  try {
    const { email } = req.body;
    const photo = req.file; // multer adds this

    if (!email || !photo) {
      return res.status(400).json({ success: false, message: "Invalid data" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Upload new image to cloudinary
    const upload = await cloudinary.uploader.upload(photo.path, {
      folder: "orbit_profiles",
    });

    user.profilePhoto = upload.secure_url;
    await user.save();

    return res.json({
      success: true,
      message: "Profile picture updated",
      photo: upload.secure_url,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = updatefacultyprofile;
