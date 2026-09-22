const express = require("express");
const router = express.Router();
const { verifyFirebaseToken } = require("../../middlewares/auth");
const revCtrl = require("../../controllers/reviews.controller");
const { ctrl } = require("../../controllers/reviews.controller");

router.get("/reviews/latest", ctrl(revCtrl.getLatestReviews));
router.get("/reviews", ctrl(revCtrl.getByProperty));
router.get("/allReviews", ctrl(revCtrl.getAll));
router.post("/reviews", ctrl(revCtrl.createReview));
router.delete("/reviews/:id", ctrl(revCtrl.remove));

// Authenticated user own reviews
router.get("/myReviews", verifyFirebaseToken, async (req, res, db) => {
  const email = req.query.email;
  if (req.decoded.email !== email) {
    return res.status(403).send({ message: "forbidden access" });
  }
  const reviews = await db.collections.reviews.find({ email }).sort({ date: -1 }).toArray();
  res.send(reviews);
});

module.exports = router;
