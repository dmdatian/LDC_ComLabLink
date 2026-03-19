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
    const status = user.status || 'approved';
    if (status === 'inactive') {
      return sendError(res, 403, 'Account is inactive. Please contact admin.');
    }
    sendSuccess(res, 200, {
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: normalizedRole,
      status,
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
    const status = user.status || 'approved';
    if (status === 'inactive') {
      return sendError(res, 403, 'Account is inactive. Please contact admin.');
    }
    sendSuccess(res, 200, {
      uid: req.user.uid,
      email: req.user.email,
      name: user.name,
      role: normalizedRole,
      status,
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

exports.getInactiveUsers = async (req, res) => {
  try {
    const users = await User.getInactiveUsers();
    sendSuccess(res, 200, users, 'Inactive users retrieved');
  } catch (error) {
    console.error('Get inactive users error:', error);
    sendError(res, 500, 'Failed to get inactive users', error.message);
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

    try {
      await auth.updateUser(uid, { disabled: true });
    } catch (authErr) {
      const code = authErr?.code || '';
      // If auth record is already gone, continue updating Firestore user.
      if (!code.includes('user-not-found')) {
        throw authErr;
      }
    }

    await User.update(uid, {
      status: 'inactive',
      inactiveAt: new Date(),
      inactiveBy: req.user.uid,
    });

    sendSuccess(res, 200, { uid }, 'User account marked inactive');
  } catch (error) {
    console.error('Delete user account error:', error);
    sendError(res, 500, 'Failed to delete user account', error.message);
  }
};

exports.permanentlyDeleteUserAccount = async (req, res) => {
  try {
    const { uid } = req.params;
    if (!uid) return sendError(res, 400, 'UID is required');

    if (uid === req.user.uid) {
      return sendError(res, 400, 'You cannot delete your own account');
    }

    const existing = await User.getById(uid);
    if (!existing) return sendError(res, 404, 'User not found');

    if (String(existing.status || '').toLowerCase() !== 'inactive') {
      return sendError(res, 409, 'Only inactive accounts can be permanently deleted');
    }

    try {
      await auth.deleteUser(uid);
    } catch (authErr) {
      const code = authErr?.code || '';
      if (!code.includes('user-not-found')) {
        throw authErr;
      }
    }

    await User.delete(uid);

    sendSuccess(res, 200, { uid }, 'User account permanently deleted');
  } catch (error) {
    console.error('Permanent delete user account error:', error);
    sendError(res, 500, 'Failed to permanently delete user account', error.message);
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
    if (req.body?.requiresPasswordChange === false) {
      updateData.requiresPasswordChange = false;
      updateData.passwordChangedAt = new Date();
    }

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

const parseCsvLine = (line = '') => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let idx = 0; idx < line.length; idx += 1) {
    const ch = line[idx];
    const next = line[idx + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      idx += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  values.push(current.trim());
  return values;
};

const parseCsvRows = (csvText = '') => {
  const lines = String(csvText)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => String(h || '').trim().toLowerCase());
  const rows = [];

  for (let idx = 1; idx < lines.length; idx += 1) {
    const raw = parseCsvLine(lines[idx]);
    const row = {};
    headers.forEach((header, colIdx) => {
      row[header] = raw[colIdx] == null ? '' : String(raw[colIdx]).trim();
    });
    rows.push(row);
  }

  return rows;
};

exports.importUsersFromCsv = async (req, res) => {
  try {
    const { csvText, defaultPassword, forcedRole } = req.body || {};
    const password = String(defaultPassword || 'ldc@2026!').trim();
    const normalizedForcedRole = forcedRole == null ? '' : String(forcedRole).trim().toLowerCase();
    if (password.length < 6) {
      return sendError(res, 400, 'Default password must be at least 6 characters');
    }
    if (normalizedForcedRole && !['student', 'teacher'].includes(normalizedForcedRole)) {
      return sendError(res, 400, 'Forced role must be student or teacher');
    }

    if (!csvText || !String(csvText).trim()) {
      return sendError(res, 400, 'CSV content is required');
    }

    const rows = parseCsvRows(csvText);
    if (rows.length === 0) {
      return sendError(res, 400, 'No CSV rows found');
    }

    const summary = {
      total: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    for (let idx = 0; idx < rows.length; idx += 1) {
      const rowNumber = idx + 2;
      const row = rows[idx];
      const pick = (...keys) => {
        for (const key of keys) {
          const value = row[key];
          if (value != null && String(value).trim()) return String(value).trim();
        }
        return '';
      };

      const email = pick('email', 'email address').toLowerCase();
      const surname = pick('surname', 'last name', 'lastname');
      const firstName = pick('first name', 'firstname');
      const middleName = pick('middle name', 'middlename', 'middle initial');
      const explicitName = pick('name', 'fullname', 'full name');
      const assembledName = [surname, firstName, middleName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      const name = explicitName || assembledName;
      const csvRole = String(row.role || '').trim().toLowerCase();
      const role = normalizedForcedRole || csvRole || 'student';
      const idNumber = pick('idnumber', 'id number', 'id') || null;
      const gradeLevel = pick('gradelevel', 'grade level', 'grade') || null;
      const section = pick('section') || null;

      if (!email || !name) {
        summary.skipped += 1;
        summary.errors.push(`Row ${rowNumber}: email and name fields are required`);
        continue;
      }
      if (!validateEmail(email)) {
        summary.skipped += 1;
        summary.errors.push(`Row ${rowNumber}: invalid email "${email}"`);
        continue;
      }
      if (!['student', 'teacher'].includes(role)) {
        summary.skipped += 1;
        summary.errors.push(`Row ${rowNumber}: role must be student or teacher`);
        continue;
      }

      try {
        let authUser = null;
        try {
          authUser = await auth.getUserByEmail(email);
        } catch (authErr) {
          const code = String(authErr?.code || '');
          if (!code.includes('user-not-found')) throw authErr;
        }

        if (!authUser) {
          authUser = await auth.createUser({
            email,
            password,
            displayName: name,
          });
        } else {
          // Treat CSV import as the source of truth for yearly rollovers.
          await auth.updateUser(authUser.uid, {
            displayName: name,
            password,
          });
        }

        const existing = await User.getById(authUser.uid);
        const payload = {
          email,
          name,
          role,
          idNumber,
          gradeLevel: role === 'student' ? gradeLevel : null,
          section: role === 'student' ? section : null,
          status: 'approved',
          requiresPasswordChange: true,
        };

        if (existing) {
          await User.update(authUser.uid, payload);
          summary.updated += 1;
        } else {
          await User.create(authUser.uid, payload);
          summary.created += 1;
        }
      } catch (rowErr) {
        summary.skipped += 1;
        summary.errors.push(`Row ${rowNumber}: ${rowErr.message || 'failed to import'}`);
      }
    }

    return sendSuccess(res, 200, summary, 'CSV import completed');
  } catch (error) {
    console.error('Import users from CSV error:', error);
    return sendError(res, 500, 'Failed to import CSV users', error.message);
  }
};

exports.updateUserAccount = async (req, res) => {
  try {
    const uid = String(req.params.uid || '').trim();
    if (!uid) return sendError(res, 400, 'UID is required');

    const existing = await User.getById(uid);
    if (!existing) return sendError(res, 404, 'User not found');

    const name = String(req.body?.name ?? existing.name ?? '').trim();
    const gradeLevelRaw = req.body?.gradeLevel;
    const sectionRaw = req.body?.section;
    const gradeLevel = gradeLevelRaw == null ? existing.gradeLevel || null : String(gradeLevelRaw).trim() || null;
    const section = sectionRaw == null ? existing.section || null : String(sectionRaw).trim() || null;

    const patch = {
      name: name || existing.name || null,
      gradeLevel: String(existing.role || '').toLowerCase() === 'student' ? gradeLevel : null,
      section: String(existing.role || '').toLowerCase() === 'student' ? section : null,
    };

    await User.update(uid, patch);
    try {
      await auth.updateUser(uid, { displayName: patch.name || undefined });
    } catch (authErr) {
      // Keep Firestore update as source of truth even if Auth profile update fails.
    }

    const updated = await User.getById(uid);
    return sendSuccess(res, 200, updated, 'User account updated');
  } catch (error) {
    console.error('Update user account error:', error);
    return sendError(res, 500, 'Failed to update user account', error.message);
  }
};

exports.resetUserPassword = async (req, res) => {
  try {
    const uid = String(req.params.uid || '').trim();
    const newPassword = String(req.body?.newPassword || 'Student123').trim();
    if (!uid) return sendError(res, 400, 'UID is required');
    if (newPassword.length < 6) {
      return sendError(res, 400, 'New password must be at least 6 characters');
    }

    await auth.updateUser(uid, { password: newPassword });
    await User.update(uid, {
      requiresPasswordChange: true,
      passwordChangedAt: null,
    });
    return sendSuccess(res, 200, { uid }, 'Password reset successful');
  } catch (error) {
    console.error('Reset user password error:', error);
    return sendError(res, 500, 'Failed to reset user password', error.message);
  }
};