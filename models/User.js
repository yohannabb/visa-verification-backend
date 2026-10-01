// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true, // Allows documents without a username to coexist
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // Allows login by username without enforcing email requirement
      lowercase: true,
      trim: true,
    //   match: [
    //     /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
    //     'Please add a valid email',
    //   ],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 4,
      select: false, // Prevents returning password by default in queries
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
  },
  {
    timestamps: true,
  }
);

// Hash password using bcrypt before saving (Async style for Mongoose v6/v7+)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) {
    throw new Error('Password field not selected in query');
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);