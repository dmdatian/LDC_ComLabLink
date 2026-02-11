// utils/responseUtils.js

// Success response
const sendSuccess = (res, statusCode = 200, data = null, message = 'Success') => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

// Error response
const sendError = (res, statusCode = 500, message = 'Internal server error', error = null) => {
  res.status(statusCode).json({
    success: false,
    message,
    error,
  });
};

// Paginated response
const sendPaginatedResponse = (res, statusCode = 200, data = [], total = 0, page = 1, limit = 10) => {
  res.status(statusCode).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
};

module.exports = {
  sendSuccess,
  sendError,
  sendPaginatedResponse,
};
