require('dotenv').config();
const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path'); // Import missing path module
const User = require('./models/User');
const Conference = require('./models/Conference'); // Ensure correct path

const app = express();

// Set up Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/'); // Store images in 'public/uploads'
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Rename file with timestamp
    }
});
const upload = multer({ storage }); // Define multer with proper storage

// Middleware
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/conferenceDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Session setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/conferenceDB'
    })
}));
app.use((req, res, next) => {
    res.locals.user = req.user;  // Makes `user` available in all templates
    next();
});


// Home Route
app.get('/', async (req, res) => {
    try {
        const conferences = await Conference.find(); // Fetch conferences from DB
        res.render('index', { conferences }); // Pass conferences to index.ejs
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});
// Sign Up Routes
app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup', async (req, res) => {
    const { username, email, password, terms } = req.body;

    if (!terms) {
        return res.status(400).send('You must agree to the Terms and Conditions.');
    }

    if (username.length < 3) {
        return res.status(400).send('Username must be at least 3 characters long.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).send('Please enter a valid email address.');
    }

    if (password.length < 6) {
        return res.status(400).send('Password must be at least 6 characters long.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    res.redirect('/login');
});



// Privacy Policy Route
app.get('/privacy', (req, res) => {
    res.render('privacy');
});

// Terms and Conditions Route
app.get('/terms', (req, res) => {
    res.render('terms');
});



// Login Routes
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) return res.render('login', { error: 'Both fields are required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.render('login', { error: 'Invalid email format.' });

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.render('login', { error: 'Invalid email or password.' });
    }

    req.session.user = user;
    res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send("Logout failed");
        }
        res.redirect('/login');
    });
});


// Dashboard Route
app.get('/dashboard', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const conferences = await Conference.find({ createdBy: req.session.user._id });
    
    res.render('dashboard', { user: req.session.user, conferences });

    
});

// Add Conference Routes
app.get("/add-conference", (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('addConference', { type: 'unpaid', amount: '' }); 
});

app.post('/add-conference', upload.single('image'), async (req, res) => {
    if (!req.session.user) return res.status(401).send('Unauthorized');

    const { title, date, organizer, location, type, amount, deadline } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';

    try {
        const newConference = new Conference({
            title, date, organizer, location, type,
            amount: type === "paid" ? amount : null,
            deadline, imageUrl, createdBy: req.session.user._id
        });

        await newConference.save();
        res.redirect('/dashboard');
    } catch (err) {
        res.status(500).send("Error saving conference");
    }
});

// Edit Conference Routes
app.get('/edit-conference/:id', async (req, res) => {
    try {
        const conference = await Conference.findById(req.params.id);
        if (!conference) return res.status(404).send("Conference not found");
        res.render('editConference', { conference });
    } catch (err) {
        res.status(500).send("Error fetching conference details");
    }
});

app.post("/update-conference/:id", async (req, res) => {
    try {
        await Conference.findByIdAndUpdate(req.params.id, req.body);
        res.redirect("/dashboard");
    } catch (err) {
        res.status(500).send("Error updating conference details");
    }
});

// Delete Conference Route
app.delete('/delete-conference/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    try {
        const conference = await Conference.findOneAndDelete({
            _id: req.params.id, createdBy: req.session.user._id
        });

        if (!conference) return res.status(404).json({ success: false, message: 'Conference not found' });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Send Bulk Email Routes
app.get('/send-bulk-mail', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const conferenceTitle = req.query.conferenceTitle || "Conference";
    const conferenceDate = req.query.conferenceDate || "TBD";
    const conferenceOrganizer = req.query.conferenceOrganizer || "Organizer";

    res.render("send-bulk-mail", { conferenceTitle, conferenceDate, conferenceOrganizer });
});

app.post('/send-bulk-mail', upload.single('attachment'), async (req, res) => {
    const { recipients, subject, message } = req.body;
    const recipientList = recipients.split(',').map(email => email.trim());

    if (!req.session || !req.session.user || !req.session.user.email) {
        return res.status(401).json({ success: false, message: 'Unauthorized: User not logged in' });
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    const mailOptions = {
        from: `"${req.session.user.email} " <no reply >`, // Fake sender, actual mail hidden
        replyTo: req.session.user.email, // Replies go to the logged-in user
        to: recipientList,
        subject,
        html: message,
        attachments: req.file ? [{ filename: req.file.originalname, path: req.file.path }] : []
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Emails sent successfully!' });
    } catch (error) {
        console.error("Mail Error:", error);
        res.status(500).json({ success: false, message: 'Failed to send emails.', error: error.message });
    }
});


app.get('/conferenceDetail/:id', async (req, res) => {
    const conferenceId = req.params.id;

    try {
        const conference = await Conference.findById(conferenceId);
        if (!conference) {
            return res.status(404).send("Conference not found");
        }

        res.render('conferenceDetail', { conference });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/conference/:id', async (req, res) => {
    try {
        const conference = await Conference.findById(req.params.id);
        res.render('conferenceDetail', { conference, user: req.user });  // Ensure user is passed
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
