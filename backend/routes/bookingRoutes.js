const express = require('express');
const bookingController = require('../controllers/bookingController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// All booking routes require authentication
router.use(authMiddleware);

// Student routes
router.post('/', bookingController.createBooking);
router.get('/mine', bookingController.getMyBookings);
router.get('/availability', bookingController.getSeatBookingsByDate);
router.get('/catalog', bookingController.getSeatCatalog);
router.get('/fixed-schedule', roleMiddleware(['admin', 'teacher']), bookingController.getFixedSchedule);
router.get('/fixed-schedule/mine', roleMiddleware(['teacher', 'admin']), bookingController.getMyFixedSchedule);
router.post('/fixed-schedule', roleMiddleware(['admin']), bookingController.upsertFixedScheduleEntry);
router.delete('/fixed-schedule/:id', roleMiddleware(['admin']), bookingController.deleteFixedScheduleEntry);
router.put('/catalog', roleMiddleware(['admin']), bookingController.upsertSeatCatalogItem);
router.delete('/catalog/:id', roleMiddleware(['admin']), bookingController.deleteSeatCatalogItem);
router.get('/blocks', roleMiddleware(['admin']), bookingController.getSeatBlocks);
router.post('/blocks', roleMiddleware(['admin']), bookingController.createSeatBlock);
router.delete('/blocks/:id', roleMiddleware(['admin']), bookingController.deleteSeatBlock);
router.get('/all', roleMiddleware(['admin']), bookingController.getAllBookings);
router.get('/', roleMiddleware(['admin']), bookingController.getAllBookings);
router.get('/:id', bookingController.getBookingById);
router.patch('/:id/cancel', bookingController.cancelBooking); // more semantic

module.exports = router;
