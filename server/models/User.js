// models/User.js
const mongoose = require("mongoose");

/**
 * User Schema
 * Stores user information including authentication details and profile
 *
 * @field {String} name - User's full name
 * @field {String} email - User's email address (unique)
 * @field {String} firebaseUid - Firebase User ID for OAuth authentication
 * @field {String} avatarUrl - URL to user's profile picture
 * @field {Array} badges - Collection of badges earned by completing tasks
 * @field {Date} createdAt - When the user account was created
 * @field {Date} updatedAt - When the user account was last updated
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    badges: [
      {
        name: {
          type: String,
          required: true,
        },
        description: {
          type: String,
        },
        awardedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index for faster query performance
userSchema.index({ email: 1 });
userSchema.index({ firebaseUid: 1 });

module.exports = mongoose.model("User", userSchema);
