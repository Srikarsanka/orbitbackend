const express = require("express");
const Class = require("../models/createclass.js"); //

const createclass = async (req, res) => {
  try {
    const {
      className,
      subject,
      description,
      facultyName,
      facultyPhoto,
      facultyEmail,
    } = req.body;

    if (
      !className ||
      !subject ||
      !description ||
      !facultyName ||
      !facultyPhoto ||
      !facultyEmail
    ) {
      return res
        .status(400)
        .json({ message: "Please enter all the input fields." });
    }

    // Keep generating until we find a unique classCode
    let classCode;
    let exists = true;

    while (exists) {
      const number = Math.floor(Math.random() * 1000000); // 6-digit random
      classCode = subject.slice(0, 4).toUpperCase() + String(number);

      const match = await Class.findOne({ classCode });
      exists = !!match;
    }

    // Create new class with unique random code
    const newClass = new Class({
      className,
      subject,
      description,
      classCode,
      facultyName,
      facultyPhoto,
      facultyEmail,
    });

    await newClass.save();

    res
      .status(201)
      .json({ message: "Class created successfully", class: newClass });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { createclass };
