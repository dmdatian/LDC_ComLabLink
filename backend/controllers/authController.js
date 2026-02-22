const { auth } = require('../config/database');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { validateEmail } = require('../utils/validators');

const getRequestBody = (req) => {
  if (!req) return {};
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    if (req.body.data && typeof req.body.data === 'object') return req.body.data;
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (err) {
      return {};
    }
  }
  if (Buffer.isBuffer(req.body)) {
    try {
      const parsed = JSON.parse(req.body.toString('utf8'));
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (err) {
      return {};
    }
  }
  if (req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0) {
    return req.query;
  }
  return {};
};

exports.register = async (req, res) => {
  try {
    const body = getRequestBody(req);
    const { email, name, role, idNumber, gradeLevel, section } = body;
    const uid = req.user.uid; // comes from Firebase token

    if (!email || !name || !role) {
      const missing = [
        !email ? 'email' : null,
        !name ? 'name' : null,
        !role ? 'role' : null,
      ].filter(Boolean);
      return sendError(res, 400, 'Missing required fields', missing);
    }

    const normalizedRole = role.toLowerCase();
    if (!['admin', 'teacher', 'student'].includes(normalizedRole)) {
      return sendError(res, 400, 'Invalid role');
    }
    // Grade level and section are optional

    // Check if user already exists in Firestore
    const existingUser = await User.getById(uid);
    if (existingUser) {
      return sendError(res, 409, 'User already registered');
    }

    const status = normalizedRole === 'admin' ? 'approved' : 'pending';

    // Save user to Firestore
    await User.create(uid, {
      email,
      name,
      role: normalizedRole,
      idNumber: idNumber || null,
      gradeLevel: normalizedRole === 'student' ? (gradeLevel || null) : null,
      section: normalizedRole === 'student' ? (section || null) : null,
      status,
      createdAt: new Date(),
    });

    sendSuccess(res, 201, { uid, status }, 'User saved in Firestore');
  } catch (error) {
    console.error('Registration error:', error);
    sendError(res, 500, 'Registration failed', error.message);
  }
};

exports.requestRegistration = async (req, res) => {
  try {
    const body = getRequestBody(req);
    const { email, name, role, idNumber, gradeLevel, section, password } = body;

    if (!email || !name || !role || !password) {
      const missing = [
        !email ? 'email' : null,
        !name ? 'name' : null,
        !role ? 'role' : null,
        !password ? 'password' : null,
      ].filter(Boolean);
      console.warn('Missing registration fields', { missing, body, headers: req.headers });
      return sendError(res, 400, 'Missing required fields', missing);
    }

    const normalizedRole = role.toLowerCase();
    if (!['teacher', 'student'].includes(normalizedRole)) {
      return sendError(res, 400, 'Invalid role');
    }
    // Grade level and section are optional

    const existingUser = await User.getByEmail(email);
    if (existingUser) {
      return sendError(res, 409, 'User already registered');
    }

    const pendingExisting = await User.getPendingRequestByEmail(email);
    if (pendingExisting) {
      return sendError(res, 409, 'Pending request already exists');
    }

    const result = await User.createPendingRequest({
      email,
      name,
      role: normalizedRole,
      idNumber: idNumber || null,
      gradeLevel: normalizedRole === 'student' ? (gradeLevel || null) : null,
      section: normalizedRole === 'student' ? (section || null) : null,
      password,
    });

    if (!result.success) {
      return sendError(res, 409, result.message);
    }

    sendSuccess(res, 201, {}, 'Pending registration created');
  } catch (error) {
    console.error('Request registration error:', error);
    sendError(res, 500, 'Registration request failed', error.message);
  }
};

exports.login = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return sendError(res, 400, 'Email is required');

    const user = await User.getByEmail(email);
    if (!user) {
      const pending = await User.getPendingRequestByEmail(email);
      if (pending) {
        return sendSuccess(res, 200, { status: 'pending' }, 'User pending approval');
      }

      // If user exists in Firebase Auth but not in Firestore, auto-bootstrap as admin
      try {
        const authUser = await auth.getUserByEmail(email);
        const name = authUser.displayName || email.split('@')[0];

        await User.create(authUser.uid, {
          email,
          name,
          role: 'admin',
          idNumber: null,
          gradeLevel: null,
          section: null,
          status: 'approved',
          createdAt: new Date(),
        });

        return sendSuccess(res, 200, {
          uid: authUser.uid,
          email,
          name,
          role: 'admin',
          status: 'approved',
        }, 'User bootstrapped from Firebase Auth');
      } catch (authErr) {
        // Not found in Firebase Auth either
        return sendError(res, 404, 'User not found');
      }
    }

    // Firestore-friendly: only return Firestore data
    const normalizedRole = (user.role || '').toLowerCase();
    sendSuccess(res, 200, {
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: normalizedRole,
      status: user.status || 'approved',
    }, 'User found. Please verify with your token.');
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, 500, 'Login failed', error.message);
  }
};

