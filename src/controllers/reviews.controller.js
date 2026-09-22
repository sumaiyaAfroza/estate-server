const { ObjectId } = require("mongodb");
const ctrl = (fn) => async (req, res, db) => {
  try {
    await fn(req, res, db);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  }
};

// GET  /reviews/latest
exports.getLatestReviews = ctrl(async (_req, res, db) => {
  const reviews = await db.collections.reviews.find().sort({ date: -1 }).limit(8).toArray();
  res.send(reviews);
});

// GET  /reviews?propertyId=
exports.getByProperty = ctrl(async (req, res, db) => {
  const { propertyId } = req.query;
  if (!propertyId) return res.status(400).json({ error: "propertyId query parameter is required" });
  const reviews = await db.collections.reviews.find({ propertyId }).sort({ date: -1 }).toArray();
  res.json(reviews);
});

// GET  /allReviews
exports.getAll = ctrl(async (_req, res, db) => {
  const reviews = await db.collections.reviews.find().toArray();
  res.send(reviews);
});

// POST  /reviews
exports.createReview = ctrl(async (req, res, db) => {
  const review = req.body;
  if (!review.propertyId || !review.comment || !review.reviewer || !review.email) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  review.date = new Date();
  const result = await db.collections.reviews.insertOne(review);
  res.status(201).json({ success: true, insertedId: result.insertedId, review });
});

// DELETE  /reviews/:id
exports.remove = ctrl(async (req, res, db) => {
  const result = await db.collections.reviews.deleteOne({ _id: ObjectId(req.params.id) });
  if (result.deletedCount === 1) res.send({ message: "Review deleted successfully" });
  else res.status(404).send({ message: "Review not found" });
});
