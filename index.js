require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const bcrypt = require("bcryptjs");
const db = require("./firebase");
const sendEmail = require('./emailService');
const mpesaService = require('./mpesaService');
const hbs = require("hbs");

const app = express();
const port = 3000;

const admin = require('firebase-admin');

// Initialize Firebase Admin with environment variables
if (!admin.apps.length) {
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://quickfix-3c7dc-default-rtdb.firebaseio.com"
  });
}
// Hard-coded single admin credentials (override via env if needed)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@quickfix.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';



//Middleware
app.set('view engine', 'hbs');
app.set('views', 'views');
app.use(express.static('public'));
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies


app.use(session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true
}));

hbs.registerHelper("eq", function (a, b) {
    return a === b;
});

//date format helper
hbs.registerHelper('formatDate', (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString(); 
});

hbs.registerHelper('json', context => JSON.stringify(context));

// Attach pending ratings count for homeowner to all views
app.use(async (req, res, next) => {
  try {
    res.locals.currentUserRole = req.session?.user?.role;
    res.locals.pendingRatingsCount = 0;
    res.locals.pendingPaymentsCount = 0;
    res.locals.unreadChatCount = 0;
    res.locals.pendingApplicationsCount = 0;
    
    if (req.session && req.session.user && req.session.user.role === 'homeowner') {
      const userEmail = req.session.user.email;
      const requestSnapshot = await db.ref('requests')
        .orderByChild('homeownerEmail')
        .equalTo(userEmail)
        .once('value');

      if (requestSnapshot.exists()) {
        let count = 0;
        let payCount = 0;
        requestSnapshot.forEach((snap) => {
          const r = snap.val();
          if (r && r.status === 'Completed' && r.paid === true && r.rated !== true) {
            count += 1;
          }
          if (r && r.status === 'Completed' && r.paid !== true) {
            payCount += 1;
          }
        });
        res.locals.pendingRatingsCount = count;
        res.locals.pendingPaymentsCount = payCount;
      }
    }

    // Compute unread chats badge (simple: any new incoming message since lastSeenChatTs)
    if (req.session && req.session.user) {
      const userEmail = req.session.user.email;
      const lastSeen = req.session.lastSeenChatTs || 0;

      const reqSnap = await db.ref('requests').once('value');
      const participantIds = [];
      if (reqSnap.exists()) {
        reqSnap.forEach((child) => {
          const r = child.val();
          if (r && (r.homeownerEmail === userEmail || r.technicianEmail === userEmail)) {
            participantIds.push(child.key);
          }
        });
      }

      let unread = 0;
      for (const id of participantIds) {
        const lastMsg = await db.ref('conversations').child(id).orderByChild('timestamp').limitToLast(1).once('value');
        if (lastMsg.exists()) {
          lastMsg.forEach((m) => {
            const v = m.val();
            if (v && v.timestamp > lastSeen && v.sender !== userEmail) unread += 1;
          });
        }
      }
      res.locals.unreadChatCount = unread;
    }

    // Compute pending applications count for admin
    if (req.session && req.session.user && req.session.user.role === 'admin') {
      const applicationsSnapshot = await db.ref('technician_applications')
        .orderByChild('status')
        .equalTo('pending')
        .once('value');
      
      if (applicationsSnapshot.exists()) {
        let pendingCount = 0;
        applicationsSnapshot.forEach(() => {
          pendingCount += 1;
        });
        res.locals.pendingApplicationsCount = pendingCount;
      }
    }
  } catch (err) {
    console.error('Failed to compute notification counts:', err);
  } finally {
    next();
  }
});

app.get('/', function(req, res) {
    res.render('landingpage', { layout: false });
});

app.get('/login', function(req, res) {
    res.render('login', { layout: false });
});

app.get("/signup", (req, res) => {
    res.render("signup", { layout: false });
});


