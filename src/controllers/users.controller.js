const { ObjectId } = require("mongodb");
const ctrl = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  }
};
exports.ctrl = ctrl;

// ─── Users ───────────────────────────────────────────────

exports.markFraudById = ctrl(async (req, res, db) => {
  const { id } = req.params;
  await db.collections.users.updateOne({ _id: ObjectId(id) }, { $set: { fraud: true } });
  await db.collections.agents.deleteMany({ agentId: id });
  res.send({ message: "User marked as fraud and properties deleted" });
});

exports.markFraudByEmail = ctrl(async (req, res, db) => {
  const { email } = req.params;
  const session = db.client.startSession();
  try {
    await session.withTransaction(async () => {
      const userResult = await db.collections.users.updateOne(
        { email },
        { $set: { fraud: true, role: "user" } },
        { session }
      );
      if (userResult.matchedCount === 0) throw new Error("User not found");
      await db.collections.agents.deleteMany({ agentEmail: email }, { session });
    });
    res.send({ success: true });
  } finally {
    await session.endSession();
  }
});

exports.updateRoleById = ctrl(async (req, res, db) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!["admin", "agent", "user"].includes(role)) {
    return res.status(400).send({ message: "Invalid role" });
  }
  const result = await db.collections.users.updateOne({ _id: ObjectId(id) }, { $set: { role } });
  res.send({ message: `User role updated to ${role}`, result });
});

exports.updateRoleByEmail = ctrl(async (req, res, db) => {
  const { email } = req.params;
  const { role } = req.body;
  if (!["admin", "agent", "user"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  const result = await db.collections.users.updateOne({ email }, { $set: { role } });
  if (result.matchedCount === 0) {
    return res.status(404).json({ error: "User not found" });
  }
  res.send({ success: true });
});

exports.getRoleByEmail = ctrl(async (req, res, db) => {
  const { email } = req.params;
  if (!email) return res.status(400).send({ message: "email is required" });
  const user = await db.collections.users.findOne({ email });
  if (!user) return res.status(404).send({ message: "user not found" });
  res.send({ role: user.role || "user" });
});

exports.register = ctrl(async (req, res, db) => {
  const { email } = req.body;
  const existing = await db.collections.users.findOne({ email });
  if (existing) return res.status(200).send({ message: "user already exists" });
  const result = await db.collections.users.insertOne(req.body);
  res.send(result);
});

exports.getAllUsers = ctrl(async (req, res, db) => {
  const users = await db.collections.users.find().toArray();
  res.send(users);
});

exports.deleteUser = ctrl(async (req, res, db) => {
  const { id } = req.params;
  const result = await db.collections.users.deleteOne({ _id: ObjectId(id) });
  if (result.deletedCount === 0) return res.status(404).json({ error: "User not found" });
  res.send({ success: true });
});

exports.deleteFirebaseUser = ctrl(async (req, res, _db) => {
  const { email } = req.params;
  res.send({ success: true, message: `Firebase user ${email} would be deleted in production` });
});

exports.getProfile = ctrl(async (req, res, db) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Email required" });
  const user = await db.collections.users.findOne({ email });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ name: user.name, image: user.image, role: user.role, email: user.email, phone: user.phone || "" });
});
