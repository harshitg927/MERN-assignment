// models/Task.js
const mongoose = require("mongoose");

/**
 * Task Schema
 * Represents a task within a project
 *
 * @field {String} title - Task title
 * @field {String} description - Task description
 * @field {ObjectId} project - Reference to the Project this task belongs to
 * @field {String} status - Current status of the task (must match a status in the project)
 * @field {ObjectId} assignee - Reference to the User assigned to this task
 * @field {Date} dueDate - When the task is due
 * @field {Array} comments - Collection of comments on this task
 * @field {Array} history - Task history tracking status changes, assignments, etc.
 * @field {Date} createdAt - When the task was created
 * @field {Date} updatedAt - When the task was last updated
 */
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: "To Do",
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    dueDate: {
      type: Date,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        text: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    history: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        action: {
          type: String,
          required: true,
          enum: [
            "created",
            "updated",
            "status_changed",
            "assigned",
            "commented",
          ],
        },
        oldValue: {
          type: mongoose.Schema.Types.Mixed,
        },
        newValue: {
          type: mongoose.Schema.Types.Mixed,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Validate task status against project statuses
taskSchema.pre("save", async function (next) {
  if (this.isNew || this.isModified("status")) {
    try {
      const Project = mongoose.model("Project");
      const project = await Project.findById(this.project);

      if (!project) {
        return next(new Error("Project not found"));
      }

      const validStatus = project.statuses.some((s) => s.name === this.status);
      if (!validStatus) {
        return next(
          new Error(
            `Invalid status: ${this.status}. Must be one of the project's defined statuses.`
          )
        );
      }

      // Record the status change in history if not a new task
      if (!this.isNew && this.isModified("status")) {
        this.history.push({
          action: "status_changed",
          oldValue: this._oldStatus,
          newValue: this.status,
          timestamp: Date.now(),
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Track old status for history
taskSchema.pre("findOneAndUpdate", function (next) {
  this._oldStatus = this.get("status");
  next();
});

// Track task creation in history
taskSchema.pre("save", function (next) {
  if (this.isNew) {
    this.history.push({
      user: this.creator,
      action: "created",
      newValue: this.title,
      timestamp: Date.now(),
    });
  }
  next();
});

// Track assignment changes in history
taskSchema.pre("save", function (next) {
  if (!this.isNew && this.isModified("assignee")) {
    this.history.push({
      action: "assigned",
      oldValue: this._oldAssignee,
      newValue: this.assignee,
      timestamp: Date.now(),
    });
  }
  next();
});

// Indexes for faster query performance
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignee: 1 });
taskSchema.index({ dueDate: 1 }, { sparse: true });

module.exports = mongoose.model("Task", taskSchema);