app.post("/signup", async (req, res) => {
    try {
        const { name, email, password, role, phone, location, specialty, experience, certifications, bio, idNumber, availability, serviceRadius, terms } = req.body;

        // Validate basic required fields
        if (!name || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                error: 'Name, email, password, and role are required'
            });
        }

        // Check if email already exists in users
        const existingUserSnapshot = await db.ref('users').orderByChild('email').equalTo(email).once('value');
        if (existingUserSnapshot.exists()) {
            return res.status(400).json({
                success: false,
                error: 'An account with this email already exists'
            });
        }

        // Check if email already exists in applications
        const existingAppSnapshot = await db.ref('technician_applications').orderByChild('email').equalTo(email).once('value');
        if (existingAppSnapshot.exists()) {
            return res.status(400).json({
                success: false,
                error: 'An application with this email already exists'
            });
        }

    const hashedPassword = await bcrypt.hash(password, 10);

        if (role === 'technician') {
            // Validate technician-specific fields
            if (!phone || !location || !specialty || !experience || !bio || !idNumber || !availability || !serviceRadius || !terms) {
                return res.status(400).json({
                    success: false,
                    error: 'All technician fields are required'
                });
            }

            // Create technician application
            const applicationData = {
                name,
                email,
                phone,
                location,
                password: hashedPassword,
                specialty,
                experience,
                certifications: certifications || '',
                bio,
                idNumber,
                availability,
                serviceRadius,
                status: 'Pending',
                timestamp: Date.now(),
                idDocumentUploaded: true // For now, assume file upload is handled
            };

            // Save application to database
            const newAppRef = db.ref('technician_applications').push();
            await newAppRef.set(applicationData);

            res.json({
                success: true,
                message: 'Technician application submitted successfully',
                applicationId: newAppRef.key
            });

        } else {
            // Create homeowner account directly
            await db.ref("users").push({ 
                name, 
                email, 
                password: hashedPassword, 
                role 
            });

            res.json({
                success: true,
                message: 'Account created successfully'
            });
        }

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.post('/login', async (req, res) => {
    console.log('=== LOGIN REQUEST START ===');
    console.log('Request body:', req.body);
    console.log('Request headers content-type:', req.headers['content-type']);
    console.log('Request method:', req.method);
    
    const { email, password } = req.body;
    console.log('Extracted email:', email);
    console.log('Extracted password:', password ? 'Yes (length: ' + password.length + ')' : 'No');
    console.log('=== LOGIN REQUEST END ===');

    try {
        // Check if email and password are provided
        if (!email || !password) {
            console.log('Missing email or password');
            return res.json({ success: false, message: "Email and password are required" });
        }

        // Hard-coded admin login path
        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            console.log('Admin login successful');
            req.session.user = { email: ADMIN_EMAIL, role: 'admin' };
            return res.json({ success: true, redirect: '/admin' });
        }
        
        console.log('Querying Firebase for user:', email);
    const snapshot = await db.ref("users").orderByChild("email").equalTo(email).once("value");
        console.log('User exists in users table:', snapshot.exists());
        if (snapshot.exists()) {
            const userData = Object.values(snapshot.val())[0];
            console.log('User data found:', { email: userData.email, role: userData.role, hasPassword: !!userData.password });
        } else {
            console.log('No user found in database');
        }

    if (snapshot.exists()) {
        const userData = Object.values(snapshot.val())[0];
        const match = await bcrypt.compare(password, userData.password);
            console.log('Password match:', match);

        if (match) {
                console.log('User login successful, role:', userData.role);
            req.session.user = { email, role: userData.role };
            if (userData.role === "technician") {
                    return res.json({ success: true, redirect: "/technician-dashboard" });
            } else {
                    return res.json({ success: true, redirect: "/homeowner-dashboard" });
            }
        } else {
                console.log('Incorrect password for user:', email);
                return res.json({ success: false, message: "Incorrect password" });
        }
    } else {
            // Check if there's a pending technician application
            console.log('User not found in users table, checking applications...');
            const appSnapshot = await db.ref("technician_applications").orderByChild("email").equalTo(email).once("value");
            console.log('Application exists:', appSnapshot.exists());
            
            if (appSnapshot.exists()) {
                const appData = Object.values(appSnapshot.val())[0];
                console.log('Application status:', appData.status);
                
                if (appData.status === "Pending") {
                    console.log('Application pending for:', email);
                    return res.json({ success: false, message: "Your technician application is still under review. Please wait for admin approval." });
                } else if (appData.status === "Rejected") {
                    console.log('Application rejected for:', email);
                    return res.json({ success: false, message: "Your technician application was rejected. Please contact support for more information." });
                } else {
                    // If application exists but status is not Pending or Rejected (e.g., Approved but not in users table)
                    console.log('Application exists but status is:', appData.status, 'for:', email);
                    return res.json({ success: false, message: "User not found" });
                }
            } else {
                console.log('No application found for:', email);
                return res.json({ success: false, message: "User not found" });
            }
        }
    } catch (error) {
        console.error('Login error for email:', email, 'Error:', error);
        return res.json({ success: false, message: "An error occurred during login. Please try again." });
    }
});


// Route for Technician Application Status Check
app.get('/application-status', async (req, res) => {
    const { email } = req.query;
    
    if (!email) {
        return res.render("technician_application_status", {
            layout: "layout",
            active: "application-status",
            application: null
        });
    }

    try {
        const appSnapshot = await db.ref("technician_applications").orderByChild("email").equalTo(email).once("value");
        
        let application = null;
        if (appSnapshot.exists()) {
            application = Object.values(appSnapshot.val())[0];
        }

        res.render("technician_application_status", {
            layout: "layout",
            active: "application-status",
            application
        });
    } catch (error) {
        console.error('Error checking application status:', error);
        res.render("technician_application_status", {
            layout: "layout",
            active: "application-status",
            application: null
        });
    }
});

