const express = require('express');
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// All report routes require authentication
router.use(authMiddleware);

// Reports
router.get('/daily', roleMiddleware(['teacher', 'admin']), reportController.getDailyReport);
router.get('/weekly', roleMiddleware(['teacher', 'admin']), reportController.getWeeklyReport);
router.get('/monthly', roleMiddleware(['admin']), reportController.getMonthlyReport);

module.exports = router;
