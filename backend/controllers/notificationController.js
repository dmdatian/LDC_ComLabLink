const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/responseHandler');

exports.getMine = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const rows = await Notification.listByUser(req.user.uid, limit);
    sendSuccess(res, 200, rows, 'Notifications retrieved');
  } catch (error) {
    console.error('Get notifications error:', error);
    sendError(res, 500, 'Failed to retrieve notifications', error.message);
  }
};

exports.markRead = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return sendError(res, 400, 'Notification ID is required');

    const result = await Notification.markRead(id, req.user.uid);
    if (!result.ok && result.code === 404) return sendError(res, 404, 'Notification not found');
    if (!result.ok && result.code === 403) return sendError(res, 403, 'Unauthorized');

    sendSuccess(res, 200, { id, read: true }, 'Notification marked as read');
  } catch (error) {
    console.error('Mark notification read error:', error);
    sendError(res, 500, 'Failed to mark notification as read', error.message);
  }
};
