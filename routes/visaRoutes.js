// routes/visaRoutes.js
const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Visa = require('../models/Visa');

const router = express.Router();

// 1. Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Set up Cloudinary Storage for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'visa_verification_docs', // Folder name inside Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
  },
});

const upload = multer({ storage });

// Helper to safely parse dates without saving "Invalid Date"
const parseDate = (dateStr) => {
  if (!dateStr) return undefined;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? undefined : parsed;
};

// 3. Admin Login Endpoint (Robust Debugging & Multi-Identifier Fallbacks)
router.post('/admin/login', (req, res) => {
  // Debug log incoming body on backend server (Render/Railway logs)
  console.log('[Admin Login Request Payload]:', req.body);

  const loginIdentifier = (req.body.email || req.body.username || req.body.identifier || '')
    .toString()
    .trim()
    .toLowerCase();

  const password = (req.body.password || '').toString().trim();

  if (!loginIdentifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both username/email and password.',
    });
  }

  // Permitted admin identifiers (environment variables + fallbacks)
  const allowedIdentifiers = [
    'admin',
    'admin@gmail.com',
    (process.env.ADMIN_USERNAME || '').toLowerCase(),
    (process.env.ADMIN_EMAIL || '').toLowerCase(),
  ].filter(Boolean);

  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (allowedIdentifiers.includes(loginIdentifier) && password === expectedPassword) {
    return res.status(200).json({
      success: true,
      message: 'Authenticated successfully',
      token: 'admin-auth-token-valid',
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid admin email/username or password.',
  });
});

// 4. Register New Visa Record Endpoint
router.post(
  '/register',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'attachedDoc', maxCount: 1 },
    { name: 'visaCardImage', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        fullName,
        nationality,
        passcode,
        visaNumber,
        passportNumber,
        visaType,
        occupation,
        gender,
        birthDate,
        issueDate,
        expiryDate,
      } = req.body;

      if (!passcode || !fullName || !passportNumber || !visaNumber) {
        return res.status(400).json({
          success: false,
          message: 'Required fields are missing (Passcode/OTP, Full Name, Passport, or Visa Number).',
        });
      }

      const cleanPasscode = passcode.toString().trim();

      // Check duplicate passcode using case-insensitive query
      const existing = await Visa.findOne({
        passcode: { $regex: `^${cleanPasscode}$`, $options: 'i' },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Access Code / OTP (Passcode) already exists.',
        });
      }

      // Extract Cloudinary HTTPS URLs
      const photoUrl = req.files?.photo?.[0]?.path || '';
      const attachedDocUrl = req.files?.attachedDoc?.[0]?.path || '';
      const visaCardImageUrl = req.files?.visaCardImage?.[0]?.path || '';

      const newVisa = new Visa({
        fullName: fullName.toString().trim(),
        nationality: nationality ? nationality.toString().trim() : 'ETHIOPIA',
        passcode: cleanPasscode,
        visaNumber: visaNumber.toString().trim(),
        passportNumber: passportNumber.toString().trim(),
        visaType: visaType ? visaType.toString().trim() : '',
        occupation: occupation ? occupation.toString().trim() : '',
        gender: gender ? gender.toString().trim() : '',
        birthDate: parseDate(birthDate),
        issueDate: parseDate(issueDate),
        expiryDate: parseDate(expiryDate),
        photoUrl,
        attachedDocUrl,
        visaCardImageUrl,
      });

      await newVisa.save();

      return res.status(201).json({
        success: true,
        message: 'Visa Record Registered Successfully!',
        data: newVisa,
      });
    } catch (error) {
      console.error('Registration error:', error);

      if (error.code === 11000) {
        const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
        return res.status(400).json({
          success: false,
          message: `A record with this ${duplicateField} already exists.`,
        });
      }

      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to register visa record.',
      });
    }
  }
);

// 5. Public Verification / OTP Search Endpoint (Case-Insensitive Exact Match)
router.post('/verify', async (req, res) => {
  try {
    console.log('[Verification Request Payload]:', req.body);

    const inputPasscode = (
      req.body.passcode ||
      req.body.otp ||
      req.body.code ||
      req.body.accessCode ||
      ''
    )
      .toString()
      .trim();

    const visaNumber = (req.body.visaNumber || '').toString().trim();
    const passportNumber = (req.body.passportNumber || '').toString().trim();

    if (!inputPasscode && !visaNumber && !passportNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please enter an OTP / Passcode or Visa Number.',
      });
    }

    const searchConditions = [];

    if (inputPasscode) {
      searchConditions.push({ passcode: { $regex: `^${inputPasscode}$`, $options: 'i' } });
    }
    if (visaNumber) {
      searchConditions.push({ visaNumber: { $regex: `^${visaNumber}$`, $options: 'i' } });
    }
    if (passportNumber) {
      searchConditions.push({ passportNumber: { $regex: `^${passportNumber}$`, $options: 'i' } });
    }

    const visaRecord = await Visa.findOne({ $or: searchConditions });

    if (!visaRecord) {
      return res.status(404).json({
        success: false,
        message: 'Invalid OTP / Passcode or no matching visa record found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Verification successful!',
      data: visaRecord,
    });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during verification. Please try again.',
    });
  }
});

// 6. Get All Visas Endpoint (Admin List)
router.get('/all', async (req, res) => {
  try {
    const records = await Visa.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: records.length, data: records });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve visa records.' });
  }
});

// 7. Update Existing Visa Record
router.put(
  '/:id',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'attachedDoc', maxCount: 1 },
    { name: 'visaCardImage', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const existingRecord = await Visa.findById(id);

      if (!existingRecord) {
        return res.status(404).json({ success: false, message: 'Visa record not found.' });
      }

      const updateData = { ...req.body };

      if (req.body.birthDate) updateData.birthDate = parseDate(req.body.birthDate);
      if (req.body.issueDate) updateData.issueDate = parseDate(req.body.issueDate);
      if (req.body.expiryDate) updateData.expiryDate = parseDate(req.body.expiryDate);

      if (req.files?.photo?.[0]?.path) updateData.photoUrl = req.files.photo[0].path;
      if (req.files?.attachedDoc?.[0]?.path) updateData.attachedDocUrl = req.files.attachedDoc[0].path;
      if (req.files?.visaCardImage?.[0]?.path) updateData.visaCardImageUrl = req.files.visaCardImage[0].path;

      const updatedVisa = await Visa.findByIdAndUpdate(id, updateData, { new: true });

      return res.status(200).json({
        success: true,
        message: 'Visa record updated successfully.',
        data: updatedVisa,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message || 'Update failed.' });
    }
  }
);

// 8. Delete Visa Record Endpoint
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Visa.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Record not found.' });
    }
    return res.status(200).json({ success: true, message: 'Visa record deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete visa record.' });
  }
});

module.exports = router;