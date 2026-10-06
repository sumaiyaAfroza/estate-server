const express = require("express");
const router = express.Router();
const { verifyFirebaseToken, verifyAdmin } = require("../../middlewares/auth");
const blogsCtrl = require("../../controllers/blogs.controller");
const { ctrl } = require("../../controllers/blogs.controller");

// Public endpoints
router.get("/blogs", ctrl(blogsCtrl.list));
router.get("/blogs/popular", ctrl(blogsCtrl.popular));
router.get("/blogs/:slug", ctrl(blogsCtrl.getById));
router.get("/blogs/categories", ctrl(blogsCtrl.getCategories));

// Authenticated endpoints
router.post("/blogs", verifyFirebaseToken, ctrl(blogsCtrl.create));
router.put("/blogs/:slug", verifyFirebaseToken, ctrl(blogsCtrl.update));
router.patch("/blogs/:slug/status", verifyFirebaseToken, ctrl(blogsCtrl.updateStatus));

// Admin-only endpoints
router.get("/dashboard/blogs", verifyFirebaseToken, verifyAdmin, ctrl(blogsCtrl.getAllIncludingDrafts));
router.delete("/blogs/:slug", verifyFirebaseToken, verifyAdmin, ctrl(blogsCtrl.deletePost));

module.exports = router;



// hlw blog