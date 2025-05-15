// routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const { validateRequest } = require("../middleware/validator");
const { protect } = require("../middleware/auth");
const {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} = require("../controllers/notificationController");

// Get all notifications for the current user
router.get("/", protect, getUserNotifications);

// Mark a notification as read
router.put(
  "/:notificationId/read",
  protect,
  [
    check(
      "notificationId",
      "Notification ID must be a valid MongoDB ID"
    ).isMongoId(),
  ],
  validateRequest,
  markNotificationAsRead
);

// Mark all notifications as read
router.put("/read-all", protect, markAllNotificationsAsRead);

// Delete a notification
router.delete(
  "/:notificationId",
  protect,
  [
    check(
      "notificationId",
      "Notification ID must be a valid MongoDB ID"
    ).isMongoId(),
  ],
  validateRequest,
  deleteNotification
);

module.exports = router;
