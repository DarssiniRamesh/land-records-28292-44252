//
// Land Records Management System - BackendAPIService(Node.js/Express)
// Central business logic and API gateway - NO persistent DB (in-memory demo only)
// Features: User Auth, RBAC, Workflows, Documents, Payments, Notifications, Sample Data
//

const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// --- Configuration ---
const JWT_SECRET = 'ChangeThisSecretForProduction!'; // For demo only.
const PORT = process.env.PORT || 3001;
const DEMO_OFFICER_EMAIL = 'officer@gov.in';
const DEMO_ADMIN_EMAIL = 'admin@gov.in';

// --- Sample Data Stores (In-Memory) ---
const users = [
  {
    id: uuidv4(),
    name: "Demo Citizen",
    email: "citizen@example.com",
    password: "citizenpass",
    role: "citizen",
    language: 'en'
  },
  {
    id: uuidv4(),
    name: "Land Officer",
    email: DEMO_OFFICER_EMAIL,
    password: "officerpass",
    role: "officer",
    language: 'en'
  },
  {
    id: uuidv4(),
    name: "System Admin",
    email: DEMO_ADMIN_EMAIL,
    password: "adminpass",
    role: "admin",
    language: 'en'
  }
];

const plots = [
  // Each plot includes dummy GIS data and an assigned owner (user email)
  {
    plotId: "PLOT123",
    location: { lat: 28.7041, lng: 77.1025 },
    area: 1000,
    type: "agricultural",
    currentOwnerEmail: "citizen@example.com",
    status: "active",
    boundaries: [
      { lat: 28.7041, lng: 77.1025 },
      { lat: 28.7051, lng: 77.1125 },
      { lat: 28.7061, lng: 77.1090 }
    ]
  }
];

const applications = [
  // Sample application (e.g., mutation request)
  // We can add new applications via API
];

const notifications = [];
const payments = [];
const documents = [];

// --- App and Middleware ---
const app = express();

app.use(cors());
app.use(bodyParser.json());
const upload = multer({ storage: multer.memoryStorage() });

// --- Helper: RBAC Middleware ---
/**
 * PUBLIC_INTERFACE
 * Middleware to check if a user has sufficient role access.
 * @param {string[]} allowedRoles - Allowed user roles
 */
function authorizeRoles(allowedRoles) {
  return function (req, res, next) {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Missing token' });
    try {
      const payload = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
      req.user = payload;
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }
}

// --- Helper: Notification Trigger ---
/**
 * PUBLIC_INTERFACE
 * Sends a notification and stores it in in-memory store.
 */
function sendNotification(toUserId, message) {
  notifications.push({
    id: uuidv4(),
    toUserId,
    message,
    ts: new Date()
  });
}

// --- Auth APIs ---

/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: Register a new user (citizen)
 *     tags: [Auth]
 */
// PUBLIC_INTERFACE
app.post('/api/register', (req, res) => {
  const { name, email, password, language } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (users.some(u => u.email === email)) {
    return res.status(409).json({ error: "User already exists" });
  }
  const user = {
    id: uuidv4(), name, email, password, role: "citizen", language: language || 'en'
  };
  users.push(user);
  sendNotification(user.id, "Registration successful. Welcome!");
  return res.status(201).json({ message: 'Registration successful' });
});

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 */
// PUBLIC_INTERFACE
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "12h" });
  return res.json({ token, role: user.role, language: user.language, name: user.name });
});


// --- User Profile (Citizen, Officer, Admin) ---

/**
 * @swagger
 * /api/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [User]
 */
// PUBLIC_INTERFACE
app.get('/api/me', authorizeRoles(["citizen", "officer", "admin"]), (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { password, ...profile } = user;
  return res.json(profile);
});

// --- Land Plot Search & Details ---

/**
 * @swagger
 * /api/plots:
 *   get:
 *     summary: List/search all land plots
 *     tags: [Plot]
 *     parameters:
 *       - in: query
 *         name: ownerEmail
 *         schema:
 *           type: string
 *         description: Filter by current owner email
 */
// PUBLIC_INTERFACE
app.get('/api/plots', authorizeRoles(["citizen", "officer", "admin"]), (req, res) => {
  const { ownerEmail } = req.query;
  let filtered = plots;
  if (ownerEmail) {
    filtered = filtered.filter(p => p.currentOwnerEmail === ownerEmail);
  }
  res.json(filtered);
});

/**
 * @swagger
 * /api/plots/{plotId}:
 *   get:
 *     summary: Details of a plot
 *     tags: [Plot]
 */
// PUBLIC_INTERFACE
app.get('/api/plots/:plotId', authorizeRoles(["citizen", "officer", "admin"]), (req, res) => {
  const p = plots.find(p => p.plotId === req.params.plotId);
  if (!p) return res.status(404).json({ error: "Plot not found" });
  res.json(p);
});

// --- Applications (Mutation, Correction, Conversion) ---

/**
 * @swagger
 * /api/applications:
 *   get:
 *     summary: List applications (RBAC)
 *     tags: [Application]
 */
// PUBLIC_INTERFACE
app.get('/api/applications', authorizeRoles(["citizen", "officer", "admin"]), (req, res) => {
  // Citizens: own apps | Officer/Admin: all
  if (req.user.role === "citizen") {
    res.json(applications.filter(a => a.applicantEmail === req.user.email));
  } else {
    res.json(applications);
  }
});

/**
 * @swagger
 * /api/applications:
 *   post:
 *     summary: Submit a new application
 *     tags: [Application]
 */
