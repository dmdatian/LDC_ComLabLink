const express = require('express');
const classController = require('../controllers/classController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// All class routes require authentication
router.use(authMiddleware);

// Teacher/Admin routes
router.post('/', roleMiddleware(['admin']), classController.createClass);
router.get('/my-classes', roleMiddleware(['teacher', 'admin']), classController.getMyClasses);
router.put('/:id', roleMiddleware(['admin']), classController.updateClass);
router.delete('/:id', roleMiddleware(['admin']), classController.deleteClass);

// Public route for any authenticated user
// GET /classes?date=YYYY-MM-DD
router.get('/', classController.getClassesByDate);

// Get a single class by ID
router.get('/:id', classController.getClassById);

module.exports = router;
