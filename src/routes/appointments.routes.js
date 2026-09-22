const express = require("express");
const router = express.Router();
const { verifyFirebaseToken } = require("../../middlewares/auth");
const aptCtrl = require("../../controllers/appointments.controller");
const { ctrl } = require("../../controllers/appointments.controller");

router.post("/appointments", verifyFirebaseToken, ctrl(aptCtrl.create));
router.get("/appointments", verifyFirebaseToken, ctrl(aptCtrl.getAll));

module.exports = router;
