const { ObjectId } = require("mongodb");
const ctrl = (fn) => async (req, res, db) => {
  try {
    await fn(req, res, db);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  }
};

// POST /addProperty — insert into both agents and property collections
exports.addProperty = ctrl(async (req, res, db) => {
  const { title, location, imageUrl, agentEmail, price } = req.body;
  if (!title || !location || !imageUrl || !agentEmail || !price) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }
  if (typeof price !== "object" || !price.min || !price.max) {
    return res.status(400).json({ success: false, error: "Invalid price format" });
  }
  const data = { ...req.body, status: "pending", verified: false, createdAt: new Date() };
  const [aRes, pRes] = await Promise.all([
    db.collections.agents.insertOne(data),
    db.collections.property.insertOne(data),
  ]);
  res.status(201).json({ success: true, agentInsertedId: aRes.insertedId, propertyInsertedId: pRes.insertedId });
});

// GET  /myAddedProperty?email=…
exports.getMyProperties = ctrl(async (req, res, db) => {
  const { email } = req.query;
  if (!email) return res.status(400).send({ message: "Email query is required" });
  const result = await db.collections.agents.find({ agentEmail: email }).toArray();
  res.send(result);
});

// GET  /property/:id
exports.getPropertyById = ctrl(async (req, res, db) => {
  const result = await db.collections.agents.findOne({ _id: ObjectId(req.params.id) });
  res.send(result);
});

// PUT  /property/:id
exports.updateProperty = ctrl(async (req, res, db) => {
  const result = await db.collections.agents.updateOne(
    { _id: ObjectId(req.params.id) },
    { $set: { title: req.body.title, location: req.body.location, price: req.body.price, imageUrl: req.body.imageUrl } }
  );
  res.send(result);
});

// DELETE  /property/:id
exports.deleteProperty = ctrl(async (req, res, db) => {
  const result = await db.collections.agents.deleteOne({ _id: ObjectId(req.params.id) });
  res.send(result);
});

// GET  /sold-properties?agentEmail=…
exports.getSoldProperties = ctrl(async (req, res, db) => {
  const { agentEmail } = req.query;
  const sold = await db.collections.offers.find({ agentEmail, status: "bought" }).toArray();
  res.send(sold);
});
