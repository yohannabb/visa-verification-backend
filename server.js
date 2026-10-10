const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB Atlas
connectDB();

const app = express();

// Permissive CORS configuration to accept requests from any frontend domain (Netlify, localhost, etc.)
app.use(cors({
  origin: true, // Automatically reflects the incoming request origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Fallback safety middleware to ensure CORS headers are always attached even on preflight or exceptions
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Enable body parsing BEFORE routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Global Error:', err);

  if ((multer && err instanceof multer.MulterError) || err.name === 'MulterError') {
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