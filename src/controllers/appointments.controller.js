const { ObjectId } = require("mongodb");
const ctrl = (fn) => async (req, res, db) => {
  try {
    await fn(req, res, db);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  }
};

// POST  /appointments
exports.create = ctrl(async (req, res, db) => {
  const appointment = req.body;
  appointment.createdAt = new Date();
  const result = await db.collections.appointments.insertOne(appointment);
  res.json({ success: true, insertedId: result.insertedId });
});

// GET  /appointments?email=
exports.getAll = ctrl(async (req, res, db) => {
  const { email } = req.query;
  const query = email ? { agentEmail: email } : {};
  const appointments = await db.collections.appointments.find(query).toArray();
  res.json(appointments);
});
