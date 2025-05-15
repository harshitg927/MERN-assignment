// controllers/authController.js
const asyncHandler = require("express-async-handler");
const { verifyIdToken } = require("../config/firebase");
const User = require("../models/User");

/**
 * @desc    Login/Register user with Firebase token
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = asyncHandler(async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    res.status(400);
    throw new Error("Firebase ID token is required");
  }

  try {
    // Verify token with Firebase Admin SDK
    const decodedToken = await verifyIdToken(idToken);

    // Find user by Firebase UID
    let user = await User.findOne({ firebaseUid: decodedToken.uid });

    // If user doesn't exist, create a new one
    if (!user) {
      user = await User.create({
        name: decodedToken.name || decodedToken.email.split("@")[0],
        email: decodedToken.email,
        firebaseUid: decodedToken.uid,
        avatarUrl: decodedToken.picture || "",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          badges: user.badges,
        },
      },
    });
  } catch (error) {
    res.status(401);
    throw new Error(`Authentication failed: ${error.message}`);
  }
});

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("-__v");

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        badges: user.badges,
      },
    },
  });
});

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/me
 * @access  Private
 */
const updateUserProfile = asyncHandler(async (req, res) => {
  const { name, avatarUrl } = req.body;

  // Find the user
  const user = await User.findById(req.user.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Update fields if provided
  if (name) user.name = name;
  if (avatarUrl) user.avatarUrl = avatarUrl;

  // Save the updated user
  const updatedUser = await user.save();

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatarUrl,
        badges: updatedUser.badges,
      },
    },
  });
});

module.exports = {
  loginUser,
  getCurrentUser,
  updateUserProfile,
};
