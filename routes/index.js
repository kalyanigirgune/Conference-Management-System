const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Conference = require('../models/Conference');
const bcrypt = require('bcryptjs');

// Middleware for Authentication Check
function isAuthenticated(req, res, next) {
  if (req.session.userId) return next();
  res.redirect('/login');
}

// Home Route
router.get('/', (req, res) => {
  res.render('index');
});

// Login
router.get('/login', (req, res) => {
  res.render('login');
});

router.post('/login', async (req, res) => {
  const user = await User.findOne({ username: req.body.username });
  if (user && await bcrypt.compare(req.body.password, user.password)) {
    req.session.userId = user._id;
    res.redirect('/dashboard');
  } else {
    res.send('Invalid Credentials');
  }
});

// Dashboard
router.get('/dashboard', isAuthenticated, async (req, res) => {
  const conferences = await Conference.find({ created_by: req.session.userId });
  res.render('dashboard', { conferences });
});

// Conference Creation
router.get('/create', isAuthenticated, (req, res) => {
  res.render('create');
});

router.post('/create', isAuthenticated, async (req, res) => {
  const newConference = new Conference({
    ...req.body,
    created_by: req.session.userId
  });
  await newConference.save();
  res.redirect('/dashboard');
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
