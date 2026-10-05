// controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Helper function to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '30d',
  });
};

// @desc    Seed or reset default admin account
// @route   GET /api/auth/seed-admin
// @access  Public (One-time setup utility)
exports.seedAdmin = async (req, res) => {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@mols.gov').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = 'System Administrator';

    let user = await User.findOne({ 
      $or: [{ email: adminEmail }, { username: 'admin' }] 
    }).select('+password');

    // Hash the password securely
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    if (user) {
      user.password = hashedPassword;
      user.role = 'admin';
      user.email = adminEmail;
      user.username = 'admin';
      await user.save();

      return res.status(200).json({
        success: true,
        message: `Admin user existing record updated. You can now login with: ${adminEmail}`,
      });
    }

    // Create new admin user if none exists
    user = await User.create({
      fullName: adminName,
      email: adminEmail,
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
    });

    res.status(201).json({
      success: true,
      message: `Default admin created successfully! Email: ${adminEmail}`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Protected (Admin only) or Public
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

    // Hash password before saving if model doesn't handle pre-save hashing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      fullName,
      email: email ? email.toLowerCase().trim() : undefined,
      username: username ? username.toLowerCase().trim() : undefined,
      password: hashedPassword,
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

    // Check for user matching username OR email (explicitly selecting password)
    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid admin username or password' });
    }

    // Verify password via user.matchPassword method or fallback to direct bcrypt comparison
    let isMatch = false;
    if (typeof user.matchPassword === 'function') {
      isMatch = await user.matchPassword(password);
    } else {
      isMatch = await bcrypt.compare(password, user.password);
    }

    if (isMatch) {
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