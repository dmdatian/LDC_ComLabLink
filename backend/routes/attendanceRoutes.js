const express = require('express');
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

router.get('/', attendanceController.getAttendanceByDate); // /api/attendance?date=YYYY-MM-DD
router.patch('/:bookingId/mark', attendanceController.markAttendance);

module.exports = router;
