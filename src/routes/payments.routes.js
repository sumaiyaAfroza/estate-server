const express = require("express");
const router = express.Router();
const payCtrl = require("../../controllers/payments.controller");
const { ctrl } = require("../../controllers/payments.controller");

router.post("/create-payment-intent", ctrl(payCtrl.createPaymentIntent));
router.put("/property/:id/pay", ctrl(payCtrl.payProperty));

module.exports = router;
