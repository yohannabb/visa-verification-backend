// controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Helper function to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
  try {
    const { fullName, email, username, password, role } = req.body;

    // Must provide either email OR username alongside password & name
    if (!fullName || (!email && !username) || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, password, and an email or username',
      });
    }

    // Build query to check if user already exists
    const query = [];
    if (email) query.push({ email: email.toLowerCase().trim() });
    if (username) query.push({ username: username.toLowerCase().trim() });

    const userExists = await User.findOne({ $or: query });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists',
      });
    }

    // Create user
    const user = await User.create({
      fullName,
      email: email ? email.toLowerCase().trim() : undefined,
      username: username ? username.toLowerCase().trim() : undefined,
      password,
      role: role || 'user',
    });

    if (user) {
      res.status(201).json({
        success: true,
        data: {
          _id: user._id,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          role: user.role,
          token: generateToken(user._id),
        },
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Authenticate user & get token (supports username OR email)
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
  try {
    // Read username, email, or single identifier field from request body
    const rawIdentifier = req.body.username || req.body.email || req.body.identifier;
    const { password } = req.body;

    if (!rawIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username/email and password',
      });
    }

    const identifier = rawIdentifier.toLowerCase().trim();

    // Check for user matching username OR email (and explicitly request +password)
    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    }).select('+password');

    if (user && (await user.matchPassword(password))) {
      res.json({
        success: true,
        data: {
          _id: user._id,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          role: user.role,
          token: generateToken(user._id),
        },
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid admin username or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};