// routes/taskRoutes.js
const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const { validateRequest } = require("../middleware/validator");
const { protect, projectAccess } = require("../middleware/auth");
const {
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  addTaskComment,
} = require("../controllers/taskController");

// Create a new task
router.post(
  "/",
  protect,
  [
    check("title", "Title is required").not().isEmpty(),
    check("title", "Title must be between 3 and 100 characters").isLength({
      min: 3,
      max: 100,
    }),
    check("project", "Project ID is required").not().isEmpty(),
    check("project", "Project ID must be a valid MongoDB ID").isMongoId(),
  ],
  validateRequest,
  projectAccess,
  createTask
);

// Get a task by ID
router.get("/:taskId", protect, getTaskById);

// Update a task
router.put(
  "/:taskId",
  protect,
  [
    check("title", "Title must be between 3 and 100 characters")
      .optional()
      .isLength({ min: 3, max: 100 }),
    check("priority", "Priority must be low, medium, high, or urgent")
      .optional()
      .isIn(["low", "medium", "high", "urgent"]),
  ],
  validateRequest,
  updateTask
);

// Delete a task
router.delete("/:taskId", protect, deleteTask);

// Add a comment to a task
router.post(
  "/:taskId/comments",
  protect,
  [check("text", "Comment text is required").not().isEmpty()],
  validateRequest,
  addTaskComment
);

module.exports = router;
