const { auth, db } = require('../config/database'); // db is Firestore

const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from headers
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    // Verify Firebase ID token
    const decodedToken = await auth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };

    // Firestore-friendly: Get user role if it exists (do not block registration)
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (userDoc.exists) {
      const role = userDoc.data().role || null;
      req.user.role = role ? role.toLowerCase() : null;
      req.user.status = userDoc.data().status || null;
    } else {
      req.user.role = null;
      req.user.status = null;
    }

    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

module.exports = authMiddleware;
