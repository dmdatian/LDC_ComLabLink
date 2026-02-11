// roleMiddleware.js
const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    // Check if user info exists
    if (!req.user || !req.user.role) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated or role not found' 
      });
    }

    const normalizedRole = (req.user.role || '').toLowerCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

    // Check if user's role is allowed
    if (!normalizedAllowed.includes(normalizedRole)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
      });
    }

    // User is authenticated and role is allowed
    next();
  };
};

module.exports = roleMiddleware;
