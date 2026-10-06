const express = require("express");
const router = express.Router();
const { verifyFirebaseToken } = require("../middlewares/auth");
const wlCtrl = require("../controllers/wishlist.controller");
const { ctrl } = require("../utils/ctrl");

router.post("/wishlist", ctrl(wlCtrl.add));
router.get("/wishlist", verifyFirebaseToken, ctrl(wlCtrl.getByEmail));
router.delete("/wishlist/:id", ctrl(wlCtrl.remove));

module.exports = router;
