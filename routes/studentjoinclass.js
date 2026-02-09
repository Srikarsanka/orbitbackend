// routes/joinclass.js

const express = require("express");
const Router = express.Router();
const joinclas = require("../controllers/studentclassess");
const joinClassController = require("../controllers/joinclass");

Router.post("/classes", joinclas);
Router.post("/join", joinClassController); // Student join class by code

module.exports = Router;
