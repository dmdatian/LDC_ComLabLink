const Feedback = require('../models/Feedback');
const { sendSuccess, sendError } = require('../utils/responseHandler');

exports.createFeedback = async (req, res) => {
  try {
    const { message, category, source } = req.body;

    if (!message || !message.trim()) {
      return sendError(res, 400, 'Feedback message is required');
    }

    const role = (req.user.role || 'user').toLowerCase();

    const result = await Feedback.create({
      role,
      message: message.trim(),
      category,
      source,
    });

    sendSuccess(res, 201, result, 'Feedback submitted');
  } catch (error) {
    console.error('Create feedback error:', error);
    sendError(res, 500, 'Failed to submit feedback', error.message);
  }
};

exports.getFeedback = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const entries = await Feedback.list({ limit });

    const normalized = entries.map((entry) => {
      const { name, userId, ...safeEntry } = entry;
      return {
        ...safeEntry,
        name: 'Anonymous',
        createdAt: entry.createdAt?.toISOString ? entry.createdAt.toISOString() : entry.createdAt,
      };
    });

    sendSuccess(res, 200, normalized, 'Feedback retrieved');
  } catch (error) {
    console.error('Get feedback error:', error);
    sendError(res, 500, 'Failed to retrieve feedback', error.message);
  }
};