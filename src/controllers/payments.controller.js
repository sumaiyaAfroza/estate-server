const { ObjectId } = require("mongodb");
const { ctrl } = require("../utils/ctrl");

// Initialise Stripe lazily. Doing this at module load throws when
// STRIPE_SECRET_KEY is absent, which would crash the whole server on boot.
let stripeClient = null;
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeClient) {
    stripeClient = require("stripe")(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
};

// POST  /create-payment-intent
exports.createPaymentIntent = ctrl(async (req, res, db) => {
  const { amountInCents, propertyId } = req.body;
  if (!amountInCents || !propertyId) {
    return res.status(400).json({ error: "Amount and propertyId required" });
  }
  const property = await db.collections.agents.findOne({ _id: ObjectId(propertyId) });
  if (!property) return res.status(404).json({ error: "Property not found" });
  const paymentIntent = await getStripe().paymentIntents.create({
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
