const mongoose = require('mongoose');

const ConferenceSchema = new mongoose.Schema({
    title: { type: String, required: true },
    date: { type: String, required: true },
    organizer: { type: String, required: true },
    location: { type: String, required: true },
    type: { type: String, required: true },
    amount: { type: Number, default: 0 },
    deadline: { type: String, required: true },
    imageUrl: { type: String, default: '' }, // New field to store image URL
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } // Store user ID
});

module.exports = mongoose.model('Conference', ConferenceSchema);
