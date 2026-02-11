const Feedback = require('../models/Feedback');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/responseHandler');

exports.createFeedback = async (req, res) => {
  try {
    const { message, category, source } = req.body;

    if (!message || !message.trim()) {
      return sendError(res, 400, 'Feedback message is required');
    }

    const user = await User.getById(req.user.uid);
    const role = (user?.role || req.user.role || 'user').toLowerCase();
    const name = user?.name || req.user.email?.split('@')[0] || 'User';

    const result = await Feedback.create({
      role,
      name,
      userId: req.user.uid,
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

    const normalized = entries.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt?.toISOString ? entry.createdAt.toISOString() : entry.createdAt,
    }));

    sendSuccess(res, 200, normalized, 'Feedback retrieved');
  } catch (error) {
    console.error('Get feedback error:', error);
    sendError(res, 500, 'Failed to retrieve feedback', error.message);
  }
};
