const Class = require("../models/createclass");

const getclass = async (req, res) => {
  try {
    const { facultyEmail } = req.body;

    if (!facultyEmail) {
      return res.status(400).json({ message: "Faculty Email Required" });
    }

    const classes = await Class.find({ facultyEmail });

    return res.status(200).json({ classes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = getclass; // ✔ export function directly
