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
    folder: 'visa_verification_docs', // Folder name in Cloudinary account
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

// 3. Admin Login Endpoint
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

  if (username === adminUser && password === adminPass) {
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
        return res.status(400).json({ 
          success: false, 
          message: 'Required fields are missing (Passcode, Full Name, Passport, or Visa Number).' 
        });
      }

      const existing = await Visa.findOne({ passcode: passcode.trim() });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Access Code / OTP (Passcode) already exists.',
        });
      }

      // Extract full HTTPS Cloudinary URLs safely from req.files
      const photoUrl = req.files?.photo?.[0]?.path || '';
      const attachedDocUrl = req.files?.attachedDoc?.[0]?.path || '';
      const visaCardImageUrl = req.files?.visaCardImage?.[0]?.path || '';

      const newVisa = new Visa({
        fullName: fullName.trim(),
        nationality: nationality ? nationality.trim() : 'ETHIOPIA',
        passcode: passcode.trim(),
        visaNumber: visaNumber.trim(),
        passportNumber: passportNumber.trim(),
        visaType,
        occupation,
        gender,
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
      
      // Handle Mongo Duplicate Key Error (code 11000)
      if (error.code === 11000) {
        const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
        return res.status(400).json({ 
          success: false, 
          message: `A record with this ${duplicateField} already exists.` 
        });
      }

      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to register visa record.' 
      });
    }
  }
);

// 5. Public Verification Endpoint (Search by Passcode or Visa Number)
router.post('/verify', async (req, res) => {
  try {
    const { passcode, visaNumber, passportNumber } = req.body;

    const query = {};
    if (passcode) query.passcode = passcode.trim();
    if (visaNumber) query.visaNumber = visaNumber.trim();
    if (passportNumber) query.passportNumber = passportNumber.trim();

    if (Object.keys(query).length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide search criteria.' });
    }

    const visaRecord = await Visa.findOne(query);
    if (!visaRecord) {
      return res.status(404).json({ success: false, message: 'No visa record found matching the details provided.' });
    }

    return res.status(200).json({ success: true, data: visaRecord });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ success: false, message: 'Server error during verification.' });
  }
});

// 6. Get All Visas Endpoint (Admin Dashboard List)
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

      // Parse dates if provided
      if (req.body.birthDate) updateData.birthDate = parseDate(req.body.birthDate);
      if (req.body.issueDate) updateData.issueDate = parseDate(req.body.issueDate);
      if (req.body.expiryDate) updateData.expiryDate = parseDate(req.body.expiryDate);

      // Overwrite URLs if new files were uploaded
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