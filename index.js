require("dotenv").config();
const express = require("express");
const cors = require("cors");

// MVC modules
const { connect } = require("./src/config/db");
// Requiring the auth middleware initialises the Firebase Admin SDK (once).
require("./src/middlewares/auth");
const usersRoutes = require("./src/routes/users.routes");
const agentsRoutes = require("./src/routes/agents.routes");
const propertiesRoutes = require("./src/routes/properties.routes");
const reviewsRoutes = require("./src/routes/reviews.routes");
const offersRoutes = require("./src/routes/offers.routes");
const wishlistRoutes = require("./src/routes/wishlist.routes");
const appointmentsRoutes = require("./src/routes/appointments.routes");
const paymentsRoutes = require("./src/routes/payments.routes");
const blogsRoutes = require("./src/routes/blogs.routes");

// ─── Express app ─────────────────────────────────────────────
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Database access ─────────────────────────────────────────
// Connect lazily and share a single promise. On serverless platforms a request
// can arrive before the initial connect() resolves, so the middleware awaits
// the promise instead of reading a possibly-empty app.locals.db.
let dbPromise = null;
const getDb = () => {
  if (!dbPromise) {
    dbPromise = connect()
      .then(({ db, client, collections }) => {
        // Keep the raw db for ping/introspection and the collections map for
        // controllers, matching how connect() exposes them.
        const handle = { db, client, collections };
        app.locals.db = handle;
        return handle;
      })
      .catch((err) => {
        dbPromise = null; // allow a later request to retry
        throw err;
      });
  }
  return dbPromise;
};

app.use(async (req, res, next) => {
  try {
    req.db = await getDb();
    next();
  } catch (err) {
    console.error("[db middleware]", err);
    res.status(503).json({ error: "database unavailable" });
  }
});

// ─── Mount routes ────────────────────────────────────────────
app.use("/", usersRoutes);
app.use("/", agentsRoutes);
app.use("/", propertiesRoutes);
app.use("/", reviewsRoutes);
app.use("/", offersRoutes);
app.use("/", wishlistRoutes);
app.use("/", appointmentsRoutes);
app.use("/", paymentsRoutes);
app.use("/", blogsRoutes);

app.get("/", (_req, res) => res.send("hello estate properties"));

// ─── Start server ────────────────────────────────────────────
// Only bind a port when running as a long-lived process. On Vercel the
// platform imports the app and handles requests itself.
if (process.env.VERCEL !== "1") {
  start();
}

async function start() {
  const { client } = await getDb();

  // Ping via the client — a Db instance has no .db() method.
  await client.db("admin").command({ ping: 1 });
  console.log("Pinged your deployment. You successfully connected to MongoDB!");

  app.listen(port, () => {
    console.log(`server ok, ${port}`);
  });
}

module.exports = app;