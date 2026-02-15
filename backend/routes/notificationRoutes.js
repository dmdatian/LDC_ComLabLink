const express = require('express');
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const missingHandler = (name) => (req, res) => res.status(501).json({
  success: false,
  message: `${name} handler is not available in this deployment`,
});
const getMineHandler = notificationController.getMine || missingHandler('getMine');
const markReadHandler = notificationController.markRead || missingHandler('markRead');

router.use(authMiddleware);
router.get('/mine', getMineHandler);
router.patch('/:id/read', markReadHandler);

module.exports = router;