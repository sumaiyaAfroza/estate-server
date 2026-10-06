const { ObjectId } = require("mongodb");
const { uniqueSlug } = require("../utils/slug");

const ctrl = (fn) => async (req, res, db) => {
  try {
    await fn(req, res, db);
  } catch (err) {
    console.error("[blog controller error]", err);
    res.status(500).json({ error: "internal server error" });
  }
};

// ─── POST /blogs — create a new blog post (admin only) ───────────────────────
exports.create = ctrl(async (req, res, db) => {
  const raw = req.body;
  const { title, content, excerpt, coverImage, category, tags, status } = raw;

  if (!title || !content) {
    return res.status(400).json({ error: "title and content are required" });
  }
  if (status && !["draft", "published", "archived"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const slug = await uniqueSlug(db, title, raw._id);
  const now = new Date();

  const doc = {
    title,
    slug,
    content,
    excerpt: excerpt || "",
    coverImage: coverImage || "",
    category: category || "general",
    tags: tags || [],
    authorName: req.decoded.name || req.decoded.email,
    authorEmail: req.decoded.email,
    views: 0,
    status: status || "draft",
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.blogs.insertOne(doc);
  res.status(201).json({ success: true, insertedId: result.insertedId, slug });
});

// ─── GET /blogs — list published posts (public + filters) ────────────────────
exports.list = ctrl(async (req, res, db) => {
  const { category, search, page = 1, limit = 12 } = req.query;
  const query = { status: "published" };
  if (category) query.category = category;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { excerpt: { $regex: search, $options: "i" } },
      { tags: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [posts, total] = await Promise.all([
    db.blogs.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).toArray(),
    db.blogs.countDocuments(query),
  ]);
  res.json({ data: posts, total, page: Number(page), totalPages: Math.ceil(total / limit) });
});

// ─── GET /blogs/popular — top viewed posts ───────────────────────────────────
exports.popular = ctrl(async (_req, res, db) => {
  const posts = await db.blogs
    .find({ status: "published" })
    .sort({ views: -1 })
    .limit(5)
    .project({ title: 1, slug: 1, coverImage: 1, category: 1, views: 1, excerpt: 1 })
    .toArray();
  res.json(posts);
});

// ─── GET /blogs/:slug — single post detail (increments view count) ───────────
exports.getById = ctrl(async (req, res, db) => {
  const { slug } = req.params;
  const post = await db.blogs.findOne({ slug, status: "published" });
  if (!post) return res.status(404).json({ error: "Post not found" });

  // Increment view count atomically
  await db.blogs.updateOne({ _id: post._id }, { $inc: { views: 1 } });

  // Find related posts (same category, exclude current)
  const related = await db.blogs
    .find({ category: post.category, slug: { $ne: slug }, status: "published" })
    .sort({ createdAt: -1 })
    .limit(3)
    .project({ title: 1, slug: 1, coverImage: 1, createdAt: 1 })
    .toArray();

  res.json({ ...post, relatedPosts: related });
});

// Also support fetching draft posts for admin
exports.getAllIncludingDrafts = ctrl(async (req, res, db) => {
  const { status, page = 1, limit = 20 } = req.query;
  const query = status ? { status } : {};
  const skip = (Number(page) - 1) * Number(limit);
  const [posts, total] = await Promise.all([
    db.blogs.find(query).sort({ updatedAt: -1 }).skip(skip).limit(Number(limit)).toArray(),
    db.blogs.countDocuments(query),
  ]);
  res.json({ data: posts, total, page: Number(page), totalPages: Math.ceil(total / limit) });
});

// ─── PUT /blogs/:slug — update a post (author only) ──────────────────────────
exports.update = ctrl(async (req, res, db) => {
  const { slug } = req.params;
  const { content, excerpt, coverImage, category, tags, status } = req.body;
  const authorEmail = req.decoded.email;

  const existing = await db.blogs.findOne({ slug });
  if (!existing) return res.status(404).json({ error: "Post not found" });
  if (existing.authorEmail !== authorEmail && req.decoded.role !== "admin") {
    return res.status(403).json({ error: "You can only edit your own posts" });
  }

  const updated = {
    ...(content !== undefined && { content }),
    ...(excerpt !== undefined && { excerpt }),
    ...(coverImage !== undefined && { coverImage }),
    ...(category !== undefined && { category }),
    ...(tags !== undefined && { tags }),
    ...(status !== undefined && { status }),
    updatedAt: new Date(),
  };

  await db.blogs.updateOne({ slug }, { $set: updated });
  res.json({ success: true });
});

// ─── PATCH /blogs/:slug/status — change status (admin only) ──────────────────
exports.updateStatus = ctrl(async (req, res, db) => {
  const { slug } = req.params;
  const { status } = req.body;
  if (!["draft", "published", "archived"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const result = await db.blogs.updateOne(
    { slug },
    { $set: { status, updatedAt: new Date() } }
  );
  if (result.matchedCount === 0) return res.status(404).json({ error: "Post not found" });
  res.json({ success: true });
});

// ─── DELETE /blogs/:slug — delete post (admin only) ──────────────────────────
exports.deletePost = ctrl(async (req, res, db) => {
  const { slug } = req.params;
  const result = await db.blogs.deleteOne({ slug });
  if (result.deletedCount === 0) return res.status(404).json({ error: "Post not found" });
  res.json({ success: true });
});

// ─── GET /blogs/categories — list all categories with counts ─────────────────
exports.getCategories = ctrl(async (_req, res, db) => {
  const pipeline = [
    { $match: { status: "published" } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ];
  const cats = await db.blogs.aggregate(pipeline).toArray();
  res.json(cats);
});
