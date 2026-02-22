// models/User.js
const { db } = require('../config/database');

class User {
  // Create a new user
  static async create(uid, userData) {
    try {
      const timestamp = new Date();
      await db.collection('users').doc(uid).set({
        uid: uid,
        email: userData.email,
        name: userData.name,
        role: userData.role, // 'admin', 'teacher', 'student'
        idNumber: userData.idNumber,
        gradeLevel: userData.gradeLevel,
        section: userData.section,
        status: userData.status || 'approved', // 'approved' | 'pending'
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return { success: true, uid, createdAt: timestamp };
    } catch (error) {
      throw error;
    }
  }

  // Get user by UID
  static async getById(uid) {
    try {
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists) return doc.data();
      return null;
    } catch (error) {
      throw error;
    }
  }

  // Get user by email
  static async getByEmail(email) {
    try {
      const snapshot = await db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      return snapshot.docs[0].data();
    } catch (error) {
      throw error;
    }
  }

  // Get pending users
  static async getPendingUsers() {
    try {
      const snapshot = await db.collection('users')
        .where('status', '==', 'pending')
        .get();

      return snapshot.docs.map((doc) => doc.data());
    } catch (error) {
      throw error;
    }
  }

  // Get active users
  static async getAllUsers() {
    try {
      const snapshot = await db.collection('users').get();
      return snapshot.docs.map((doc) => doc.data());
    } catch (error) {
      throw error;
    }
  }

  // Get deleted user records
  static async getDeletedUsers() {
    try {
      const snapshot = await db.collection('deleted_users').get();
      return snapshot.docs.map((doc) => doc.data());
    } catch (error) {
      throw error;
    }
  }

  // Archive deleted user for admin visibility/history
  static async archiveDeletedUser(uid, userData, meta = {}) {
    try {
      const timestamp = new Date();
      await db.collection('deleted_users').doc(uid).set({
        uid,
        ...userData,
        deletedAt: timestamp,
        deletedBy: meta.deletedBy || null,
      }, { merge: true });
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  // Create a pending registration request (no Firebase Auth user yet)
  static async createPendingRequest(pendingData) {
    try {
      const emailKey = pendingData.email.toLowerCase();
      const docRef = db.collection('pending_users').doc(emailKey);
      const existing = await docRef.get();
      if (existing.exists) {
        return { success: false, message: 'Pending request already exists' };
      }

      await docRef.set({
        email: pendingData.email,
        name: pendingData.name,
        role: pendingData.role,
        idNumber: pendingData.idNumber,
        gradeLevel: pendingData.gradeLevel || null,
        section: pendingData.section || null,
        password: pendingData.password,
        createdAt: new Date(),
      });

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  static async getPendingRequests() {
    try {
      const snapshot = await db.collection('pending_users').get();
      return snapshot.docs.map((doc) => doc.data());
    } catch (error) {
      throw error;
    }
  }

  static async getPendingRequestByEmail(email) {
    try {
      const doc = await db.collection('pending_users').doc(email.toLowerCase()).get();
      if (!doc.exists) return null;
      return doc.data();
    } catch (error) {
      throw error;
    }
  }

  static async deletePendingRequestByEmail(email) {
    try {
      await db.collection('pending_users').doc(email.toLowerCase()).delete();
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  // Update user data
  static async update(uid, data) {
    try {
      const userRef = db.collection('users').doc(uid);
      const doc = await userRef.get();
      if (!doc.exists) return { success: false, message: 'User not found' };

      await userRef.update({
        ...data,
        updatedAt: new Date(),
      });
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  // Delete user
  static async delete(uid) {
    try {
      const userRef = db.collection('users').doc(uid);
      const doc = await userRef.get();
      if (!doc.exists) return { success: false, message: 'User not found' };

      await userRef.delete();
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;