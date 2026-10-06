// routes/visaRoutes.js
const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Visa = require('../models/Visa');

const router = express.Router();

// Verify Cloudinary Environment Variables
const hasCloudinaryKeys = 
  Boolean(process.env.CLOUDINARY_CLOUD_NAME) && 
  Boolean(process.env.CLOUDINARY_API_KEY) && 
  Boolean(process.env.CLOUDINARY_API_SECRET);

let storage;

if (hasCloudinaryKeys) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'visa_verification_docs',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    },
  });
} else {
  console.warn('⚠️ Cloudinary keys missing in environment variables! Using disk storage fallback.');
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, '/tmp'), // Safe temporary write path on Render
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`)
  });
}

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware to handle Multer upload errors cleanly using upload.any()
const handleUpload = (req, res, next) => {
  // upload.any() accepts any file field key from FormData to prevent Unexpected File Field errors
  upload.any()(req, res, (err) => {
    if (err) {
      console.error('❌ [Multer Upload Error]:', err);
      return res.status(400).json({
        success: false,
        message: `File upload failed: ${err.message || 'Error processing uploaded files.'}`
      });
    }
    next();
  });
};

// Safe date parser to avoid CastError in Mongoose
const parseDate = (dateStr) => {
  if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return undefined;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? undefined : parsed;
};

// Helper function to dynamically match uploaded files from req.files array
const getFilePathByKeys = (files, ...possibleFieldNames) => {
  if (!files || !Array.isArray(files) || files.length === 0) return '';
  
  for (const name of possibleFieldNames) {
    const matchedFile = files.find((f) => f.fieldname === name);
    if (matchedFile) {
      return matchedFile.path || matchedFile.secure_url || (matchedFile.filename ? `/uploads/${matchedFile.filename}` : '');
    }
  }
  return '';
};

// 1. Admin Login Endpoint
router.post('/admin/login', (req, res) => {
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

  const allowedIdentifiers = [
    'admin',
    'admin@gmail.com',
    'admin@mols.gov',
    (process.env.ADMIN_USERNAME || '').toLowerCase(),
    (process.env.ADMIN_EMAIL || '').toLowerCase(),
  ].filter(Boolean);

  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (allowedIdentifiers.includes(loginIdentifier) && password === expectedPassword) {
    const adminData = {
      token: 'admin-auth-token-valid',
      role: 'admin',
      email: loginIdentifier,
      username: 'admin',
    };

    return res.status(200).json({
      success: true,
      message: 'Authenticated successfully',
      token: 'admin-auth-token-valid',
      data: adminData,
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid admin email/username or password.',
  });
});

// 2. Register New Visa Record
router.post('/register', handleUpload, async (req, res) => {
  console.log('--- NEW VISA REGISTRATION REQUEST ---');
  console.log('[Payload Body]:', req.body);
  console.log('[Uploaded Files Count]:', req.files ? req.files.length : 0);

  try {
    const {
      fullName,
      nationality,
      passcode,
      otp,
      visaNumber,
      passportNumber,
      visaType,
      occupation,
      gender,
      birthDate,
      issueDate,
      expiryDate,
    } = req.body;

    const rawPasscode = passcode || otp;

    if (!rawPasscode || !fullName || !passportNumber || !visaNumber) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: Passcode/OTP, Full Name, Passport, or Visa Number.',
      });
    }

    const cleanPasscode = rawPasscode.toString().trim();

    // Check for existing passcode
    const existing = await Visa.findOne({
      passcode: { $regex: `^${cleanPasscode}$`, $options: 'i' },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Access Code / OTP (Passcode) already exists in the database.',
      });
    }

    // Extract file paths using field name matching or array index fallback
    const photoUrl =
      getFilePathByKeys(req.files, 'applicantPhoto', 'photo', 'profileImage', 'image', 'avatar') ||
      (req.files?.[0] ? (req.files[0].path || req.files[0].secure_url) : '');

    const attachedDocUrl =
      getFilePathByKeys(req.files, 'attachedDocument', 'attachedDoc', 'document', 'pdf', 'file') ||
      (req.files?.[1] ? (req.files[1].path || req.files[1].secure_url) : '');

    const visaCardImageUrl =
      getFilePathByKeys(req.files, 'bottomVisaGraphic', 'visaCardImage', 'visaGraphic', 'cardImage') ||
      (req.files?.[2] ? (req.files[2].path || req.files[2].secure_url) : '');

    // Construct Mongoose Document
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

    const savedRecord = await newVisa.save();

    console.log('✅ Visa Record Saved Successfully:', savedRecord._id);

    return res.status(201).json({
      success: true,
      message: 'Visa Record Registered Successfully!',
      data: savedRecord,
    });
  } catch (error) {
    console.error('❌ [Database Save Error]:', error);

    // Mongoose duplicate key error
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        message: `A visa record with this ${duplicateField} already exists.`,
      });
    }

    // Mongoose schema validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: `Validation Error: ${messages.join(', ')}`,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error while saving visa record.',
    });
  }
});

// 3. Public Verification Endpoint
const handleVerification = async (req, res) => {
  try {
    const payload = { ...req.query, ...req.body };

    const inputPasscode = (
      payload.passcode ||
      payload.passCode ||
      payload.otp ||
      payload.OTP ||
      payload.code ||
      payload.accessCode ||
      payload.access_code ||
      ''
    )
      .toString()
      .trim();

    const visaNumber = (payload.visaNumber || payload.visanumber || '').toString().trim();
    const passportNumber = (payload.passportNumber || payload.passportnumber || '').toString().trim();

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
};

router.post('/verify', handleVerification);
router.get('/verify', handleVerification);

// 4. Get All Visas Endpoint
router.get('/all', async (req, res) => {
  try {
    const records = await Visa.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: records.length, data: records });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve visa records.' });
  }
});

// 5. Update Visa Record
router.put('/:id', handleUpload, async (req, res) => {
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

    const photoPath = getFilePathByKeys(req.files, 'applicantPhoto', 'photo', 'profileImage', 'image', 'avatar');
    const attachedDocPath = getFilePathByKeys(req.files, 'attachedDocument', 'attachedDoc', 'document', 'pdf', 'file');
    const visaCardImagePath = getFilePathByKeys(req.files, 'bottomVisaGraphic', 'visaCardImage', 'visaGraphic', 'cardImage');

    if (photoPath) updateData.photoUrl = photoPath;
    if (attachedDocPath) updateData.attachedDocUrl = attachedDocPath;
    if (visaCardImagePath) updateData.visaCardImageUrl = visaCardImagePath;

    const updatedVisa = await Visa.findByIdAndUpdate(id, updateData, { new: true });

    return res.status(200).json({
      success: true,
      message: 'Visa record updated successfully.',
      data: updatedVisa,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Update failed.' });
  }
});

// 6. Delete Visa Record
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