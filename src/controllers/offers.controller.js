const { ObjectId } = require("mongodb");
const ctrl = (fn) => async (req, res, db) => {
  try {
    await fn(req, res, db);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  }
};

// POST  /offers
exports.createOffer = ctrl(async (req, res, db) => {
  const offer = req.body;
  if (offer.buyerRole !== "user") {
    return res.status(403).send({ message: "Only users can make offers." });
  }
  const { offerAmount, minPrice, maxPrice } = offer;
  if (offerAmount < minPrice || offerAmount > maxPrice) {
    return res.status(400).send({ message: "Offer must be within the price range." });
  }
  offer.status = "pending";
  const result = await db.collections.offers.insertOne(offer);
  res.send(result);
});

// GET  /offers?email=&role=
exports.getOffers = ctrl(async (req, res, db) => {
  const { email, role } = req.query;
  if (!email || !role) return res.status(400).json({ message: "Email and role are required" });
  const offers = await db.collections.offers.find({ buyerEmail: email, buyerRole: role }).toArray();
  res.send(offers);
});

// GET  /offers/agent?email=
exports.getAgentOffers = ctrl(async (req, res, db) => {
  const { email } = req.query;
  const result = await db.collections.offers.find({ agentEmail: email }).toArray();
  res.send(result);
});

// PATCH  /offers/accept/:id
exports.acceptOffer = ctrl(async (req, res, db) => {
  const { id } = req.params;
  const { propertyId } = req.body;
  if (!ObjectId.isValid(id)) return res.status(400).send({ success: false, message: "Invalid offer ID" });
  const result = await db.collections.offers.updateOne({ _id: ObjectId(id) }, { $set: { status: "accepted" } });
  if (result.matchedCount === 0) return res.status(404).send({ success: false, message: "Offer not found" });
  if (propertyId) {
    await db.collections.agents.updateOne({ _id: ObjectId(propertyId) }, { $set: { status: "bought" } });
  }
  res.send({ success: true, message: "Offer accepted successfully" });
});

// PATCH  /offers/reject/:id
exports.rejectOffer = ctrl(async (req, res, db) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).send({ success: false, message: "Invalid offer ID" });
  const result = await db.collections.offers.updateOne({ _id: ObjectId(id) }, { $set: { status: "rejected" } });
  if (result.matchedCount === 0) return res.status(404).send({ success: false, message: "Offer not found" });
  res.send({ success: true, message: "Offer rejected successfully" });
});

// PUT  /offer/:id/buy
exports.buyOffer = ctrl(async (req, res, db) => {
  const { id } = req.params;
  const { transactionId } = req.body;
  const result = await db.collections.offers.updateOne(
    { _id: ObjectId(id) },
    { $set: { status: "bought", transactionId, paidAt: new Date() } }
  );
  if (result.matchedCount === 0) return res.status(404).json({ error: "Offer not found" });
  res.json({ success: true, message: "Offer status updated successfully" });
});
