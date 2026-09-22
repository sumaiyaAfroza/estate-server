const express = require("express");
const router = express.Router();
const { verifyFirebaseToken } = require("../../middlewares/auth");
const offCtrl = require("../../controllers/offers.controller");
const { ctrl } = require("../../controllers/offers.controller");

router.post("/offers", ctrl(offCtrl.createOffer));
router.get("/offers", verifyFirebaseToken, ctrl(offCtrl.getOffers));
router.get("/offers/agent", verifyFirebaseToken, ctrl(offCtrl.getAgentOffers));
router.patch("/offers/accept/:id", ctrl(offCtrl.acceptOffer));
router.patch("/offers/reject/:id", ctrl(offCtrl.rejectOffer));
router.put("/offer/:id/buy", ctrl(offCtrl.buyOffer));

module.exports = router;
