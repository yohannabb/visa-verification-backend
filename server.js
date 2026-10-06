const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB Atlas
connectDB();

const app = express();

// Allowed Origins List
const allowedOrigins = [
  'https://mols-doc-checker.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

if (process.env.CLIENT_URL) {
  const customOrigin = process.env.CLIENT_URL.trim();
  if (customOrigin && !allowedOrigins.includes(customOrigin)) {
    allowedOrigins.push(customOrigin);
  }
}

// Strict CORS Configuration
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy violation: Access denied for this origin.'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Enable body parsing BEFORE routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Local fallback uploads directory with safety wrapper
const uploadsPath = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
} catch (err) {
  console.warn('ℹ️ Local uploads folder could not be initialized.');
}

app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Mount API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/visa', require('./routes/visaRoutes'));

// Healthcheck Route
app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Visa Verification API with Cloudinary is running successfully...' });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// Global Error Handling Middleware (Returns the EXACT error message to frontend)
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  
  // Handle Multer/Cloudinary specific errors
  if (err instanceof multer.MulterError || err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});