// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB Atlas
connectDB();

// Verify Cloudinary Credentials on Startup
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('⚠️ Warning: Cloudinary environment variables are missing in process.env!');
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'visa_verification_docs',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
  },
});

const upload = multer({ storage });

const app = express();

// FIXED: Removed credentials: true when origin is '*' so CORS preflight requests succeed
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Enable body parsing BEFORE routes (CRITICAL for req.body)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Local fallback uploads directory
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

app.set('upload', upload);

// Mount API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/visa', require('./routes/visaRoutes'));

// Healthcheck Route
app.get('/', (req, res) => {
  res.send('Visa Verification API with Cloudinary is running successfully...');
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});