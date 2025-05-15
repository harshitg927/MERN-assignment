// config/firebase.js
const admin = require("firebase-admin");

/**
 * Firebase Admin SDK initialization
 * Used for verifying Firebase authentication tokens
 */
const initializeFirebase = () => {
  // Check if Firebase is already initialized
  if (!admin.apps.length) {
    try {
      // Initialize with service account if provided
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
      // Otherwise, initialize with application default credentials
      else {
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
      }

      console.log("Firebase Admin SDK initialized successfully");
    } catch (error) {
      console.error("Error initializing Firebase Admin SDK:", error);
      process.exit(1);
    }
  }

  return admin;
};

module.exports = {
  admin: initializeFirebase(),

  // Verify Firebase ID token
  verifyIdToken: async (idToken) => {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      return decodedToken;
    } catch (error) {
      console.error("Error verifying Firebase ID token:", error);
      throw error;
    }
  },
};
