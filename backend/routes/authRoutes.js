const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Public routes
router.post('/request', authController.requestRegistration);
router.post('/register', authMiddleware, authController.register);
router.post('/login', authController.login);

// Protected routes
router.get('/verify-token', authMiddleware, authController.verifyToken);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.get('/pending', authMiddleware, roleMiddleware(['admin']), authController.getPendingUsers);
router.put('/approve/:email', authMiddleware, roleMiddleware(['admin']), authController.approveUser);
router.delete('/reject/:email', authMiddleware, roleMiddleware(['admin']), authController.rejectUser);

// Example admin-only route
// router.put('/admin-update/:uid', authMiddleware, roleMiddleware(['admin']), authController.updateProfile);

module.exports = router;
