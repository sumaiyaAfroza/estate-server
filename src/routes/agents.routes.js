const express = require("express");
const router = express.Router();
const { verifyFirebaseToken } = require("../../middlewares/auth");
const agentsCtrl = require("../../controllers/agents.controller");
const { ctrl } = require("../../controllers/agents.controller");

// Add property (public — form sends data with metadata)
router.post("/addProperty", ctrl(agentsCtrl.addProperty));

// My added properties (authenticated agent)
router.get("/myAddedProperty", verifyFirebaseToken, ctrl(agentsCtrl.getMyProperties));

// Property CRUD by id
router.get("/property/:id", ctrl(agentsCtrl.getPropertyById));
router.put("/property/:id", ctrl(agentsCtrl.updateProperty));
router.delete("/property/:id", ctrl(agentsCtrl.deleteProperty));

// Sold properties for agent
router.get("/sold-properties", verifyFirebaseToken, ctrl(agentsCtrl.getSoldProperties));

module.exports = router;
