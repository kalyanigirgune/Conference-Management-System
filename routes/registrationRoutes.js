require('dotenv').config();
const express = require('express');
const router = express.Router();
const Registration = require("../models/Registration");
const Conference = require('../models/Conference');
const cloudinary = require('cloudinary').v2;
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const flash = require('express-flash');
const Razorpay = require('razorpay');
// Ensure `express-session` is configured in `app.js`
router.use((req, res, next) => {
    res.locals.user = req.user;
    res.locals.messages = req.flash();
    next();
});

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});
// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// GET: Registration Form
router.get('/register/:id', async (req, res) => {
    try {
        const conference = await Conference.findById(req.params.id);
        if (!conference) {
            req.flash('error', 'Conference not found.');
            return res.redirect('/');
        }

        res.render('register', { conferenceId: req.params.id });
    } catch (err) {
        console.error('Error fetching conference:', err);
        req.flash('error', 'Server error. Please try again later.');
        res.redirect('/');
    }
});

// POST: Handle Registration Submission
router.post('/register/:id', async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        if (!name || !email || !phone) {
            return res.json({ success: false, message: 'All fields are required.' });
        }

        const conferenceId = req.params.id;
        const conference = await Conference.findById(conferenceId);
        if (!conference) {
            return res.json({ success: false, message: 'Conference not found.' });
        }

        // Check if the registration deadline has passed
        if (new Date(conference.deadline) < new Date()) {
            return res.json({ success: false, message: 'Registration deadline has passed.' });
        }

        // **Check if the user is already registered**
        const existingRegistration = await Registration.findOne({ conferenceId, email });
        if (existingRegistration) {
            return res.json({ success: false, message: 'You have already registered for this conference.' });
        }

        // Generate QR Code
        const qrData = `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nConference: ${conference.title}`;
        const qrCodeDataUrl = await QRCode.toDataURL(qrData);

        // Upload QR Code to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(qrCodeDataUrl, {
            folder: 'conference_qr_codes',
            public_id: `QR_${conferenceId}_${Date.now()}`
        });

        const qrCodeUrl = uploadResult.secure_url;

        // Save Registration
        const newRegistration = new Registration({ conferenceId, name, email, phone, qrCodeUrl });
        await newRegistration.save();

        // Send Confirmation Email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: `Registration Confirmation - ${conference.title}`,
            html: `<p>Dear ${name}, you have successfully registered for ${conference.title}. Your QR code is below:</p>
                   <img src="${qrCodeUrl}" alt="QR Code" style="max-width: 250px;">`
        };
        await transporter.sendMail(mailOptions);

        return res.json({ success: true, message: 'Registration successful! Check your email for confirmation.' });

    } catch (err) {
        console.error('Error processing registration:', err);
        return res.json({ success: false, message: 'Server error. Please try again later.' });
    }
});

// **Step 1: Send OTP**
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.json({ success: false, message: 'Email is required.' });

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000);

        // Store OTP in session
        req.session.otp = otp;
        req.session.email = email;

        // Send OTP via email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your Conference Registration OTP',
            text: `Your OTP for registration is: ${otp}`
        };

        await transporter.sendMail(mailOptions);
        return res.json({ success: true, message: 'OTP sent to your email.' });

    } catch (err) {
        console.error('Error sending OTP:', err);
        return res.json({ success: false, message: 'Error sending OTP. Try again.' });
    }
});

// **Step 2: Verify OTP**
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) return res.json({ success: false, message: 'Email and OTP are required.' });

        // Check if the OTP matches
        if (req.session.otp && req.session.otp == otp && req.session.email === email) {
            req.session.verified = true;  // Mark email as verified
            return res.json({ success: true, message: 'OTP verified successfully.' });
        }

        return res.json({ success: false, message: 'Invalid OTP. Try again.' });

    } catch (err) {
        console.error('Error verifying OTP:', err);
        return res.json({ success: false, message: 'Error verifying OTP. Try again.' });
    }
});

module.exports = router;
