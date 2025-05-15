// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const { validateRequest } = require("../middleware/validator");
const { protect } = require("../middleware/auth");
const {
  loginUser,
  getCurrentUser,
  updateUserProfile,
} = require("../controllers/authController");

// Login/Register user with Firebase token
router.post(
  "/login",
  [check("idToken", "Firebase ID token is required").not().isEmpty()],
  validateRequest,
  loginUser
);

// Get current user profile
router.get("/me", protect, getCurrentUser);

// Update user profile
router.put(
  "/me",
  protect,
  [
    check("name", "Name must be at least 2 characters")
      .optional()
      .isLength({ min: 2 }),
  ],
  validateRequest,
  updateUserProfile
);

module.exports = router;
