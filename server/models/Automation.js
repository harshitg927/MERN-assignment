// models/Automation.js
const mongoose = require("mongoose");

/**
 * Automation Schema
 * Represents an automation rule for project workflow
 *
 * @field {ObjectId} project - Reference to the Project this automation belongs to
 * @field {String} name - Name of the automation rule
 * @field {Object} trigger - What triggers this automation
 * @field {Object} action - What action should occur when triggered
 * @field {ObjectId} creator - User who created this automation
 * @field {Boolean} active - Whether this automation is currently active
 * @field {Date} createdAt - When the automation was created
 * @field {Date} updatedAt - When the automation was last updated
 */
const automationSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Automation name is required"],
      trim: true,
    },
    trigger: {
      type: {
        type: String,
        required: true,
        enum: [
          "task_status_changed",
          "task_assigned",
          "task_due_date_passed",
          "task_created",
          "task_updated",
        ],
      },
      condition: {
        field: { type: String },
        operator: { type: String },
        value: { type: mongoose.Schema.Types.Mixed },
      },
    },
    action: {
      type: {
        type: String,
        required: true,
        enum: [
          "assign_badge",
          "change_status",
          "assign_user",
          "send_notification",
        ],
      },
      params: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
      },
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    executionCount: {
      type: Number,
      default: 0,
    },
    lastExecuted: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Validation for trigger conditions
automationSchema.path("trigger").validate(function (trigger) {
  // Different validation based on trigger type
  switch (trigger.type) {
    case "task_status_changed":
      return (
        trigger.condition &&
        trigger.condition.value &&
        typeof trigger.condition.value === "string"
      );

    case "task_assigned":
      return (
        trigger.condition &&
        trigger.condition.value &&
        mongoose.Types.ObjectId.isValid(trigger.condition.value)
      );

    case "task_due_date_passed":
      return true; // No additional validation needed

    default:
      return true;
  }
}, "Invalid trigger condition for the specified trigger type");

// Validation for action parameters
automationSchema.path("action").validate(function (action) {
  // Different validation based on action type
  switch (action.type) {
    case "assign_badge":
      return (
        action.params &&
        action.params.badgeName &&
        typeof action.params.badgeName === "string"
      );

    case "change_status":
      return (
        action.params &&
        action.params.status &&
        typeof action.params.status === "string"
      );

    case "assign_user":
      return (
        action.params &&
        action.params.userId &&
        mongoose.Types.ObjectId.isValid(action.params.userId)
      );

    case "send_notification":
      return (
        action.params &&
        action.params.message &&
        typeof action.params.message === "string"
      );

    default:
      return true;
  }
}, "Invalid action parameters for the specified action type");

// Example of how an automation record would look:
// {
//   project: ObjectId("..."),
//   name: "Auto-move to In Progress",
//   trigger: {
//     type: "task_assigned",
//     condition: { value: ObjectId("user_id_here") }
//   },
//   action: {
//     type: "change_status",
//     params: { status: "In Progress" }
//   }
// }

// Indexes for faster query performance
automationSchema.index({ project: 1 });
automationSchema.index({ "trigger.type": 1 });

module.exports = mongoose.model("Automation", automationSchema);
