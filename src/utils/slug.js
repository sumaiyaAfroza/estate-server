/**
 * Generate URL-friendly slug from a title string.
 * "Dhaka Real Estate Market 2025" → "dhaka-real-estate-market-2025"
 */
const makeSlug = (title) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

/**
 * Ensure slug uniqueness by appending a suffix if already taken.
 */
const uniqueSlug = async (db, title, excludeId) => {
  let slug = makeSlug(title);
  const existing = await db.collections.blogs.findOne({ slug });
  if (!existing) return slug;
  // Append timestamp to guarantee uniqueness
  return `${slug}-${Date.now().toString(36)}`;
};

module.exports = { makeSlug, uniqueSlug };
