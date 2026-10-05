// controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Helper function to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '30d',
  });
};

// @desc    Seed or reset default admin account in MongoDB Atlas
// @route   GET /api/auth/seed-admin
// @access  Public
exports.seedAdmin = async (req, res) => {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = 'System Administrator';

    let user = await User.findOne({ 
      $or: [{ email: adminEmail }, { username: 'admin' }] 
    }).select('+password');

    if (user) {
      // Direct assignment triggers the pre('save') hook in User.js to hash properly once
      user.password = adminPassword;
      user.role = 'admin';
      user.email = adminEmail;
      user.username = 'admin';
      await user.save();

      return res.status(200).json({
        success: true,
        message: `Admin password updated/reset successfully. Login with email: ${adminEmail} or username: admin`,
      });
    }

    // Creating new user automatically triggers pre('save') hook in User.js
    user = await User.create({
      fullName: adminName,
      email: adminEmail,
      username: 'admin',
      password: adminPassword,
      role: 'admin',
    });

    res.status(201).json({
      success: true,
      message: `Default admin created successfully. Login with email: ${adminEmail} or username: admin`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Protected / Admin Only
exports.registerUser = async (req, res) => {
  try {
    const { fullName, email, username, password, role } = req.body;

    if (!fullName || (!email && !username) || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, password, and an email or username',
      });
    }

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

    // Pass plain password; User.js pre('save') hook handles single-pass hashing
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
    const rawIdentifier = req.body.username || req.body.email || req.body.identifier;
    const { password } = req.body;

    if (!rawIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username/email and password',
      });
    }

    const identifier = rawIdentifier.toString().toLowerCase().trim();

    // Query user by username or email and include hidden password field
    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid admin username/email or password.' });
    }

    // Use User.js schema matchPassword method
    const isMatch = await user.matchPassword(password.toString().trim());

    if (isMatch) {
      res.status(200).json({
        success: true,
        token: generateToken(user._id),
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
      res.status(401).json({ success: false, message: 'Invalid admin username/email or password.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};