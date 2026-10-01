const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Adjust path to your User model

mongoose.connect('mongodb://127.0.0.1:27017/your_database_name')
  .then(async () => {
    const email = 'admin@mols.gov.et';
    const rawPassword = 'AdminPassword123!';

    // Check if admin already exists
    let user = await User.findOne({ email });

    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    if (user) {
      // Update existing user password and role
      user.password = hashedPassword;
      user.role = 'admin';
      await user.save();
      console.log('Admin account password updated successfully!');
    } else {
      // Create new admin
      user = new User({
        fullName: 'System Administrator',
        email,
        password: hashedPassword,
        role: 'admin'
      });
      await user.save();
      console.log('Admin account created successfully!');
    }

    console.log(`\nYour Login Credentials:\nEmail: ${email}\nPassword: ${rawPassword}\n`);
    mongoose.connection.close();
  })
  .catch((err) => console.error(err));