//Route for HomeOwner Dashboard (Analytics Only)
app.get('/homeowner-dashboard', async (req, res) => {
    if (!req.session.user || req.session.user.role !== "homeowner") {
        return res.redirect("/"); 
    }
    const userEmail = req.session.user.email;

    // Fetch all requests for the homeowner
    const requestsSnapshot = await db.ref("requests").orderByChild("homeownerEmail").equalTo(userEmail).once("value");
    
    const allRequests = [];
    let stats = {
        total: 0,
        pending: 0,
        accepted: 0,
        completed: 0,
        rejected: 0,
        paid: 0,
        rated: 0,
        monthlyData: [],
        applianceStats: {},
        technicianStats: {},
        avgCompletionTime: 0
    };

    if (requestsSnapshot.exists()) {
        requestsSnapshot.forEach((childSnapshot) => {
            const id = childSnapshot.key;
            const data = childSnapshot.val();
            
            const request = {
                id: id,
                ...data
            };
            
            allRequests.push(request);

            // Count by status
            stats.total++;
            if (data.status === "Pending") stats.pending++;
            else if (data.status === "Accepted") stats.accepted++;
            else if (data.status === "Completed") stats.completed++;
            else if (data.status === "Rejected") stats.rejected++;
            
            if (data.paid) stats.paid++;
            if (data.rated) stats.rated++;
            
            // Count by appliance type
            if (data.appliance) {
                stats.applianceStats[data.appliance] = (stats.applianceStats[data.appliance] || 0) + 1;
            }
            
            // Count by technician
            if (data.technicianEmail) {
                stats.technicianStats[data.technicianEmail] = (stats.technicianStats[data.technicianEmail] || 0) + 1;
            }
        });
    }

    // Generate monthly data for the last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear();
        
        const monthRequests = allRequests.filter(req => {
            const reqDate = new Date(req.timestamp);
            return reqDate.getMonth() === date.getMonth() && 
                   reqDate.getFullYear() === date.getFullYear();
        });

        const completed = monthRequests.filter(req => req.status === 'Completed').length;
        const total = monthRequests.length;

        stats.monthlyData.push({
            month: `${monthName} ${year}`,
            completed: completed,
            total: total,
            rate: total > 0 ? Math.round((completed / total) * 100) : 0
        });
    }

    // Calculate average completion time
    const completedRequests = allRequests.filter(req => req.status === 'Completed' && req.completedTimestamp);
    if (completedRequests.length > 0) {
        const totalTime = completedRequests.reduce((sum, req) => {
            return sum + (req.completedTimestamp - req.timestamp);
        }, 0);
        stats.avgCompletionTime = Math.round(totalTime / completedRequests.length / (1000 * 60 * 60)); // Hours
    }

    // Get top appliances and technicians
    const topAppliances = Object.entries(stats.applianceStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([appliance, count]) => ({ appliance, count }));

    const topTechnicians = Object.entries(stats.technicianStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([email, count]) => ({ email, count }));

    res.render("homeowner_dashboard", {
        layout: "layout",
        active: "homeowner",
        stats,
        topAppliances,
        topTechnicians
    });
});

// Route for Request Repair Page
app.get('/request-repair', ensureAuth, async (req, res) => {
    if (!req.session.user || req.session.user.role !== "homeowner") {
        return res.redirect("/"); 
    }

    const snapshot = await db.ref("users").orderByChild("role").equalTo("technician").once("value");
    const technicians = snapshot.exists() ? Object.values(snapshot.val()) : [];

    res.render("request_repair", {
        layout: "layout",
        active: "request-repair",
        technicians
    });
});