// PUBLIC_INTERFACE
app.post('/api/applications', authorizeRoles(["citizen"]), (req, res) => {
  const { applicationType, plotId, documents: docLinks, reason, language } = req.body;
  if (!applicationType || !plotId || !docLinks) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (!["mutation", "correction", "conversion"].includes(applicationType)) {
    return res.status(400).json({ error: "Invalid application type" });
  }
  const plot = plots.find(p => p.plotId === plotId && p.currentOwnerEmail === req.user.email);
  if (!plot) return res.status(400).json({ error: "Plot does not belong to you" });
  const app = {
    id: uuidv4(),
    applicationType,
    applicant: req.user.name,
    applicantEmail: req.user.email,
    plotId,
    applicationStatus: "submitted",
    date: new Date(),
    documents: docLinks,
    reason: reason || null,
    officerAssigned: null,
    paymentStatus: "pending",
    history: []
  };
  applications.push(app);
  sendNotification(req.user.id, "Application submitted successfully. Please complete payment.");
  return res.status(201).json(app);
});

/**
 * @swagger
 * /api/applications/{id}/status:
 *   post:
 *     summary: Officer updates application status
 *     tags: [Application]
 */
// PUBLIC_INTERFACE
app.post('/api/applications/:id/status', authorizeRoles(["officer", "admin"]), (req, res) => {
  const appId = req.params.id;
  const { status, remarks } = req.body;
  const app = applications.find(a => a.id === appId);
  if (!app) return res.status(404).json({ error: "Not found" });
  app.applicationStatus = status;
  if (!app.history) app.history = [];
  app.history.push({
    by: req.user.role,
    at: new Date(),
    status,
    remarks
  });
  sendNotification(users.find(u => u.email === app.applicantEmail).id,
    `Application status updated to: ${status}`);
  return res.json(app);
});

// --- Document Upload ---

/**
 * @swagger
 * /api/documents/upload:
 *   post:
 *     summary: Upload a document (multer, stores in-memory)
 *     tags: [Documents]
 */
// PUBLIC_INTERFACE
app.post('/api/documents/upload', authorizeRoles(["citizen", "officer", "admin"]), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const docId = uuidv4();
  documents.push({
    id: docId,
    fileName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    data: req.file.buffer,  // In-memory storage only for demo!
    uploadedBy: req.user.email,
    uploadedAt: new Date()
  });
  sendNotification(req.user.id, "Document uploaded successfully");
  res.json({ documentId: docId });
});

// --- Payments (Demo Logic) ---

/**
 * @swagger
 * /api/payments/initiate:
 *   post:
 *     summary: Initiate a payment for an application
 *     tags: [Payment]
 */
// PUBLIC_INTERFACE
app.post('/api/payments/initiate', authorizeRoles(["citizen"]), (req, res) => {
  const { applicationId, amount } = req.body;
  if (!applicationId || typeof amount !== 'number') {
    return res.status(400).json({ error: "Missing or invalid payment details" });
  }
  const app = applications.find(a => a.id === applicationId && a.applicantEmail === req.user.email);
  if (!app) return res.status(404).json({ error: "Application not found" });
  if (app.paymentStatus === "completed") return res.status(409).json({ error: "Already paid" });
  const paymentId = uuidv4();
  payments.push({
    id: paymentId,
    applicationId,
    amount,
    status: "initiated",
    paidBy: req.user.email,
    date: new Date()
  });
  app.paymentStatus = "completed";
  sendNotification(req.user.id, `Payment successful for application: ${applicationId}`);
  res.json({ paymentId, status: "completed" });
});

// --- Notifications ---

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Retrieve notifications for current user
 *     tags: [Notification]
 */
// PUBLIC_INTERFACE
app.get('/api/notifications', authorizeRoles(["citizen", "officer", "admin"]), (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  res.json(notifications.filter(n => n.toUserId === user.id));
});

// --- Sample Data: Reset/Repopulate ---

/**
 * @swagger
 * /api/sample/reset:
 *   post:
 *     summary: Reset all in-memory data to demo state (admin only)
 *     tags: [SampleData]
 */
// PUBLIC_INTERFACE
app.post('/api/sample/reset', authorizeRoles(["admin"]), (req, res) => {
  while (users.length > 3) users.pop();
  while (plots.length > 1) plots.pop();
  applications.splice(0, applications.length);
  notifications.splice(0, notifications.length);
  payments.splice(0, payments.length);
  documents.splice(0, documents.length);
  res.json({ message: "Sample/demo data reset to initial state" });
});

// --- Language Switch (for User) ---
/**
 * @swagger
 * /api/user/language:
 *   post:
 *     summary: Switch current user's preferred language (en/hi)
 *     tags: [User]
 */
// PUBLIC_INTERFACE
app.post('/api/user/language', authorizeRoles(["citizen", "officer", "admin"]), (req, res) => {
  const { language } = req.body;
  if (!["en", "hi"].includes(language)) return res.status(400).json({ error: "Unsupported lang" });
  const user = users.find(u => u.id === req.user.id);
  user.language = language;
  res.json({ message: "Language updated", language });
});

// --- API Gateway default/fallback ---
app.use('/api', (req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

// --- Welcome/Health ---
app.get('/', (req, res) => {
  res.send("Land Records Management System API - see /api/*");
});

// --- Start the server ---
app.listen(PORT, () => {
  console.log(`BackendAPIService(Node.js/Express) running on port ${PORT}`);
});
