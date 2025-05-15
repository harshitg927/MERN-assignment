// models/Project.js
const mongoose = require("mongoose");

/**
 * Project Schema
 * Represents a collaborative project containing tasks
 *
 * @field {String} title - Project title
 * @field {String} description - Project description
 * @field {ObjectId} owner - Reference to the User who created the project
 * @field {Array} members - Collection of Users who have access to the project
 * @field {Array} statuses - Custom task statuses for this project
 * @field {Date} createdAt - When the project was created
 * @field {Date} updatedAt - When the project was last updated
 */
const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Project title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["owner", "editor", "viewer"],
          default: "editor",
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    statuses: {
      type: [
        {
          name: {
            type: String,
            required: true,
            trim: true,
          },
          order: {
            type: Number,
            required: true,
          },
        },
      ],
      default: [
        { name: "To Do", order: 1 },
        { name: "In Progress", order: 2 },
        { name: "Done", order: 3 },
      ],
      validate: [
        (arr) => arr.length >= 1,
        "Project must have at least one status",
      ],
    },
  },
  {
    timestamps: true,
  }
);

// Add the project owner to members array before saving
projectSchema.pre("save", function (next) {
  // Check if this is a new project or owner is not in members
  const ownerExists = this.members.some(
    (member) => member.user.toString() === this.owner.toString()
  );

  if (!ownerExists) {
    this.members.push({
      user: this.owner,
      role: "owner",
      addedAt: Date.now(),
    });
  }
  next();
});

// Indexes for faster query performance
projectSchema.index({ owner: 1 });
projectSchema.index({ "members.user": 1 });

module.exports = mongoose.model("Project", projectSchema);