// Route for Client Dashboard (Analytics & Metrics)
app.get('/client-dashboard', ensureAuth, async (req, res) => {
    if (!req.session.user || req.session.user.role !== "homeowner") {
        return res.redirect("/"); 
    }

    const userEmail = req.session.user.email;
    
    // Fetch all requests for the homeowner
    const requestsSnapshot = await db.ref("requests").orderByChild("homeownerEmail").equalTo(userEmail).once("value");
    
    const allRequests = [];
    const recentRequests = [];
    let stats = {
        total: 0,
        pending: 0,
        accepted: 0,
        completed: 0,
        rejected: 0,
        paid: 0,
        rated: 0,
        monthlyData: [],
        applianceStats: {},
        technicianStats: {},
        avgCompletionTime: 0
    };

    if (requestsSnapshot.exists()) {
        requestsSnapshot.forEach((childSnapshot) => {
            const id = childSnapshot.key;
            const data = childSnapshot.val();
            
            const request = {
                id: id,
                ...data
            };
            
            allRequests.push(request);
            
            // Get recent requests (last 10)
            if (recentRequests.length < 10) {
                recentRequests.push(request);
            }

            // Count by status
            stats.total++;
            if (data.status === "Pending") stats.pending++;
            else if (data.status === "Accepted") stats.accepted++;
            else if (data.status === "Completed") stats.completed++;
            else if (data.status === "Rejected") stats.rejected++;
            
            if (data.paid) stats.paid++;
            if (data.rated) stats.rated++;
            
            // Count by appliance type
            if (data.appliance) {
                stats.applianceStats[data.appliance] = (stats.applianceStats[data.appliance] || 0) + 1;
            }
            
            // Count by technician
            if (data.technicianEmail) {
                stats.technicianStats[data.technicianEmail] = (stats.technicianStats[data.technicianEmail] || 0) + 1;
            }
        });
    }

    // Sort recent requests by timestamp (newest first)
    recentRequests.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Generate monthly data for the last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear();
        
        const monthRequests = allRequests.filter(req => {
            const reqDate = new Date(req.timestamp);
            return reqDate.getMonth() === date.getMonth() && 
                   reqDate.getFullYear() === date.getFullYear();
        });

        const completed = monthRequests.filter(req => req.status === 'Completed').length;
        const total = monthRequests.length;

        stats.monthlyData.push({
            month: `${monthName} ${year}`,
            completed: completed,
            total: total,
            rate: total > 0 ? Math.round((completed / total) * 100) : 0
        });
    }

    // Calculate average completion time
    const completedRequests = allRequests.filter(req => req.status === 'Completed' && req.completedTimestamp);
    if (completedRequests.length > 0) {
        const totalTime = completedRequests.reduce((sum, req) => {
            return sum + (req.completedTimestamp - req.timestamp);
        }, 0);
        stats.avgCompletionTime = Math.round(totalTime / completedRequests.length / (1000 * 60 * 60)); // Hours
    }

    // Get top appliances and technicians
    const topAppliances = Object.entries(stats.applianceStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([appliance, count]) => ({ appliance, count }));

    const topTechnicians = Object.entries(stats.technicianStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([email, count]) => ({ email, count }));

    res.render("client_dashboard", {
        layout: "layout",
        active: "dashboard",
        stats,
        recentRequests,
        topAppliances,
        topTechnicians
    });
});

// Route for Technician Dashboard
app.get('/technician-dashboard', async (req, res) => {
    if (!req.session.user || req.session.user.role !== "technician") {
        return res.redirect("/"); 
    }

    const technicianEmail = req.session.user.email;

    // Fetch all requests for the technician
    const snapshot = await db.ref("requests").orderByChild("technicianEmail").equalTo(technicianEmail).once("value");
    
    // Transform data to ensure IDs are preserved
    const requests = [];
    const allRequests = [];
    const approvedRequests = [];
    const rejectedRequests = [];
    const completedRequests = [];
    
    let stats = {
        total: 0,
        pending: 0,
        accepted: 0,
        completed: 0,
        rejected: 0,
        completionRate: 0,
        monthlyData: [],
        weeklyData: []
    };

    if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            const id = childSnapshot.key;
            const data = childSnapshot.val();
            
            const requestData = {
                id: id,
                ...data
            };
            
            allRequests.push(requestData);

            // Count by status and categorize requests
            stats.total++;
            if (data.status === "Pending") {
                stats.pending++;
                requests.push(requestData);
            } else if (data.status === "Accepted") {
                stats.accepted++;
                approvedRequests.push(requestData);
            } else if (data.status === "Completed") {
                stats.completed++;
                completedRequests.push(requestData);
            } else if (data.status === "Rejected") {
                stats.rejected++;
                rejectedRequests.push(requestData);
            }
        });
    }
    
    // Calculate completion rate
    if (stats.total > 0) {
        stats.completionRate = Math.round((stats.completed / stats.total) * 100);
    }

    // Generate monthly data for the last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear();
        
        const monthRequests = allRequests.filter(req => {
            const reqDate = new Date(req.timestamp);
            return reqDate.getMonth() === date.getMonth() && 
                   reqDate.getFullYear() === date.getFullYear();
        });

        const completed = monthRequests.filter(req => req.status === 'Completed').length;
        const total = monthRequests.length;

        stats.monthlyData.push({
            month: `${monthName} ${year}`,
            completed: completed,
            total: total,
            rate: total > 0 ? Math.round((completed / total) * 100) : 0
        });
    }

    // Generate weekly data for the last 4 weeks
    for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (i * 7 + 6));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        const weekRequests = allRequests.filter(req => {
            const reqDate = new Date(req.timestamp);
            return reqDate >= weekStart && reqDate <= weekEnd;
        });

        const completed = weekRequests.filter(req => req.status === 'Completed').length;
        const total = weekRequests.length;

        stats.weeklyData.push({
            week: `Week ${4-i}`,
            completed: completed,
            total: total,
            rate: total > 0 ? Math.round((completed / total) * 100) : 0
        });
    }
    
    console.log("Technician dashboard stats:", stats); 
    
    res.render("technician_dashboard", { 
        requests, 
        approvedRequests,
        rejectedRequests,
        completedRequests,
        stats,
        active: "technician"
    });
});

