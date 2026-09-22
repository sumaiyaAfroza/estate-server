const admin = require("firebase-admin");
const serviceAccount = require("../../firebase-admin-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/**
 * Verify Firebase ID token from Authorization header.
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
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    next();
  } catch (error) {
    res.status(401).send({ message: "invalid token" });
  }
};

/**
 * Verify user has admin role. Must be used after verifyFirebaseToken.
 */
const verifyAdmin = async (req, res, next) => {
  const { collections } = req.app.locals.db;
  const email = req.decoded.email;
  const user = await collections.users.findOne({ email });
  if (!user || user.role !== "admin") {
    return res.status(403).send({ message: "forbidden access" });
  }
  next();
};

module.exports = { verifyFirebaseToken, verifyAdmin };
