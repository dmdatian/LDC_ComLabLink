const express = require('express');
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

router.get('/mine', notificationController.getMyNotifications);
router.patch('/:id/read', notificationController.markMyNotificationRead);

module.exports = router;
