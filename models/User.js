const mongoose = require('mongoose');

// Define user schema
const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true,  // Ensures no leading/trailing spaces
        minlength: [3, 'Username must be at least 3 characters long']  // Optional: Minimum length for username
    },
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        lowercase: true,  // Ensures email is saved in lowercase
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']  // Regex to validate email format
    },
    password: { 
        type: String, 
        required: true 
    }
}, { timestamps: true });  // Adds createdAt and updatedAt fields

// Export the User model
module.exports = mongoose.model('User', userSchema);
