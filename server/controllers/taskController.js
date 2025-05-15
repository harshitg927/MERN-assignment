// controllers/taskController.js
const asyncHandler = require("express-async-handler");
const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { runAutomations } = require("../utils/automationEngine");

/**
 * @desc    Create a new task
 * @route   POST /api/tasks
 * @access  Private (Project members only)
 */
const createTask = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    project: projectId,
    status,
    assignee,
    dueDate,
    priority,
  } = req.body;

  // Validate project access (middleware already checked membership)
  const project = await Project.findById(projectId);

  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }

  // Validate status against project's allowed statuses
  if (status) {
    const validStatus = project.statuses.some((s) => s.name === status);
    if (!validStatus) {
      res.status(400);
      throw new Error(
        `Invalid status: ${status}. Must be one of the project's defined statuses.`
      );
    }
  }

  // Validate assignee (if provided) is a project member
  if (assignee) {
    const isProjectMember = project.members.some(
      (member) => member.user.toString() === assignee
    );

    if (!isProjectMember) {
      res.status(400);
      throw new Error("Assignee must be a member of the project");
    }
  }

  // Create the task
  const task = await Task.create({
    title,
    description,
    project: projectId,
    status: status || project.statuses[0].name, // Default to first status if not provided
    assignee,
    dueDate,
    priority,
    creator: req.user.id,
  });

  // Fetch the complete task with populated fields
  const populatedTask = await Task.findById(task._id)
    .populate("assignee", "name email avatarUrl")
    .populate("creator", "name email avatarUrl");

  // Create notification for assignee if assigned
  if (assignee) {
    await Notification.create({
      recipient: assignee,
      type: "task_assignment",
      message: `You've been assigned to the task "${title}"`,
      relatedProject: projectId,
      relatedTask: task._id,
    });
  }

  // Trigger automations for task creation
  await runAutomations("task_created", task);

  res.status(201).json({
    success: true,
    data: { task: populatedTask },
  });
});

/**
 * @desc    Get all tasks for a project
 * @route   GET /api/projects/:projectId/tasks
 * @access  Private (Project members only)
 */
const getProjectTasks = asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;

  // Sort, filter and pagination options
  const status = req.query.status;
  const assignee = req.query.assignee;
  const dueDate = req.query.dueDate;
  const priority = req.query.priority;
  const sortBy = req.query.sortBy || "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const skip = (page - 1) * limit;

  // Build filter object
  const filter = { project: projectId };
  if (status) filter.status = status;
  if (assignee) filter.assignee = assignee;
  if (priority) filter.priority = priority;
  if (dueDate) {
    const date = new Date(dueDate);
    // Match tasks due on the specified date
    filter.dueDate = {
      $gte: new Date(date.setHours(0, 0, 0, 0)),
      $lte: new Date(date.setHours(23, 59, 59, 999)),
    };
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder;

  // Get tasks with pagination
  const tasks = await Task.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate("assignee", "name email avatarUrl")
    .populate("creator", "name email avatarUrl");

  // Get total count for pagination
  const totalTasks = await Task.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: tasks.length,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(totalTasks / limit),
      totalItems: totalTasks,
    },
    data: { tasks },
  });
});

/**
 * @desc    Get a task by ID
 * @route   GET /api/tasks/:taskId
 * @access  Private (Project members only)
 */
const getTaskById = asyncHandler(async (req, res) => {
  const taskId = req.params.taskId;

  const task = await Task.findById(taskId)
    .populate("assignee", "name email avatarUrl")
    .populate("creator", "name email avatarUrl")
    .populate("comments.user", "name email avatarUrl")
    .populate("history.user", "name email avatarUrl");

  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }

  // Check if user is a member of the task's project
  const project = await Project.findById(task.project);
  const isMember = project.members.some(
    (member) => member.user.toString() === req.user.id
  );

  if (!isMember) {
    res.status(403);
    throw new Error(
      "Access denied: You are not a member of this task's project"
    );
  }

  res.status(200).json({
    success: true,
    data: { task },
  });
});

/**
 * @desc    Update a task
 * @route   PUT /api/tasks/:taskId
 * @access  Private (Project members only)
 */
