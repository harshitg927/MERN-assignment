// middleware/validator.js
const { validationResult } = require("express-validator");

/**
 * Validation middleware
 * Processes validation results from express-validator
 * and returns standardized error responses
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((error) => ({
        field: error.param,
        message: error.msg,
        value: error.value,
      })),
    });
  }

  next();
};

module.exports = { validateRequest };
