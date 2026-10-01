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
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
  },
});

const upload = multer({ storage });

// 3. Admin Login Endpoint
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    return res.status(200).json({ success: true, message: 'Authenticated successfully' });
  }
  return res.status(401).json({ success: false, message: 'Invalid Admin Credentials' });
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
        return res.status(400).json({ success: false, message: 'Required fields are missing.' });
      }

      const existing = await Visa.findOne({ passcode: passcode.trim() });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Access Code / OTP (Passcode) already exists.',
        });
      }

      // Cloudinary automatically returns secure web URLs in path
      const photoUrl = req.files?.photo?.[0] ? req.files.photo[0].path : '';
      const attachedDocUrl = req.files?.attachedDoc?.[0] ? req.files.attachedDoc[0].path : '';
      const visaCardImageUrl = req.files?.visaCardImage?.[0] ? req.files.visaCardImage[0].path : '';

      const newVisa = new Visa({
        fullName,
        nationality,
        passcode: passcode.trim(),
        visaNumber,
        passportNumber,
        visaType,
        occupation,
        gender,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        issueDate: issueDate ? new Date(issueDate) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
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
      return res.status(500).json({ success: false, message: error.message || 'Failed to register visa record.' });
    }
  }
);

// 5. Verification Endpoint
router.post('/verify', async (req, res) => {
  try {
    const { passcode } = req.body;
    if (!passcode) return res.status(400).json({ success: false, message: 'Passcode is required.' });

    const visaRecord = await Visa.findOne({ passcode: passcode.trim() });
    if (!visaRecord) return res.status(404).json({ success: false, message: 'Invalid passcode or visa record not found.' });

    return res.status(200).json({ success: true, data: visaRecord });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error during verification.' });
  }
});

module.exports = router;