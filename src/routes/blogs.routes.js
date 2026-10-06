const express = require("express");
const router = express.Router();
const { verifyFirebaseToken, verifyAdmin } = require("../middlewares/auth");
const blogsCtrl = require("../controllers/blogs.controller");
const { ctrl } = require("../utils/ctrl");

// ─── Public endpoints ────────────────────────────────────────
// NOTE: static paths must be declared before the "/blogs/:slug" param route,
// otherwise "/blogs/categories" would be matched as slug="categories".
router.get("/blogs", ctrl(blogsCtrl.list));
router.get("/blogs/popular", ctrl(blogsCtrl.popular));
router.get("/blogs/categories", ctrl(blogsCtrl.getCategories));

// ─── Admin-only management endpoints ─────────────────────────
// Declared before "/blogs/:slug" for the same reason as above.
router.get("/blogs/manage", verifyFirebaseToken, verifyAdmin, ctrl(blogsCtrl.getAllIncludingDrafts));
router.get("/blogs/manage/:slug", verifyFirebaseToken, verifyAdmin, ctrl(blogsCtrl.getBySlugForAdmin));

// ─── Public single post (increments views) ───────────────────
router.get("/blogs/:slug", ctrl(blogsCtrl.getById));

// ─── Admin-only write endpoints ──────────────────────────────
router.post("/blogs", verifyFirebaseToken, verifyAdmin, ctrl(blogsCtrl.create));
router.put("/blogs/:slug", verifyFirebaseToken, verifyAdmin, ctrl(blogsCtrl.update));
router.patch("/blogs/:slug/status", verifyFirebaseToken, verifyAdmin, ctrl(blogsCtrl.updateStatus));
router.delete("/blogs/:slug", verifyFirebaseToken, verifyAdmin, ctrl(blogsCtrl.deletePost));

// ─── Admin dashboard alias ───────────────────────────────────
router.get("/dashboard/blogs", verifyFirebaseToken, verifyAdmin, ctrl(blogsCtrl.getAllIncludingDrafts));

module.exports = router;