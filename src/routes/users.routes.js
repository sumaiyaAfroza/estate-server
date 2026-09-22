const express = require("express");
const router = express.Router();
const { verifyFirebaseToken, verifyAdmin } = require("../../middlewares/auth");
const usersCtrl = require("../../controllers/users.controller");
const { ctrl } = require("../../controllers/users.controller");

// Admin-only routes
router.patch("/users/:id/fraud", verifyFirebaseToken, ctrl(usersCtrl.markFraudById));
router.patch("/users/:email/fraud", verifyFirebaseToken, ctrl(usersCtrl.markFraudByEmail));
router.patch("/users/:id/role", verifyFirebaseToken, ctrl(usersCtrl.updateRoleById));
router.get("/users", verifyFirebaseToken, verifyAdmin, ctrl(usersCtrl.getAllUsers));

// Public / authenticated routes
router.post("/users", ctrl(usersCtrl.register));
router.get("/users/:email/role", ctrl(usersCtrl.getRoleByEmail));
router.get("/profile", ctrl(usersCtrl.getProfile));
router.patch("/users/:email/role", ctrl(usersCtrl.updateRoleByEmail));
router.delete("/users/:id", ctrl(usersCtrl.deleteUser));
router.delete("/firebaseUser/:email", ctrl(usersCtrl.deleteFirebaseUser));

module.exports = router;
