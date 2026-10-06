/**
 * Shared controller wrapper.
 *
 * Express invokes route handlers as (req, res, next) — it never passes a `db`
 * argument. The database handle is attached to `req.db` by a middleware in
 * index.js, so we must read it from the request rather than expecting a
 * third parameter.
 */
const ctrl = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, req.db);
  } catch (err) {
    console.error("[controller error]", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "internal server error" });
  }
};

module.exports = { ctrl };