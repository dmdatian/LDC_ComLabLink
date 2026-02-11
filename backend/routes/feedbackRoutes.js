const express = require('express');
const feedbackController = require('../controllers/feedbackController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// All feedback routes require authentication
router.use(authMiddleware);

// Submit feedback (student/teacher/admin)
router.post('/', feedbackController.createFeedback);

// Get feedback (admin only)
router.get('/', roleMiddleware(['admin']), feedbackController.getFeedback);

module.exports = router;
