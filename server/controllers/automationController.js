// controllers/automationController.js
const asyncHandler = require("express-async-handler");
const Automation = require("../models/Automation");
const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");

/**
 * @desc    Create a new automation
 * @route   POST /api/automations
 * @access  Private (Project members with editor rights)
 */
const createAutomation = asyncHandler(async (req, res) => {
  const { project: projectId, name, trigger, action } = req.body;

  // Project access middleware already ensured the user has access to the project
  const project = req.project;

  // Check user role
  const memberInfo = project.members.find(
    (member) => member.user.toString() === req.user.id
  );

  const isOwner = project.owner.toString() === req.user.id;
  const isEditor = memberInfo.role === "editor";

  if (!isOwner && !isEditor) {
    res.status(403);
    throw new Error(
      "Access denied: Only project owners and editors can create automations"
    );
  }

  // Validate trigger and action
  validateAutomationLogic(trigger, action, project);

  // Create the automation
  const automation = await Automation.create({
    project: projectId,
    name,
    trigger,
    action,
    creator: req.user.id,
  });

  res.status(201).json({
    success: true,
    data: { automation },
  });
});

/**
 * @desc    Get all automations for a project
 * @route   GET /api/automations/project/:projectId
 * @access  Private (Project members only)
 */
const getProjectAutomations = asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;

  // Project access middleware already ensured the user has access to the project
  const automations = await Automation.find({ project: projectId })
    .populate("creator", "name email avatarUrl")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: automations.length,
    data: { automations },
  });
});

/**
 * @desc    Get a single automation by ID
 * @route   GET /api/automations/:automationId
 * @access  Private (Project members only)
 */
const getAutomationById = asyncHandler(async (req, res) => {
  const automationId = req.params.automationId;

  const automation = await Automation.findById(automationId).populate(
    "creator",
    "name email avatarUrl"
  );

  if (!automation) {
    res.status(404);
    throw new Error("Automation not found");
  }

  // Verify user has access to the automation's project
  const project = await Project.findById(automation.project);
  const isMember = project.members.some(
    (member) => member.user.toString() === req.user.id
  );

  if (!isMember) {
    res.status(403);
    throw new Error(
      "Access denied: You are not a member of this automation's project"
    );
  }

  res.status(200).json({
    success: true,
    data: { automation },
  });
});

/**
 * @desc    Update an automation
 * @route   PUT /api/automations/:automationId
 * @access  Private (Project members with editor rights)
 */
const updateAutomation = asyncHandler(async (req, res) => {
  const automationId = req.params.automationId;
  const { name, trigger, action, active } = req.body;

  // Find the automation
  const automation = await Automation.findById(automationId);

  if (!automation) {
    res.status(404);
    throw new Error("Automation not found");
  }

  // Verify user has access to the automation's project
  const project = await Project.findById(automation.project);
  const memberInfo = project.members.find(
    (member) => member.user.toString() === req.user.id
  );

  if (!memberInfo) {
    res.status(403);
    throw new Error(
      "Access denied: You are not a member of this automation's project"
    );
  }

  // Check user role
  const isOwner = project.owner.toString() === req.user.id;
  const isCreator = automation.creator.toString() === req.user.id;
  const isEditor = memberInfo.role === "editor";

  if (!isOwner && !isCreator && !isEditor) {
    res.status(403);
    throw new Error(
      "Access denied: Only project owners, automation creators, and editors can update automations"
    );
  }

  // Update fields if provided
  if (name) automation.name = name;

  // Update trigger if provided
  if (trigger) {
    validateAutomationLogic(trigger, automation.action, project);
    automation.trigger = trigger;
  }

  // Update action if provided
  if (action) {
    validateAutomationLogic(automation.trigger, action, project);
    automation.action = action;
  }

  // Update active status if provided
  if (active !== undefined) {
    automation.active = active;
  }

  // Save the updated automation
  const updatedAutomation = await automation.save();

  res.status(200).json({
    success: true,
    data: { automation: updatedAutomation },
  });
});

/**
 * @desc    Delete an automation
 * @route   DELETE /api/automations/:automationId
 * @access  Private (Project members with editor rights)
 */
const deleteAutomation = asyncHandler(async (req, res) => {
  const automationId = req.params.automationId;

  // Find the automation
  const automation = await Automation.findById(automationId);

  if (!automation) {
    res.status(404);
    throw new Error("Automation not found");
  }

  // Verify user has access to the automation's project
  const project = await Project.findById(automation.project);
  const memberInfo = project.members.find(
    (member) => member.user.toString() === req.user.id
  );

  if (!memberInfo) {
    res.status(403);
    throw new Error(
      "Access denied: You are not a member of this automation's project"
    );
  }

  // Check user role
  const isOwner = project.owner.toString() === req.user.id;
  const isCreator = automation.creator.toString() === req.user.id;
  const isEditor = memberInfo.role === "editor";

  if (!isOwner && !isCreator && !isEditor) {
    res.status(403);
    throw new Error(
      "Access denied: Only project owners, automation creators, and editors can delete automations"
    );
  }

  // Delete the automation
  await automation.deleteOne();

  res.status(200).json({
    success: true,
    message: "Automation deleted successfully",
    data: null,
  });
});

/**
 * @desc    Toggle automation active state
 * @route   PUT /api/automations/:automationId/toggle
 * @access  Private (Project members with editor rights)
 */
const toggleAutomation = asyncHandler(async (req, res) => {
  const automationId = req.params.automationId;

  // Find the automation
  const automation = await Automation.findById(automationId);

  if (!automation) {
    res.status(404);
    throw new Error("Automation not found");
  }

  // Verify user has access to the automation's project
  const project = await Project.findById(automation.project);
  const memberInfo = project.members.find(
    (member) => member.user.toString() === req.user.id
  );

  if (!memberInfo) {
    res.status(403);
    throw new Error(
      "Access denied: You are not a member of this automation's project"
    );
  }

  // Check user role
  const isOwner = project.owner.toString() === req.user.id;
  const isCreator = automation.creator.toString() === req.user.id;
  const isEditor = memberInfo.role === "editor";

  if (!isOwner && !isCreator && !isEditor) {
    res.status(403);
    throw new Error(
      "Access denied: Only project owners, automation creators, and editors can toggle automations"
    );
  }

  // Toggle active state
  automation.active = !automation.active;
  await automation.save();

  res.status(200).json({
    success: true,
    data: {
      automation,
      message: `Automation ${
        automation.active ? "enabled" : "disabled"
      } successfully`,
    },
  });
});

/**
 * Helper function to validate automation logic
 */
const validateAutomationLogic = (trigger, action, project) => {
  // Validate task status triggers
  if (trigger.type === "task_status_changed" && trigger.condition?.value) {
    // Check if the status exists in the project
    const validStatus = project.statuses.some(
      (s) => s.name === trigger.condition.value
    );
    if (!validStatus) {
      throw new Error(
        `Invalid status in trigger condition: ${trigger.condition.value}`
      );
    }
  }

  // Validate action params
  if (action.type === "change_status" && action.params?.status) {
    // Check if the status exists in the project
    const validStatus = project.statuses.some(
      (s) => s.name === action.params.status
    );
    if (!validStatus) {
      throw new Error(
        `Invalid status in action params: ${action.params.status}`
      );
    }
  }

  // Additional validations can be added here
};

module.exports = {
  createAutomation,
  getProjectAutomations,
  getAutomationById,
  updateAutomation,
  deleteAutomation,
  toggleAutomation,
};
