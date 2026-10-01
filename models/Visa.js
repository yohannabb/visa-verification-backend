// models/Visa.js
const mongoose = require('mongoose');

const visaSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Please add full name'],
      trim: true,
    },
    nationality: {
      type: String,
      trim: true,
    },
    passcode: {
      type: String,
      required: [true, 'Please add passcode / access code'],
      unique: true,
      trim: true,
    },
    visaNumber: {
      type: String,
      required: [true, 'Please add visa number'],
      trim: true,
    },
    passportNumber: {
      type: String,
      required: [true, 'Please add passport number'],
      trim: true,
    },
    visaType: {
      type: String,
      trim: true,
    },
    occupation: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
    },
    birthDate: {
      type: Date,
    },
    issueDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
    },
    photoUrl: {
      type: String,
      default: '',
    },
    attachedDocUrl: {
      type: String,
      default: '',
    },
    visaCardImageUrl: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Visa', visaSchema);