// Route for Manage Requests Page (Technicians)
app.get('/manage-requests', ensureAuth, async (req, res) => {
    if (!req.session.user || req.session.user.role !== "technician") {
        return res.redirect("/"); 
    }

    const technicianEmail = req.session.user.email;

    // Fetch all requests for the technician
    const snapshot = await db.ref("requests").orderByChild("technicianEmail").equalTo(technicianEmail).once("value");
    
    const requests = [];
    const approvedRequests = [];
    const rejectedRequests = [];
    const completedRequests = [];
    
    if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            const id = childSnapshot.key;
            const data = childSnapshot.val();
            
            const requestData = {
                id: id,
                ...data
            };
            
            if (data.status === "Pending") {
                requests.push(requestData);
            } else if (data.status === "Accepted") {
                approvedRequests.push(requestData);
            } else if (data.status === "Completed") {
                completedRequests.push(requestData);
            } else if (data.status === "Rejected") {
                rejectedRequests.push(requestData);
            }
        });
    }

    res.render("manage_requests", {
        layout: "layout",
        active: "manage-requests",
        requests,
        approvedRequests,
        rejectedRequests,
        completedRequests
    });
});

// Payment flow: list completed-but-unpaid requests
app.get('/payment', ensureAuth, async (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== 'homeowner') return res.redirect('/');

  const userEmail = user.email;
  const snapshot = await db.ref('requests')
    .orderByChild('homeownerEmail')
    .equalTo(userEmail)
    .once('value');

  const unpaid = [];
  if (snapshot.exists()) {
    snapshot.forEach((child) => {
      const id = child.key;
      const r = child.val();
      if (r && r.status === 'Completed' && r.paid !== true) {
        unpaid.push({ id, ...r });
      }
    });
  }

  res.render('payment', { layout: 'layout', active: 'payment', unpaid });
});

// Mark a request as paid and notify rating
app.post('/pay', ensureAuth, async (req, res) => {
  const { requestId, method } = req.body;
  if (!requestId) return res.status(400).send('Missing requestId');

  const snap = await db.ref('requests').child(requestId).once('value');
  const r = snap.val();
  if (!r) return res.status(404).send('Request not found');

  await db.ref('requests').child(requestId).update({ paid: true, paidAt: Date.now(), paymentMethod: method || 'Unknown' });

  // Notify homeowner to rate now
  await db.ref('notifications').push({
    recipientEmail: r.homeownerEmail,
    message: `Payment received (${method || 'Unknown'}) for ${r.appliance}. Please rate your technician.`,
    requestId,
    technicianEmail: r.technicianEmail,
    timestamp: Date.now(),
    read: false
  });

  res.redirect('/rate');
});

