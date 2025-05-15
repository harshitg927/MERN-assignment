// routes/projectRoutes.js
const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const { validateRequest } = require("../middleware/validator");
const { protect, projectAccess, projectOwner } = require("../middleware/auth");
const {
  createProject,
  getUserProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  updateMemberRole,
} = require("../controllers/projectController");
const { getProjectTasks } = require("../controllers/taskController");

// Create a new project
router.post(
  "/",
  protect,
  [
    check("title", "Title is required").not().isEmpty(),
    check("title", "Title must be between 3 and 100 characters").isLength({
      min: 3,
      max: 100,
    }),
  ],
  validateRequest,
  createProject
);

// Get all projects for the current user
router.get("/", protect, getUserProjects);

// Get a single project by ID
router.get("/:projectId", protect, projectAccess, getProjectById);

// Get all tasks for a project
router.get("/:projectId/tasks", protect, projectAccess, getProjectTasks);

// Update a project
router.put(
  "/:projectId",
  protect,
  projectOwner,
  [
    check("title", "Title must be between 3 and 100 characters")
      .optional()
      .isLength({ min: 3, max: 100 }),
  ],
  validateRequest,
  updateProject
);

// Delete a project
router.delete("/:projectId", protect, projectOwner, deleteProject);

// Add a member to project
router.post(
  "/:projectId/members",
  protect,
  projectOwner,
  [
    check("email", "Valid email is required").isEmail(),
    check("role", "Role must be either editor or viewer")
      .optional()
      .isIn(["editor", "viewer"]),
  ],
  validateRequest,
  addProjectMember
);

// Remove a member from project
router.delete(
  "/:projectId/members/:userId",
  protect,
  projectOwner,
  removeProjectMember
);

// Update a member's role
router.put(
  "/:projectId/members/:userId",
  protect,
  projectOwner,
  [
    check("role", "Role must be either editor or viewer").isIn([
      "editor",
      "viewer",
    ]),
  ],
  validateRequest,
  updateMemberRole
);

module.exports = router;
