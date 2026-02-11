const admin = require('firebase-admin');
const env = require('./environment'); // your custom environment file

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  throw new Error('Missing Firebase service account environment variables.');
}

privateKey = privateKey.replace(/\\n/g, '\n');
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}

// Initialize Firebase Admin with service account
admin.initializeApp({
  credential: admin.credential.cert({
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  }),
});

// Firestore database reference
const db = admin.firestore();

// Firebase Authentication reference (if you want login later)
const auth = admin.auth();

// Export only what you need
module.exports = { 
  db,    // Firestore
  auth,  // Firebase Authentication
  admin
};