// M-Pesa Payment Routes
app.post('/mpesa/pay', ensureAuth, async (req, res) => {
  try {
    const { requestId, phoneNumber, amount } = req.body;
    
    // Debug logging
    console.log('M-Pesa payment request:', {
      requestId: requestId,
      phoneNumber: phoneNumber,
      amount: amount,
      body: req.body
    });
    
    if (!requestId || !phoneNumber || !amount) {
      console.log('Missing fields:', {
        requestId: !!requestId,
        phoneNumber: !!phoneNumber,
        amount: !!amount
      });
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: requestId, phoneNumber, amount' 
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Amount must be greater than 0' 
      });
    }

    // Get request details
    const snap = await db.ref('requests').child(requestId).once('value');
    const request = snap.val();
    
    if (!request) {
      return res.status(404).json({ 
        success: false, 
        error: 'Request not found' 
      });
    }

    if (request.paid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Request already paid' 
      });
    }

    // Initiate M-Pesa STK Push
    const accountReference = `QF-${requestId}`;
    const transactionDesc = `Payment for ${request.appliance} repair`;
    
    const mpesaResult = await mpesaService.initiateSTKPush(
      phoneNumber, 
      amount, 
      accountReference, 
      transactionDesc
    );

    if (mpesaResult.success) {
      // Store payment attempt in database
      await db.ref('paymentAttempts').push({
        requestId,
        phoneNumber,
        amount,
        checkoutRequestID: mpesaResult.checkoutRequestID,
        merchantRequestID: mpesaResult.merchantRequestID,
        status: 'pending',
        timestamp: Date.now(),
        homeownerEmail: req.session.user.email
      });

      res.json({
        success: true,
        message: mpesaResult.customerMessage || 'Payment initiated successfully',
        checkoutRequestID: mpesaResult.checkoutRequestID,
        merchantRequestID: mpesaResult.merchantRequestID
      });
    } else {
      res.json({
        success: false,
        error: mpesaResult.error || 'Failed to initiate payment'
      });
    }

  } catch (error) {
    console.error('M-Pesa payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// M-Pesa Payment Status Check
app.get('/mpesa/status/:checkoutRequestID', ensureAuth, async (req, res) => {
  try {
    const { checkoutRequestID } = req.params;
    
    const result = await mpesaService.querySTKPush(checkoutRequestID);
    
    if (result.success) {
      // If payment is successful, update the request
      if (result.resultCode === '0') {
        // Find the payment attempt
        const paymentAttemptsSnapshot = await db.ref('paymentAttempts')
          .orderByChild('checkoutRequestID')
          .equalTo(checkoutRequestID)
          .once('value');
        
        if (paymentAttemptsSnapshot.exists()) {
          paymentAttemptsSnapshot.forEach(async (snap) => {
            const paymentAttempt = snap.val();
            
            // Update request as paid
            await db.ref('requests').child(paymentAttempt.requestId).update({
              paid: true,
              paidAt: Date.now(),
              paymentMethod: 'M-Pesa',
              mpesaCheckoutID: checkoutRequestID
            });
            
            // Update payment attempt status
            await db.ref('paymentAttempts').child(snap.key).update({
              status: 'completed',
              completedAt: Date.now()
            });
            
            // Notify homeowner to rate
            const requestSnap = await db.ref('requests').child(paymentAttempt.requestId).once('value');
            const request = requestSnap.val();
            
            if (request) {
              await db.ref('notifications').push({
                recipientEmail: request.homeownerEmail,
                message: `M-Pesa payment received for ${request.appliance}. Please rate your technician.`,
                requestId: paymentAttempt.requestId,
                technicianEmail: request.technicianEmail,
                timestamp: Date.now(),
                read: false
              });
            }
          });
        }
      }
      
      res.json({
        success: true,
        resultCode: result.resultCode,
        resultDesc: result.resultDesc
      });
    } else {
      res.json({
        success: false,
        error: result.error || 'Failed to check payment status'
      });
    }

  } catch (error) {
    console.error('M-Pesa status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// M-Pesa Callback (for production use)
app.post('/mpesa/callback', (req, res) => {
  console.log('M-Pesa Callback:', req.body);
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
});

app.post("/respond", async (req, res) => {
    const { requestId, status } = req.body;
    console.log("BODY:", req.body);


    if (!requestId || !status) {
        return res.status(400).send("Missing request ID or status");
    }

    // Update the request's status
    await db.ref(`requests/${requestId}`).update({
        status: status,
        responseTimestamp: Date.now()
    });

    // Get the updated request to fetch the homeowner
    const updatedRequestSnapshot = await db.ref(`requests/${requestId}`).once("value");
    const updatedRequest = updatedRequestSnapshot.val();
    const homeownerEmail = updatedRequest.homeownerEmail;

    // Add a notification to homeowner
    await db.ref("notifications").push({
        recipientEmail: homeownerEmail,
        message: `Your request for ${updatedRequest.appliance} was ${status.toLowerCase()} by the technician.`,
        timestamp: Date.now(),
        read: false
    });

    res.redirect("/manage-requests");
});


app.get("/requests", async (req, res) => {
    const role = req.session.user.role;

    // Redirect to appropriate pages based on user role
    if (role === "technician") {
        res.redirect("/manage-requests");
    } else if (role === "homeowner") {
        res.redirect("/homeowner-dashboard");
    } else {
        res.redirect("/");
    }
});


app.post("/request", async (req, res) => {
    const { appliance, technician, description } = req.body;
    const homeownerEmail = req.session.user.email;

    // Save the request to Firebase with a timestamp
    await db.ref("requests").push({
        homeownerEmail,
        technicianEmail: technician,
        appliance,
        description,
        status: "Pending",
        timestamp: Date.now()  
    });

    res.json({ message: "Request sent to technician!" });
});

app.post("/complete", async (req, res) => {
    const { requestId } = req.body;

    try{
    // Update the request status to "Completed"
    await db.ref("requests").child(requestId).update({ 
        status: "Completed", 
        paid: false,
        completedTimestamp: Date.now()
    });

    // Get the homeowner's email from the request
    const requestSnapshot = await db.ref("requests").child(requestId).once("value");
    const requestData = requestSnapshot.val();

    if (!requestData) {
        return res.status(404).send("Request not found");
    }

    const homeownerEmail = requestData.homeownerEmail;
    const technicianEmail = requestData.technicianEmail;

    // Notify homeowner to make payment first
    await db.ref("notifications").push({
        recipientEmail: homeownerEmail,
        message: `Your request has been completed. Please proceed to payment.`,
        requestId: requestId,
        technicianEmail: technicianEmail,
        timestamp: Date.now(),
        read: false
    });

    res.redirect("/manage-requests");
} catch (error) {
    console.error ("Error completing request:", error);
    res.status(500).send("Internal server error");
}
});

app.get("/rate", ensureAuth, async (req, res) => {
  const userEmail = req.session.user.email;

  // Fetch this homeowner's completed, not-yet-rated requests
  const requestSnapshot = await db.ref("requests")
    .orderByChild("homeownerEmail")
    .equalTo(userEmail)
    .once("value");

  const rateable = [];

  if (requestSnapshot.exists()) {
    requestSnapshot.forEach((child) => {
      const requestId = child.key;
      const request = child.val();
      if (request && request.status === 'Completed' && request.paid === true && request.rated !== true) {
          rateable.push({
            requestId,
            appliance: request.appliance,
            technicianEmail: request.technicianEmail
          });
        }
    });
  }

  res.render("rate", {
    layout: "layout",
    active: "rate",
    rateable
  });
});



app.post("/rate", async (req, res) => {
  const { technicianId, rating, requestId } = req.body;
  console.log("Rating submission - Full body:", req.body);
  console.log("Rating submission - Parsed:", { technicianId, rating, requestId });

  // Validate required fields
  if (!technicianId || !rating || !requestId) {
    console.error("Missing required fields:", { technicianId, rating, requestId });
    return res.status(400).send("Missing required fields for rating");
  }

  try {
    // Store rating in a separate ratings collection
    await db.ref("ratings").push({
      technicianEmail: technicianId,
        rating: Number(rating),
      requestId: requestId,
      timestamp: Date.now()
      });

    // Mark request as rated
    await db.ref("requests").child(requestId).update({ rated: true });

    console.log("Rating submitted successfully");
    res.redirect("/rate");
  } catch (error) {
    console.error("Rating failed:", error);
    res.status(500).send("Error submitting rating");
  }
});


app.get("/notifications", async (req, res) => {
    const userEmail = req.session.user.email;

    const snapshot = await db.ref("notifications").once("value");
    const allNotifications = snapshot.val() || {};

    const userNotifications = Object.values(allNotifications)
        .filter(n => n.recipientEmail === userEmail)
        .sort((a, b) => b.timestamp - a.timestamp);

    res.render("notifications", { layout:"layout", notifications: userNotifications, active:"notifications"});
});

const clientConfig = {
  apiKey: "AIzaSyC1NYqNznWfB922n0mai4OsjNDSh9AMd0w",
  authDomain: "quickfix-3c7dc.firebaseapp.com",
  databaseURL: "https://quickfix-3c7dc-default-rtdb.firebaseio.com",
  projectId: "quickfix-3c7dc",
  storageBucket: "quickfix-3c7dc.firebasestorage.app",
  messagingSenderId: "407101581858",
  appId: "1:407101581858:web:70df3a4c9961d48842f87b",
  measurementId: "G-YWD0MPMPK4"
};

// ensureAuth guards logged-in users
function ensureAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

function ensureAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  return res.redirect('/');
}

app.get('/chat', ensureAuth, async (req, res) => {
  const currentUser = req.session.user;
  const userEmail = currentUser.email;

  const requestSnapshot = await db.ref("requests").once("value");
  const conversations = [];

  if (requestSnapshot.exists()) {
    requestSnapshot.forEach((snap) => {
      const request = snap.val();
      const isParticipant = request.homeownerEmail === userEmail || request.technicianEmail === userEmail;
      if (isParticipant) {
        conversations.push({
          id: snap.key,
          appliance: request.appliance,
          homeownerEmail: request.homeownerEmail,
          technicianEmail: request.technicianEmail,
        });
      }
    });
  }

  // compute unread flag per conversation
  const lastSeen = req.session.lastSeenChatTs || 0;
  await Promise.all(conversations.map(async (c) => {
    const lastMsgSnap = await db.ref('conversations').child(c.id).orderByChild('timestamp').limitToLast(1).once('value');
    let unread = false;
    if (lastMsgSnap.exists()) {
      lastMsgSnap.forEach((m) => {
        const v = m.val();
        if (v && v.timestamp > lastSeen && v.sender !== userEmail) unread = true;
      });
    }
    c.unread = unread;
  }));

  res.render("chat_list", {
    layout: "layout",
    title: "Your Conversations",
    conversations,
    currentUser: userEmail,
    active: "chat"
  });
});


app.get('/messages/:requestId', ensureAuth, (req, res) => {
  // mark chat as seen now to clear badges going forward
  req.session.lastSeenChatTs = Date.now();
  res.render('chat', {
    layout: 'layout',
    title: 'Chat',
    requestId: req.params.requestId,
    currentUser: req.session.user.email,
    firebaseConfig: clientConfig, 
    active: 'chat'
  });
});

// Logout clears session and redirects to login
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Admin Dashboard: list technician applications
app.get('/admin', ensureAdmin, async (req, res) => {
  const appsSnap = await db.ref('technician_applications').once('value');
  const applications = [];
  if (appsSnap.exists()) {
    appsSnap.forEach((child) => {
      applications.push({ id: child.key, ...child.val() });
    });
  }

  const thisWeekStart = new Date();
  thisWeekStart.setHours(0,0,0,0);
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  const weekTs = thisWeekStart.getTime();

  const pending = applications.filter(a => a.status === 'Pending').length;
  const approvedThisWeek = applications.filter(a => a.status === 'Approved' && (a.decisionTimestamp || 0) >= weekTs).length;
  const rejectedThisWeek = applications.filter(a => a.status === 'Rejected' && (a.decisionTimestamp || 0) >= weekTs).length;

  // Get additional system statistics
  const usersSnap = await db.ref('users').once('value');
  const requestsSnap = await db.ref('requests').once('value');
  
  let stats = {
    totalUsers: 0,
    totalTechnicians: 0,
    activeTechnicians: 0,
    totalRequests: 0,
    completedRequests: 0,
    approvedTotal: 0,
    rejectedTotal: 0,
    weeklyApplications: [],
    monthlyTechnicians: []
  };

  if (usersSnap.exists()) {
    const users = usersSnap.val();
    stats.totalUsers = Object.keys(users).length;
    stats.totalTechnicians = Object.values(users).filter(u => u.role === 'technician').length;
    stats.activeTechnicians = stats.totalTechnicians; // Assume all are active
  }

  if (requestsSnap.exists()) {
    const requests = requestsSnap.val();
    stats.totalRequests = Object.keys(requests).length;
    stats.completedRequests = Object.values(requests).filter(r => r.status === 'Completed').length;
  }

  // Calculate approved and rejected totals
  stats.approvedTotal = applications.filter(a => a.status === 'Approved').length;
  stats.rejectedTotal = applications.filter(a => a.status === 'Rejected').length;

  // Calculate weekly applications for the last 4 weeks
  const now = new Date();
  for (let i = 3; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (i * 7 + 6));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weekApplications = applications.filter(app => {
      const appDate = new Date(app.timestamp);
      return appDate >= weekStart && appDate <= weekEnd;
    }).length;
    
    stats.weeklyApplications.push(weekApplications);
  }

  // Calculate monthly technician growth for the last 6 months
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    const monthTechnicians = applications.filter(app => {
      if (app.status !== 'Approved' || !app.decisionTimestamp) return false;
      const decisionDate = new Date(app.decisionTimestamp);
      return decisionDate >= date && decisionDate <= monthEnd;
    }).length;
    
    stats.monthlyTechnicians.push(monthTechnicians);
  }

  res.render('admin_dashboard', {
    layout: 'layout',
    active: 'admin',
    metrics: { pending, approvedThisWeek, rejectedThisWeek },
    stats
  });
});

// Route for Manage Applications Page (Admins)
app.get('/manage-applications', ensureAdmin, async (req, res) => {
  const appsSnap = await db.ref('technician_applications').once('value');
  const applications = [];
  if (appsSnap.exists()) {
    appsSnap.forEach((child) => {
      applications.push({ id: child.key, ...child.val() });
    });
  }

  const pendingApplications = applications.filter(a => a.status === 'Pending');
  const approvedApplications = applications.filter(a => a.status === 'Approved');
  const rejectedApplications = applications.filter(a => a.status === 'Rejected');

  res.render('manage_applications', {
    layout: 'layout',
    active: 'manage-applications',
    pendingApplications,
    approvedApplications,
    rejectedApplications
  });
});

// Approve / Reject application
app.post('/admin/applications/:id/approve', ensureAdmin, async (req, res) => {
  const id = req.params.id;
  const appRef = db.ref('technician_applications').child(id);
  const snap = await appRef.once('value');
  if (!snap.exists()) return res.redirect('/admin');
  const appData = snap.val();

  await appRef.update({ status: 'Approved', decisionTimestamp: Date.now() });

  // Add to users as technician if not present
  const usersSnap = await db.ref('users').orderByChild('email').equalTo(appData.email).once('value');
  if (!usersSnap.exists()) {
    await db.ref('users').push({
      name: appData.name || appData.fullName || 'Technician',
      email: appData.email,
      password: appData.password, // Use the hashed password from application
      role: 'technician',
      phone: appData.phone || '',
      location: appData.location || '',
      specialty: appData.specialty || '',
      experience: appData.experience || '',
      certifications: appData.certifications || '',
      bio: appData.bio || '',
      idNumber: appData.idNumber || '',
      availability: appData.availability || '',
      serviceRadius: appData.serviceRadius || '',
      approvedAt: Date.now()
    });
    console.log(`Technician approved and added to system: ${appData.email}`);
  }

  res.redirect('/admin');
});

app.post('/admin/applications/:id/reject', ensureAdmin, async (req, res) => {
  const id = req.params.id;
  const appRef = db.ref('technician_applications').child(id);
  const snap = await appRef.once('value');
  if (!snap.exists()) return res.redirect('/admin');
  await appRef.update({ status: 'Rejected', decisionTimestamp: Date.now() });
  res.redirect('/admin');
});


app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
