// routes/automationRoutes.js
const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const { validateRequest } = require("../middleware/validator");
const { protect, projectAccess, projectOwner } = require("../middleware/auth");
const {
  createAutomation,
  getProjectAutomations,
  getAutomationById,
  updateAutomation,
  deleteAutomation,
  toggleAutomation,
} = require("../controllers/automationController");

// Create a new automation
router.post(
  "/",
  protect,
  [
    check("project", "Project ID is required").not().isEmpty(),
    check("project", "Project ID must be a valid MongoDB ID").isMongoId(),
    check("name", "Automation name is required").not().isEmpty(),
    check("trigger.type", "Trigger type is required").not().isEmpty(),
    check("action.type", "Action type is required").not().isEmpty(),
    check("action.params", "Action parameters are required").not().isEmpty(),
  ],
  validateRequest,
  projectAccess,
  createAutomation
);

// Get all automations for a project
router.get(
  "/project/:projectId",
  protect,
  projectAccess,
  getProjectAutomations
);

// Get a single automation by ID
router.get("/:automationId", protect, getAutomationById);

// Update an automation
router.put(
  "/:automationId",
  protect,
  [
    check("name", "Automation name must be at least 3 characters")
      .optional()
      .isLength({ min: 3 }),
  ],
  validateRequest,
  updateAutomation
);

// Delete an automation
router.delete("/:automationId", protect, deleteAutomation);

// Toggle automation active state
router.put("/:automationId/toggle", protect, toggleAutomation);

module.exports = router;
