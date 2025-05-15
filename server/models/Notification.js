// models/Notification.js
const mongoose = require("mongoose");

/**
 * Notification Schema
 * Represents a notification sent to a user
 *
 * @field {ObjectId} recipient - Reference to the User receiving this notification
 * @field {String} type - Type of notification (task, project, automation, etc.)
 * @field {String} message - Notification message content
 * @field {ObjectId} relatedProject - Reference to related Project if applicable
 * @field {ObjectId} relatedTask - Reference to related Task if applicable
 * @field {Boolean} read - Whether the notification has been read
 * @field {Date} createdAt - When the notification was created
 */
const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: [
      "task_assignment",
      "task_status_change",
      "task_comment",
      "project_invitation",
      "due_date_reminder",
      "automation_triggered",
    ],
  },
  message: {
    type: String,
    required: true,
  },
  relatedProject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
  },
  relatedTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Task",
  },
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000, // Automatically delete notifications after 30 days (in seconds)
  },
});

// Indexes for faster query performance
notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ createdAt: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
