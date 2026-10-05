const express = require('express');
const router = express.Router();
const { registerUser, loginUser, seedAdmin } = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// @route   POST /api/auth/login & POST /api/auth/admin/login
// @desc    Authenticate admin/user with fallback to direct environment credentials
const handleAuthLogin = (req, res, next) => {
  const identifier = (req.body.email || req.body.username || req.body.identifier || '')
    .toString()
    .trim()
    .toLowerCase();

  const password = (req.body.password || '').toString().trim();

  // Permitted direct admin credentials (matching visaRoutes logic)
  const allowedIdentifiers = [
    'admin',
    'admin@gmail.com',
    'admin@mols.gov',
    (process.env.ADMIN_USERNAME || '').toLowerCase(),
    (process.env.ADMIN_EMAIL || '').toLowerCase(),
  ].filter(Boolean);

  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';

  // 1. Direct environment credential bypass (Works instantly without requiring MongoDB seeding)
  if (allowedIdentifiers.includes(identifier) && password === expectedPassword) {
    return res.status(200).json({
      success: true,
      message: 'Authenticated successfully',
      data: {
        token: 'admin-auth-token-valid',
        email: identifier,
        role: 'admin',
      },
    });
  }

  // 2. Fallback to MongoDB Atlas database user authentication
  return loginUser(req, res, next);
};

router.post('/login', handleAuthLogin);
router.post('/admin/login', handleAuthLogin);

// @route   POST /api/auth/register
// @desc    Register a new user (Protected: Admin Only)
router.post('/register', protect, adminOnly, registerUser);

// @route   GET /api/auth/seed-admin
// @desc    One-time trigger to seed default admin user into MongoDB Atlas
router.get('/seed-admin', seedAdmin);

module.exports = router;