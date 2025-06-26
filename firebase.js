const admin = require("firebase-admin");
const serviceAccount = require("./firebase-config.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://quickfix-3c7dc-default-rtdb.firebaseio.com"
});

const db = admin.database();
module.exports = db;
