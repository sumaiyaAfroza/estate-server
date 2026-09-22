const { ObjectId } = require("mongodb");
const ctrl = (fn) => async (req, res, db) => {
  try {
    await fn(req, res, db);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  }
};

// POST  /wishlist
exports.add = ctrl(async (req, res, db) => {
  const item = req.body;
  const { email, propertyId } = item;
  const existing = await db.collections.wishList.findOne({ email, propertyId: ObjectId(propertyId) });
  if (existing) {
    return res.status(400).send({ success: false, message: "Sorry, this property is already in your wishlist." });
  }
  item.propertyId = ObjectId(propertyId);
  const result = await db.collections.wishList.insertOne(item);
  res.send({ success: true, message: "Added to wishlist successfully.", data: result });
});

// GET  /wishlist?email=
exports.getByEmail = ctrl(async (req, res, db) => {
  const { email } = req.query;
  const result = await db.collections.wishList.find({ userEmail: email }).toArray();
  res.send(result);
});

// DELETE  /wishlist/:id
exports.remove = ctrl(async (req, res, db) => {
  const result = await db.collections.wishList.deleteOne({ _id: ObjectId(req.params.id) });
  res.send(result);
});
