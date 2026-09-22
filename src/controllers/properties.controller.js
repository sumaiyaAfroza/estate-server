const { ObjectId } = require("mongodb");
const ctrl = (fn) => async (req, res, db) => {
  try {
    await fn(req, res, db);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  }
};

// GET  /properties — all properties (for admin)
exports.getAllProperties = ctrl(async (_req, res, db) => {
  const result = await db.collections.agents.find().toArray();
  res.send(result);
});

// GET  /allProperties?location=&sort=
exports.getAllVerified = ctrl(async (req, res, db) => {
  const { location, sort } = req.query;
  const query = { status: "verified", verified: true, ...(location ? { location: { $regex: location, $options: "i" } } : {}) };
  const sortOption = sort === "asc" ? { price: 1 } : sort === "desc" ? { price: -1 } : {};
  const result = await db.collections.agents.find(query).sort(sortOption).toArray();
  res.send(result);
});

// GET  /properties/:id
exports.getById = ctrl(async (req, res, db) => {
  const prop = await db.collections.agents.findOne({ _id: ObjectId(req.params.id) });
  if (!prop) return res.status(404).json({ error: "Property not found" });
  res.send(prop);
});

// POST  /properties/:id/views
exports.incrementView = ctrl(async (req, res, db) => {
  await db.collections.agents.updateOne({ _id: ObjectId(req.params.id) }, { $inc: { views: 1 } });
  res.json({ success: true });
});

// GET  /properties/verified
exports.getVerified = ctrl(async (_req, res, db) => {
  const verified = await db.collections.agents.find({ verified: true }).toArray();
  res.send(verified);
});

// PATCH  /properties/verify/:id
exports.verifyProperty = ctrl(async (req, res, db) => {
  const { id } = req.params;
  const update = { $set: { status: "verified", verified: true } };
  const [aRes] = await Promise.all([
    db.collections.agents.updateOne({ _id: ObjectId(id) }, update),
    db.collections.property.updateOne({ _id: ObjectId(id) }, update),
  ]);
  if (aRes.matchedCount === 0) return res.status(404).send({ message: "Property not found" });
  res.send({ success: true, message: "Property verified successfully" });
});

// PATCH  /properties/reject/:id
exports.rejectProperty = ctrl(async (req, res, db) => {
  const { id } = req.params;
  const update = { $set: { status: "rejected", verified: false } };
  await Promise.all([
    db.collections.agents.updateOne({ _id: ObjectId(id) }, update),
    db.collections.property.updateOne({ _id: ObjectId(id) }, update),
  ]);
  res.send({ success: true, message: "Property rejected successfully" });
});

// PATCH  /properties/advertise/:id
exports.advertiseProperty = ctrl(async (req, res, db) => {
  const result = await db.collections.agents.updateOne(
    { _id: ObjectId(req.params.id) },
    { $set: { isAdvertised: true } }
  );
  res.send(result);
});

// GET  /propertiess/advertised
exports.getAdvertised = ctrl(async (_req, res, db) => {
  const advertised = await db.collections.agents
    .find({ isAdvertised: true, verified: true, status: "verified" })
    .sort({ createdAt: -1 })
    .limit(8)
    .toArray();
  const transformed = advertised.map((p) => ({
    _id: p._id,
    title: p.title,
    location: p.location,
    price: `${p.price.min} - ${p.price.max}`,
    image: p.imageUrl,
    verified: p.verified,
    agentName: p.agentName,
  }));
  res.send(transformed);
});

// GET  /wishlistProperty/:id
exports.getWishlistProperty = ctrl(async (req, res, db) => {
  const prop = await db.collections.agents.findOne({ _id: ObjectId(req.params.id) });
  if (!prop) return res.status(404).json({ error: "Property not found" });
  res.send(prop);
});
