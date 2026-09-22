require("dotenv").config();
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-admin-key.json");

// MVC modules
const { connect } = require("./src/config/db");
const { verifyFirebaseToken } = require("./src/middlewares/auth");
const usersRoutes = require("./src/routes/users.routes");
const agentsRoutes = require("./src/routes/agents.routes");
const propertiesRoutes = require("./src/routes/properties.routes");
const reviewsRoutes = require("./src/routes/reviews.routes");
const offersRoutes = require("./src/routes/offers.routes");
const wishlistRoutes = require("./src/routes/wishlist.routes");
const appointmentsRoutes = require("./src/routes/appointments.routes");
const paymentsRoutes = require("./src/routes/payments.routes");

// ─── Firebase Admin SDK ──────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ─── Express app ─────────────────────────────────────────────
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Mount routes ────────────────────────────────────────────
app.use("/", usersRoutes);
app.use("/", agentsRoutes);
app.use("/", propertiesRoutes);
app.use("/", reviewsRoutes);
app.use("/", offersRoutes);
app.use("/", wishlistRoutes);
app.use("/", appointmentsRoutes);
app.use("/", paymentsRoutes);

app.get("/", (req, res) => res.send("hello estate properties"));

// ─── Start server ────────────────────────────────────────────
async function start() {
  const { db, client } = await connect();
  // Attach collections and client to app locals for controllers that need them
  app.locals.db = { collections: db, client };

  // Ping MongoDB to verify connection
  await db.db("admin").command({ ping: 1 });
  console.log("Pinged your deployment. You successfully connected to MongoDB!");

  app.listen(port, () => {
    console.log(`server ok, ${port}`);
  });
}

start().catch(console.dir);
