// controllers/projectController.js
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Project = require("../models/Project");
const User = require("../models/User");
const Task = require("../models/Task");
const Automation = require("../models/Automation");
const Notification = require("../models/Notification");

/**
 * @desc    Create a new project
 * @route   POST /api/projects
 * @access  Private
 */
const createProject = asyncHandler(async (req, res) => {
  const { title, description, statuses } = req.body;

  // Create project with owner set to current user
  const project = await Project.create({
    title,
    description,
    owner: req.user.id,
    statuses: statuses || undefined, // Use default statuses if not provided
  });

  res.status(201).json({
    success: true,
    data: { project },
  });
});

/**
 * @desc    Get all projects for the current user
 * @route   GET /api/projects
 * @access  Private
 */
const getUserProjects = asyncHandler(async (req, res) => {
  // Find all projects where the user is a member
  const projects = await Project.find({
    "members.user": req.user.id,
  })
    .populate("owner", "name email avatarUrl")
    .populate("members.user", "name email avatarUrl")
    .select("-__v");

  res.status(200).json({
    success: true,
    count: projects.length,
    data: { projects },
  });
});

/**
 * @desc    Get a project by ID
 * @route   GET /api/projects/:projectId
 * @access  Private (Project members only)
 */
const getProjectById = asyncHandler(async (req, res) => {
  // The project is already attached to req by projectAccess middleware
  const project = await Project.findById(req.project._id)
    .populate("owner", "name email avatarUrl")
    .populate("members.user", "name email avatarUrl")
    .select("-__v");

  // Get task count for project
  const taskCount = await Task.countDocuments({ project: project._id });

  res.status(200).json({
    success: true,
    data: {
      project,
      stats: {
        taskCount,
      },
    },
  });
});

/**
 * @desc    Update a project
 * @route   PUT /api/projects/:projectId
 * @access  Private (Project owner only)
 */
const updateProject = asyncHandler(async (req, res) => {
  const { title, description, statuses } = req.body;

  // The project is already attached to req by projectOwner middleware
  const project = req.project;

  // Update fields if provided
  if (title) project.title = title;
  if (description) project.description = description;
  if (statuses) {
    // Validate that all existing task statuses are still present
    const existingStatuses = project.statuses.map((s) => s.name);
    const newStatusNames = statuses.map((s) => s.name);

    // Check if all tasks with existing statuses would still have valid statuses
    const tasksWithInvalidStatuses = await Task.find({
      project: project._id,
      status: { $nin: newStatusNames },
    });

    if (tasksWithInvalidStatuses.length > 0) {
      res.status(400);
      throw new Error(
        `Cannot remove statuses that are still in use by tasks. ${tasksWithInvalidStatuses.length} tasks would be affected.`
      );
    }

    project.statuses = statuses;
  }

  // Save the updated project
  const updatedProject = await project.save();

  res.status(200).json({
    success: true,
    data: { project: updatedProject },
  });
});

/**
 * @desc    Delete a project
 * @route   DELETE /api/projects/:projectId
 * @access  Private (Project owner only)
 */
const deleteProject = asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;

  // Start a session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Delete all tasks in this project
    await Task.deleteMany({ project: projectId }, { session });

    // Delete all automations for this project
    await Automation.deleteMany({ project: projectId }, { session });

    // Delete all notifications related to this project
    await Notification.deleteMany({ relatedProject: projectId }, { session });

    // Delete the project itself
    await Project.findByIdAndDelete(projectId, { session });

    // Commit the transaction
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Project deleted successfully",
      data: null,
    });
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    throw error;
  } finally {
    // End session
    session.endSession();
  }
});

/**
 * @desc    Add a member to project
 * @route   POST /api/projects/:projectId/members
 * @access  Private (Project owner only)
 */
const addProjectMember = asyncHandler(async (req, res) => {
  const { email, role } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }

  // Find the user to add
  const userToAdd = await User.findOne({ email: email.toLowerCase() });

  if (!userToAdd) {
    res.status(404);
    throw new Error("User not found with that email");
  }

  // The project is already attached to req by projectOwner middleware
  const project = req.project;

  // Check if user is already a member
  const isAlreadyMember = project.members.some(
    (member) => member.user.toString() === userToAdd._id.toString()
  );

  if (isAlreadyMember) {
    res.status(400);
    throw new Error("User is already a member of this project");
  }

  // Add the user to members
  project.members.push({
    user: userToAdd._id,
    role: role || "editor",
    addedAt: Date.now(),
  });

  await project.save();

  // Create notification for the added user
  await Notification.create({
    recipient: userToAdd._id,
    type: "project_invitation",
    message: `You've been added to the project "${project.title}"`,
    relatedProject: project._id,
  });

  res.status(200).json({
    success: true,
    message: "Member added successfully",
    data: {
      member: {
        user: {
          id: userToAdd._id,
          name: userToAdd.name,
          email: userToAdd.email,
          avatarUrl: userToAdd.avatarUrl,
        },
        role: role || "editor",
      },
    },
  });
});

/**
 * @desc    Remove a member from project
 * @route   DELETE /api/projects/:projectId/members/:userId
 * @access  Private (Project owner only)
 */
const removeProjectMember = asyncHandler(async (req, res) => {
  const userId = req.params.userId;

  // The project is already attached to req by projectOwner middleware
  const project = req.project;

  // Cannot remove the owner
  if (project.owner.toString() === userId) {
    res.status(400);
    throw new Error("Cannot remove the project owner");
  }

  // Check if user is a member
  const memberIndex = project.members.findIndex(
    (member) => member.user.toString() === userId
  );

  if (memberIndex === -1) {
    res.status(404);
    throw new Error("User is not a member of this project");
  }

  // Remove user from members array
  project.members.splice(memberIndex, 1);
  await project.save();

  // Start a session for transaction to handle related data
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Unassign user from all tasks in this project
    await Task.updateMany(
      { project: project._id, assignee: userId },
      { $set: { assignee: null } },
      { session }
    );

    // Commit the transaction
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Member removed successfully",
      data: null,
    });
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    throw error;
  } finally {
    // End session
    session.endSession();
  }
});

/**
 * @desc    Update member role in project
 * @route   PUT /api/projects/:projectId/members/:userId
 * @access  Private (Project owner only)
 */
const updateMemberRole = asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const { role } = req.body;

  if (!role || !["editor", "viewer"].includes(role)) {
    res.status(400);
    throw new Error("Valid role is required (editor or viewer)");
  }

  // The project is already attached to req by projectOwner middleware
  const project = req.project;

  // Cannot update the owner's role
  if (project.owner.toString() === userId) {
    res.status(400);
    throw new Error("Cannot change the role of the project owner");
  }

  // Check if user is a member
  const memberIndex = project.members.findIndex(
    (member) => member.user.toString() === userId
  );

  if (memberIndex === -1) {
    res.status(404);
    throw new Error("User is not a member of this project");
  }

  // Update the user's role
  project.members[memberIndex].role = role;
  await project.save();

  res.status(200).json({
    success: true,
    message: "Member role updated successfully",
    data: {
      member: project.members[memberIndex],
    },
  });
});

module.exports = {
  createProject,
  getUserProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  updateMemberRole,
};
