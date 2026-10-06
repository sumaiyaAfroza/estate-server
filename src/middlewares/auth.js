const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");

/**
 * Resolve Firebase Admin credentials.
 *
 * Prefers a service-account JSON file (local dev), and falls back to
 * individual environment variables (typical for Vercel / CI). Keeping this
 * lazy means the server can boot and serve public routes even when
 * credentials are not present.
 */
function loadServiceAccount() {
  const keyPath = path.join(__dirname, "..", "..", "firebase-admin-key.json");
  if (fs.existsSync(keyPath)) {
    // eslint-disable-next-line global-require
    return require(keyPath);
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      // Vercel stores newlines escaped — restore them.
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  return null;
}

/** Initialise the Admin SDK once, on first use. Returns null if unconfigured. */
let firebaseReady = false;
function getFirebaseAuth() {
  if (!firebaseReady) {
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      console.warn(
        "[auth] Firebase credentials not found — authenticated routes will return 503."
      );
      return null;
    }
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    firebaseReady = true;
  }
  return admin.auth();
}

/**
 * Verify Firebase ID token from the Authorization header.
 * Sets req.decoded on success, sends 401 on failure.
 */
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    return res.status(503).send({ message: "authentication service unavailable" });
  }

  try {
    req.decoded = await auth.verifyIdToken(token);
    next();
  } catch (error) {
    res.status(401).send({ message: "invalid token" });
  }
};

/**
 * Verify the user has the admin role. Must be used after verifyFirebaseToken.
 * The role lives in MongoDB — Firebase ID tokens do not carry app roles.
 */
const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.decoded?.email;
    if (!email) return res.status(401).send({ message: "unauthorized access" });

    const db = req.db || req.app.locals.db;
    if (!db) return res.status(503).send({ message: "database unavailable" });

    const user = await db.collections.users.findOne({ email });
    if (!user || user.role !== "admin") {
      return res.status(403).send({ message: "forbidden access" });
    }
    next();
  } catch (error) {
    console.error("[verifyAdmin]", error);
    res.status(500).send({ message: "internal server error" });
  }
};

module.exports = { verifyFirebaseToken, verifyAdmin };