exports.verifyToken = async (req, res) => {
  try {
    let user = await User.getById(req.user.uid);

    if (!user) {
      // If user exists in Firebase Auth but not in Firestore, auto-bootstrap as admin
      try {
        const authUser = await auth.getUser(req.user.uid);
        const name = authUser.displayName || req.user.email?.split('@')[0] || 'Admin';

        await User.create(req.user.uid, {
          email: req.user.email,
          name,
          role: 'admin',
          idNumber: null,
          gradeLevel: null,
          section: null,
          status: 'approved',
          createdAt: new Date(),
        });

        user = await User.getById(req.user.uid);
      } catch (authErr) {
        return sendError(res, 404, 'User not found');
      }
    }

    const normalizedRole = (user.role || '').toLowerCase();
    sendSuccess(res, 200, {
      uid: req.user.uid,
      email: req.user.email,
      name: user.name,
      role: normalizedRole,
      status: user.status || 'approved',
    }, 'Token verified');
  } catch (error) {
    console.error('Token verification error:', error);
    sendError(res, 500, 'Verification failed', error.message);
  }
};

exports.getPendingUsers = async (req, res) => {
  try {
    const snapshot = await User.getPendingRequests();
    sendSuccess(res, 200, snapshot, 'Pending users retrieved');
  } catch (error) {
    console.error('Get pending users error:', error);
    sendError(res, 500, 'Failed to get pending users', error.message);
  }
};

exports.approveUser = async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) return sendError(res, 400, 'Email is required');

    const pending = await User.getPendingRequestByEmail(email);
    if (!pending) return sendError(res, 404, 'Pending request not found');

    let uid = null;
    try {
      const existingAuthUser = await auth.getUserByEmail(pending.email);
      uid = existingAuthUser.uid;
    } catch (error) {
      const createdUser = await auth.createUser({
        email: pending.email,
        password: pending.password,
        displayName: pending.name,
      });
      uid = createdUser.uid;
    }

    await User.create(uid, {
      email: pending.email,
      name: pending.name,
      role: pending.role,
      idNumber: pending.idNumber,
      gradeLevel: pending.gradeLevel || null,
      section: pending.section || null,
      status: 'approved',
      createdAt: new Date(),
    });

    await User.deletePendingRequestByEmail(pending.email);

    sendSuccess(res, 200, { uid }, 'User approved');
  } catch (error) {
    console.error('Approve user error:', error);
    sendError(res, 500, 'Failed to approve user', error.message);
  }
};

exports.rejectUser = async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) return sendError(res, 400, 'Email is required');

    const pending = await User.getPendingRequestByEmail(email);
    if (!pending) return sendError(res, 404, 'Pending request not found');

    await User.deletePendingRequestByEmail(pending.email);

    sendSuccess(res, 200, {}, 'User rejected');
  } catch (error) {
    console.error('Reject user error:', error);
    sendError(res, 500, 'Failed to reject user', error.message);
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.getAllUsers();
    sendSuccess(res, 200, users, 'Users retrieved');
  } catch (error) {
    console.error('Get users error:', error);
    sendError(res, 500, 'Failed to get users', error.message);
  }
};

exports.getDeletedUsers = async (req, res) => {
  try {
    const users = await User.getDeletedUsers();
    sendSuccess(res, 200, users, 'Deleted users retrieved');
  } catch (error) {
    console.error('Get deleted users error:', error);
    sendError(res, 500, 'Failed to get deleted users', error.message);
  }
};

exports.deleteUserAccount = async (req, res) => {
  try {
    const { uid } = req.params;
    if (!uid) return sendError(res, 400, 'UID is required');

    if (uid === req.user.uid) {
      return sendError(res, 400, 'You cannot delete your own account');
    }

    const existing = await User.getById(uid);
    if (!existing) return sendError(res, 404, 'User not found');

    await User.archiveDeletedUser(uid, existing, { deletedBy: req.user.uid });

    try {
      await auth.deleteUser(uid);
    } catch (authErr) {
      const code = authErr?.code || '';
      // If auth record is already gone, continue removing Firestore user.
      if (!code.includes('user-not-found')) {
        throw authErr;
      }
    }

    await User.delete(uid);

    sendSuccess(res, 200, { uid }, 'User account deleted');
  } catch (error) {
    console.error('Delete user account error:', error);
    sendError(res, 500, 'Failed to delete user account', error.message);
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.getById(req.user.uid);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    sendSuccess(res, 200, user, 'Profile retrieved');
  } catch (error) {
    console.error('Get profile error:', error);
    sendError(res, 500, 'Failed to get profile', error.message);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;

    // Only update provided fields
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (avatar) updateData.avatar = avatar;

    if (Object.keys(updateData).length === 0) {
      return sendError(res, 400, 'No fields provided to update');
    }

    await User.update(req.user.uid, updateData);

    // Optional: log profile update
    await AuditLog.create({
      adminId: req.user.uid,
      action: 'UPDATE_PROFILE',
      targetId: req.user.uid,
      targetType: 'user',
      details: `Updated profile fields: ${Object.keys(updateData).join(', ')}`,
    });

    sendSuccess(res, 200, {}, 'Profile updated successfully');
  } catch (error) {
    console.error('Update profile error:', error);
    sendError(res, 500, 'Failed to update profile', error.message);
  }
};