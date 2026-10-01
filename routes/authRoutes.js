// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// @route   POST /api/auth/login
// @desc    Authenticate user & get JWT token (Public)
router.post('/login', loginUser);

// @route   POST /api/auth/register
// @desc    Register a new user (Protected: Admin Only)
router.post('/register', protect, adminOnly, registerUser);

module.exports = router;