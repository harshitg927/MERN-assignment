// controllers/notificationController.js
const asyncHandler = require("express-async-handler");
const Notification = require("../models/Notification");

/**
 * @desc    Get all notifications for the current user
 * @route   GET /api/notifications
 * @access  Private
 */
const getUserNotifications = asyncHandler(async (req, res) => {
  // Pagination options
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;
  const readFilter =
    req.query.read === "true"
      ? true
      : req.query.read === "false"
      ? false
      : null;

  // Build filter object
  const filter = { recipient: req.user.id };
  if (readFilter !== null) filter.read = readFilter;

  // Get notifications with pagination
  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("relatedProject", "title")
    .populate("relatedTask", "title");

  // Get total count for pagination
  const totalNotifications = await Notification.countDocuments(filter);

  // Get count of unread notifications
  const unreadCount = await Notification.countDocuments({
    recipient: req.user.id,
    read: false,
  });

  res.status(200).json({
    success: true,
    count: notifications.length,
    unreadCount,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(totalNotifications / limit),
      totalItems: totalNotifications,
    },
    data: { notifications },
  });
});

/**
 * @desc    Mark a notification as read
 * @route   PUT /api/notifications/:notificationId/read
 * @access  Private
 */
const markNotificationAsRead = asyncHandler(async (req, res) => {
  const notificationId = req.params.notificationId;

  const notification = await Notification.findById(notificationId);

  if (!notification) {
    res.status(404);
    throw new Error("Notification not found");
  }

  // Verify notification belongs to current user
  if (notification.recipient.toString() !== req.user.id) {
    res.status(403);
    throw new Error("Not authorized to access this notification");
  }

  // Update notification to read
  notification.read = true;
  await notification.save();

  res.status(200).json({
    success: true,
    data: { notification },
  });
});

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/notifications/read-all
 * @access  Private
 */
const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  // Update all unread notifications for current user
  const result = await Notification.updateMany(
    { recipient: req.user.id, read: false },
    { read: true }
  );

  res.status(200).json({
    success: true,
    message: `Marked ${result.modifiedCount} notifications as read`,
    data: null,
  });
});

/**
 * @desc    Delete a notification
 * @route   DELETE /api/notifications/:notificationId
 * @access  Private
 */
const deleteNotification = asyncHandler(async (req, res) => {
  const notificationId = req.params.notificationId;

  const notification = await Notification.findById(notificationId);

  if (!notification) {
    res.status(404);
    throw new Error("Notification not found");
  }

  // Verify notification belongs to current user
  if (notification.recipient.toString() !== req.user.id) {
    res.status(403);
    throw new Error("Not authorized to access this notification");
  }

  // Delete notification
  await notification.deleteOne();

  res.status(200).json({
    success: true,
    message: "Notification deleted successfully",
    data: null,
  });
});

module.exports = {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
};
