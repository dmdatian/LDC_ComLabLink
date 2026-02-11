// errorHandler.js
const errorHandler = (err, req, res, next) => {
  // Log full error for debugging
  console.error('Error:', err);

  // Use statusCode from error if provided, otherwise 500
  const statusCode = err.statusCode || 500;

  // Use message from error if provided, otherwise generic
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message: message,
    // Only send full error details in development for safety
    error: process.env.NODE_ENV === 'development' ? err : undefined,
  });
};

module.exports = errorHandler;
