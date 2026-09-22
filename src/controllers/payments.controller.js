const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { ObjectId } = require("mongodb");
const ctrl = (fn) => async (req, res, db) => {
  try {
    await fn(req, res, db);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  }
};

// POST  /create-payment-intent
exports.createPaymentIntent = ctrl(async (req, res, db) => {
  const { amountInCents, propertyId } = req.body;
  if (!amountInCents || !propertyId) {
    return res.status(400).json({ error: "Amount and propertyId required" });
  }
  const property = await db.collections.agents.findOne({ _id: ObjectId(propertyId) });
  if (!property) return res.status(404).json({ error: "Property not found" });
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: "usd",
    payment_method_types: ["card"],
    metadata: { propertyId },
  });
  res.json({ clientSecret: paymentIntent.client_secret });
});

// PUT  /property/:id/pay
exports.payProperty = ctrl(async (req, res, db) => {
  const { id } = req.params;
  const { transactionId, offerId } = req.body;
  const updates = { $set: { status: "sold", transactionId, soldAt: new Date() } };
  await Promise.all([
    db.collections.agents.updateOne({ _id: ObjectId(id) }, updates),
    db.collections.property.updateOne({ _id: ObjectId(id) }, updates),
  ]);
  if (offerId) {
    await db.collections.offers.updateOne(
      { _id: ObjectId(offerId) },
      { $set: { status: "bought", transactionId, paidAt: new Date() } }
    );
  }
  res.json({ success: true, message: "Payment recorded successfully" });
});
