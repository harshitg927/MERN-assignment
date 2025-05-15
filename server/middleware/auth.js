// middleware/auth.js
const { verifyIdToken } = require("../config/firebase");
const User = require("../models/User");
const asyncHandler = require("express-async-handler");

/**
 * Authentication middleware
 * Verifies the Firebase token from the Authorization header
 * and attaches the user to the request object
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Get token from Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Extract the token
      token = req.headers.authorization.split(" ")[1];

      // Verify the token with Firebase
      const decodedToken = await verifyIdToken(token);

      // Find or create the user in our database
      let user = await User.findOne({ firebaseUid: decodedToken.uid });

      // If user doesn't exist in our DB but exists in Firebase, create them
      if (!user && decodedToken.email) {
        user = await User.create({
          name: decodedToken.name || decodedToken.email.split("@")[0],
          email: decodedToken.email,
          firebaseUid: decodedToken.uid,
          avatarUrl: decodedToken.picture || "",
        });
      }

      if (!user) {
        res.status(401);
        throw new Error("User not found");
      }

      // Add user to request object
      req.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        firebaseUid: user.firebaseUid,
      };

      next();
    } catch (error) {
      console.error("Authentication error:", error);
      res.status(401);
      throw new Error("Not authorized, token failed");
    }
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
});

/**
 * Project access middleware
 * Verifies that the authenticated user has access to the requested project
 * Must be used after the protect middleware
 */
const projectAccess = asyncHandler(async (req, res, next) => {
  try {
    const Project = require("../models/Project");
    const projectId = req.params.projectId || req.body.project;

    if (!projectId) {
      res.status(400);
      throw new Error("Project ID is required");
    }

    const project = await Project.findById(projectId);

    if (!project) {
      res.status(404);
      throw new Error("Project not found");
    }

    // Check if user is a member of the project
    const isMember = project.members.some(
      (member) => member.user.toString() === req.user.id.toString()
    );

    if (!isMember) {
      res.status(403);
      throw new Error("Access denied: You are not a member of this project");
    }

    // Add project to request object
    req.project = project;

    next();
  } catch (error) {
    if (error.message.includes("Cast to ObjectId failed")) {
      res.status(400);
      throw new Error("Invalid project ID format");
    }
    next(error);
  }
});

/**
 * Project owner middleware
 * Verifies that the authenticated user is the owner of the requested project
 * Must be used after the protect middleware
 */
const projectOwner = asyncHandler(async (req, res, next) => {
  try {
    const Project = require("../models/Project");
    const projectId = req.params.projectId || req.body.project;

    if (!projectId) {
      res.status(400);
      throw new Error("Project ID is required");
    }

    const project = await Project.findById(projectId);

    if (!project) {
      res.status(404);
      throw new Error("Project not found");
    }

    // Check if user is the owner of the project
    if (project.owner.toString() !== req.user.id.toString()) {
      res.status(403);
      throw new Error(
        "Access denied: Only the project owner can perform this action"
      );
    }

    // Add project to request object
    req.project = project;

    next();
  } catch (error) {
    if (error.message.includes("Cast to ObjectId failed")) {
      res.status(400);
      throw new Error("Invalid project ID format");
    }
    next(error);
  }
});

module.exports = { protect, projectAccess, projectOwner };
