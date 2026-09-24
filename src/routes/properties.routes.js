const express = require("express");
const router = express.Router();
const { verifyFirebaseToken } = require("../../middlewares/auth");
const propsCtrl = require("../../controllers/properties.controller");
const { ctrl } = require("../../controllers/properties.controller");

// Public listing endpoints
router.get("/allProperties", ctrl(propsCtrl.getAllVerified));
router.get("/properties/verified", ctrl(propsCtrl.getVerified));
router.get("/propertiess/advertised", ctrl(propsCtrl.getAdvertised));
router.get("/properties/:id/views", ctrl(propsCtrl.incrementView));
router.get("/wishlistProperty/:id", ctrl(propsCtrl.getWishlistProperty));

// Admin / internal endpoints
router.get("/properties", ctrl(propsCtrl.getAllProperties));
router.get("/properties/:id", ctrl(propsCtrl.getById));
router.patch("/properties/verify/:id", ctrl(propsCtrl.verifyProperty));
router.patch("/properties/reject/:id", ctrl(propsCtrl.rejectProperty));
router.patch("/properties/advertise/:id", ctrl(propsCtrl.advertiseProperty));
router.patch("/properties/fix-price/:id", ctrl(propsCtrl.fixPrice));

module.exports = router;
