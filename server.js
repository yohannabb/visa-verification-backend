// server.js
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

// Ensure 'uploads' directory exists on startup for static file serving
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// Middleware: Enable CORS & Body Parsers
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory (ensures uploaded images/docs are publicly accessible)
app.use('/uploads', express.static(uploadsPath));

// Mount API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/visa', require('./routes/visaRoutes'));

// Global Healthcheck Route
app.get('/', (req, res) => {
  res.send('Visa Verification API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});