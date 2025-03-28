require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const flash = require("express-flash");
const MongoStore = require("connect-mongo");
const path = require("path");

const Conference = require("./models/Conference");
const conferenceRoutes = require("./routes/conferenceRoutes");
const registrationRoutes = require("./routes/registrationRoutes");
const authRoutes = require("./routes/authRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const bulkemailRoutes = require("./routes/bulkemailRoutes");
const markAttendanceRoutes = require("./routes/markAttendanceRoutes");

const app = express();

// Static Files
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Body Parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/conferenceDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// ✅ Corrected: Session Setup (Only Once)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/conferenceDB",
    }),
  })
);

// ✅ Corrected: Flash Messages (After Session)
app.use(flash());

// ✅ Middleware to Make Flash Messages Available in Views
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  res.locals.user = req.session.user; // Makes `user` available in all templates
  next();
});

// ✅ Move Reminder Routes AFTER flash is set up
app.use(reminderRoutes);

// Routes
app.use(conferenceRoutes);
app.use(authRoutes);
app.use(registrationRoutes);
app.use(bulkemailRoutes);
app.use(markAttendanceRoutes);

// Home Route
app.get("/", async (req, res) => {
  try {
    const conferences = await Conference.find(); // Fetch all conferences
    res.render("index", { conferences, user: req.session.user }); // Pass it to EJS
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Dashboard Route
app.get("/dashboard", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const conferences = await Conference.find({ createdBy: req.session.user._id });

  res.render("dashboard", { user: req.session.user, conferences });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
