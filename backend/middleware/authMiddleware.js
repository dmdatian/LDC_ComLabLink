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
      const userData = userDoc.data() || {};
      const role = userData.role || null;
      req.user.role = role ? role.toLowerCase() : null;
      req.user.status = userData.status || null;
      req.user.name = userData.name || decodedToken.name || decodedToken.email || null;
      req.user.gradeLevel = userData.gradeLevel || null;
      req.user.gradeLevelId = userData.gradeLevelId || null;
      req.user.section = userData.section || null;
      req.user.sectionId = userData.sectionId || null;
      if (String(req.user.status || '').toLowerCase() === 'inactive') {
        return res.status(403).json({ success: false, message: 'Account is inactive. Please contact admin.' });
      }
    } else {
      req.user.role = null;
      req.user.status = null;
      req.user.name = decodedToken.name || decodedToken.email || null;
      req.user.gradeLevel = null;
      req.user.gradeLevelId = null;
      req.user.section = null;
      req.user.sectionId = null;
    }

    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

module.exports = authMiddleware;