const updateTask = asyncHandler(async (req, res) => {
  const taskId = req.params.taskId;
  const { title, description, status, assignee, dueDate, priority } = req.body;

  // Find the task
  const task = await Task.findById(taskId);

  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }

  // Check if user is a member of the task's project
  const project = await Project.findById(task.project);
  const isMember = project.members.some(
    (member) => member.user.toString() === req.user.id
  );

  if (!isMember) {
    res.status(403);
    throw new Error(
      "Access denied: You are not a member of this task's project"
    );
  }

  // Store old values for history tracking
  const oldStatus = task.status;
  const oldAssignee = task.assignee;

  // Update fields if provided
  if (title) task.title = title;
  if (description) task.description = description;

  // Validate status if provided
  if (status) {
    const validStatus = project.statuses.some((s) => s.name === status);
    if (!validStatus) {
      res.status(400);
      throw new Error(
        `Invalid status: ${status}. Must be one of the project's defined statuses.`
      );
    }
    task.status = status;
  }

  // Validate assignee if provided
  if (assignee) {
    if (assignee === "unassign") {
      // Special case to remove assignee
      task.assignee = null;
    } else {
      const isProjectMember = project.members.some(
        (member) => member.user.toString() === assignee
      );

      if (!isProjectMember) {
        res.status(400);
        throw new Error("Assignee must be a member of the project");
      }
      task.assignee = assignee;
    }
  }

  if (dueDate !== undefined) {
    task.dueDate = dueDate ? new Date(dueDate) : null;
  }

  if (priority) task.priority = priority;

  // Add history entry
  task.history.push({
    user: req.user.id,
    action: "updated",
    timestamp: Date.now(),
  });

  // Save the updated task
  await task.save();

  // Reload task with populated fields
  const updatedTask = await Task.findById(taskId)
    .populate("assignee", "name email avatarUrl")
    .populate("creator", "name email avatarUrl");

  // Create notification for new assignee
  if (
    assignee &&
    assignee !== "unassign" &&
    (!oldAssignee || oldAssignee.toString() !== assignee)
  ) {
    await Notification.create({
      recipient: assignee,
      type: "task_assignment",
      message: `You've been assigned to the task "${task.title}"`,
      relatedProject: task.project,
      relatedTask: task._id,
    });
  }

  // Trigger automations
  if (status && status !== oldStatus) {
    await runAutomations("task_status_changed", updatedTask, { oldStatus });
  }

  if (
    (assignee &&
      assignee !== "unassign" &&
      (!oldAssignee || oldAssignee.toString() !== assignee)) ||
    (assignee === "unassign" && oldAssignee)
  ) {
    await runAutomations("task_assigned", updatedTask, { oldAssignee });
  }

  // General update automation
  await runAutomations("task_updated", updatedTask);

  res.status(200).json({
    success: true,
    data: { task: updatedTask },
  });
});

/**
 * @desc    Delete a task
 * @route   DELETE /api/tasks/:taskId
 * @access  Private (Project members with editor rights)
 */
const deleteTask = asyncHandler(async (req, res) => {
  const taskId = req.params.taskId;

  // Find the task
  const task = await Task.findById(taskId);

  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }

  // Check if user is a member of the task's project with appropriate rights
  const project = await Project.findById(task.project);
  const memberInfo = project.members.find(
    (member) => member.user.toString() === req.user.id
  );

  if (!memberInfo) {
    res.status(403);
    throw new Error(
      "Access denied: You are not a member of this task's project"
    );
  }

  // Only owners, the task creator, or editors can delete tasks
  const isOwner = project.owner.toString() === req.user.id;
  const isCreator = task.creator && task.creator.toString() === req.user.id;
  const isEditor = memberInfo.role === "editor";

  if (!isOwner && !isCreator && !isEditor) {
    res.status(403);
    throw new Error(
      "Access denied: You do not have permission to delete this task"
    );
  }

  // Delete the task
  await Task.findByIdAndDelete(taskId);

  // Delete related notifications
  await Notification.deleteMany({ relatedTask: taskId });

  res.status(200).json({
    success: true,
    message: "Task deleted successfully",
    data: null,
  });
});

/**
 * @desc    Add a comment to a task
 * @route   POST /api/tasks/:taskId/comments
 * @access  Private (Project members only)
 */
const addTaskComment = asyncHandler(async (req, res) => {
  const taskId = req.params.taskId;
  const { text } = req.body;

  if (!text || text.trim() === "") {
    res.status(400);
    throw new Error("Comment text is required");
  }

  // Find the task
  const task = await Task.findById(taskId);

  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }

  // Check if user is a member of the task's project
  const project = await Project.findById(task.project);
  const isMember = project.members.some(
    (member) => member.user.toString() === req.user.id
  );

  if (!isMember) {
    res.status(403);
    throw new Error(
      "Access denied: You are not a member of this task's project"
    );
  }

  // Add the comment
  task.comments.push({
    user: req.user.id,
    text,
    createdAt: Date.now(),
  });

  // Add to history
  task.history.push({
    user: req.user.id,
    action: "commented",
    timestamp: Date.now(),
  });

  await task.save();

  // Get the updated task with populated comments
  const updatedTask = await Task.findById(taskId)
    .populate("assignee", "name email avatarUrl")
    .populate("creator", "name email avatarUrl")
    .populate("comments.user", "name email avatarUrl");

  // Notify the task assignee (if different from commenter)
  if (task.assignee && task.assignee.toString() !== req.user.id) {
    await Notification.create({
      recipient: task.assignee,
      type: "task_comment",
      message: `New comment on task "${task.title}"`,
      relatedProject: task.project,
      relatedTask: task._id,
    });
  }

  res.status(200).json({
    success: true,
    data: {
      task: updatedTask,
      newComment: updatedTask.comments[updatedTask.comments.length - 1],
    },
  });
});

module.exports = {
  createTask,
  getProjectTasks,
  getTaskById,
  updateTask,
  deleteTask,
  addTaskComment,
};
