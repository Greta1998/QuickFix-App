const express = require('express');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const bcrypt = require("bcryptjs");
const db = require("./firebase");
const sendEmail = require('./emailService');
const hbs = require("hbs");

const app = express();
const port = 3000;

//Middleware
app.set('view engine', 'hbs');
app.set('views', 'views');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: true}));


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

app.get('/', function(req, res) {
    res.render('login', { layout: false });
});

app.get("/signup", (req, res) => {
    res.render("signup", { layout: false });
});


app.post("/signup", async (req, res) => {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.ref("users").push({ name, email, password: hashedPassword, role });
    res.redirect("/");
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const snapshot = await db.ref("users").orderByChild("email").equalTo(email).once("value");

    if (snapshot.exists()) {
        const userData = Object.values(snapshot.val())[0];
        const match = await bcrypt.compare(password, userData.password);

        if (match) {
            req.session.user = { email, role: userData.role };
            if (userData.role === "technician") {
                res.redirect("/technician-dashboard");
            } else {
                res.redirect("/homeowner-dashboard");
            }
        } else {
            res.send("Incorrect password");
        }
    } else {
        res.send("User not found");
    }
});

//Route for HomeOwner Dashboard
app.get('/homeowner-dashboard', async (req, res) => {
    if (!req.session.user || req.session.user.role !== "homeowner") {
        return res.redirect("/"); 
    }
    const userEmail = req.session.user.email;

    // Fetch homeowner's notifications
    const notificationSnapshot = await db.ref("notifications").orderByChild("recipientEmail").equalTo(userEmail).once("value");
    const notifications = [];
    if (notificationSnapshot.exists()) {
        notificationSnapshot.forEach((childSnapshot) => {
            notifications.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
    }

    const snapshot = await db.ref("users").orderByChild("role").equalTo("technician").once("value");
    const technicians = snapshot.exists() ? Object.values(snapshot.val()) : [];

    res.render("homeowner_dashboard",{notifications, technicians});
});

// Route for Technician Dashboard
app.get('/technician-dashboard', async (req, res) => {
    if (!req.session.user || req.session.user.role !== "technician") {
        return res.redirect("/"); 
    }

    const technicianEmail = req.session.user.email;

    // Fetch all pending requests for the technician
    const snapshot = await db.ref("requests").orderByChild("technicianEmail").equalTo(technicianEmail).once("value");
    
    // Transform data to ensure IDs are preserved
    const requests = [];
    if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            const id = childSnapshot.key;
            const data = childSnapshot.val();
            
            if (data.status === "Pending"){
            // Add the ID to the request object
            requests.push({
                id: id,
                ...data
            });
        }
        });
    }
    
    console.log("Technician dashboard requests:", requests); 
    
    res.render("technician_dashboard", { requests });
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

    res.redirect("/requests");
});


app.get("/requests", async (req, res) => {
    const userEmail = req.session.user.email;
    const role = req.session.user.role;

    // Get all requests
    const requestsSnapshot = await db.ref("requests").once("value");
    const allRequests = requestsSnapshot.val() || {};

    // Get all users for name/email matching
    const usersSnapshot = await db.ref("users").once("value");
    const users = usersSnapshot.val() || {};

    

    // Process requests
    let filteredRequests = Object.entries(allRequests)
        .map(([id, data]) => {
            console.log("Request ID:", id);
            const request = { id, ...data };

            if (role === "homeowner") {
                const tech = Object.values(users).find(u => u.email === request.technicianEmail);
                request.technicianName = tech?.name || "Unknown";
                request.technicianEmail = request.technicianEmail;
            } else if (role === "technician") {
                const homeowner = Object.values(users).find(u => u.email === request.homeownerEmail);
                request.homeownerName = homeowner?.name || "Unknown";
                request.homeownerEmail = request.homeownerEmail;
            }

            return request;
        })
        .filter(r => {
            if (role === "homeowner") return r.homeownerEmail === userEmail;
            if (role === "technician") return r.technicianEmail === userEmail;
            return false;
        })
        .sort((a, b) => b.timestamp - a.timestamp); 

    res.render("requests", {
        requests: filteredRequests,
        role
    });
});


app.post("/request", async (req, res) => {
    const { appliance, technician } = req.body;
    const homeownerEmail = req.session.user.email;

    // Save the request to Firebase with a timestamp
    await db.ref("requests").push({
        homeownerEmail,
        technicianEmail: technician,
        appliance,
        status: "Pending",
        timestamp: Date.now()  
    });

    res.json({ message: "Request sent to technician!" });
});

app.post("/complete", async (req, res) => {
    const { requestId } = req.body;

    try{
    // Update the request status to "Completed"
    await db.ref("requests").child(requestId).update({ status: "Completed" });

    // Get the homeowner's email from the request
    const requestSnapshot = await db.ref("requests").child(requestId).once("value");
    const requestData = requestSnapshot.val();

    if (!requestData) {
        return res.status(404).send("Request not found");
    }

    const homeownerEmail = requestData.homeownerEmail;
    const technicianEmail = requestData.technicianEmail;

    // Notify homeowner to rate the technician
    await db.ref("notifications").push({
        recipientEmail: homeownerEmail,
        message: `Your request has been completed. Please rate the technician.`,
        requestId: requestId,
        technicianEmail: technicianEmail,
        timestamp: Date.now(),
        read: false
    });

    res.redirect("/requests");
} catch (error) {
    console.error ("Error completing request:", error);
    res.status(500).send("Internal server error");
}
});

app.post("/rate", async (req, res) => {
    const { technicianId, rating, requestId } = req.body;

    // Update the technician's ratings in the database
    await db.ref("technicians").child(technicianId).child("ratings").push(rating);

    //calculate the new average rating
    const averageRating = await calculateAverageRating(technicianId);
    await db.ref("technicians").child(technicianId).update({ averageRating });

    // mark the notification as read
    await db.ref("notifications").orderByChild("requestId").equalTo(requestId).once("value", (snapshot) => {
        snapshot.forEach((childSnapshot) => {
            childSnapshot.ref.update({ read: true });
        });
    });

    res.redirect("/requests");
});

app.get("/notifications", async (req, res) => {
    const userEmail = req.session.user.email;

    const snapshot = await db.ref("notifications").once("value");
    const allNotifications = snapshot.val() || {};

    const userNotifications = Object.values(allNotifications)
        .filter(n => n.recipientEmail === userEmail)
        .sort((a, b) => b.timestamp - a.timestamp);

    res.render("notifications", { notifications: userNotifications });
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
