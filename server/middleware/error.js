// middleware/error.js
/**
 * Error handling middleware
 * Provides consistent error responses across the API
 */

// Not found error handler
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// General error handler
const errorHandler = (err, req, res, next) => {
  // Set status code (use existing status code or default to 500)
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  // Send error response
  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? "🥞" : err.stack,
    error: process.env.NODE_ENV === "development" ? err : undefined,
  });
};

module.exports = { notFound, errorHandler };
