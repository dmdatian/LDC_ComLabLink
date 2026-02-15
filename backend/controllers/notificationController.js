const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/responseHandler');

exports.getMyNotifications = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const data = await Notification.getByRecipient(req.user.uid, limit);
    sendSuccess(res, 200, data, 'Notifications retrieved');
  } catch (error) {
    console.error('getMyNotifications error:', error);
    sendError(res, 500, 'Failed to retrieve notifications', error.message);
  }
};

exports.markMyNotificationRead = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return sendError(res, 400, 'Notification ID is required');

    const updated = await Notification.markRead(id, req.user.uid);
    if (!updated) return sendError(res, 404, 'Notification not found');

    sendSuccess(res, 200, updated, 'Notification marked as read');
  } catch (error) {
    console.error('markMyNotificationRead error:', error);
    sendError(res, 500, 'Failed to mark notification as read', error.message);
  }
};
