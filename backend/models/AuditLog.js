// models/AuditLog.js
const { db } = require('../config/database');

class AuditLog {
  // Create a new audit log
  static async create(logData) {
    try {
      const timestamp = new Date();
      await db.collection('audit_logs').add({
        adminId: logData.adminId,
        action: logData.action,
        targetId: logData.targetId,
        targetType: logData.targetType, // 'user', 'booking', 'class'
        details: logData.details,
        timestamp,
      });
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  // Get audit logs by admin ID
  static async getByAdminId(adminId) {
    try {
      const snapshot = await db.collection('audit_logs')
        .where('adminId', '==', adminId)
        .orderBy('timestamp', 'desc')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw error;
    }
  }

  // Get all audit logs
  static async getAll() {
    try {
      const snapshot = await db.collection('audit_logs')
        .orderBy('timestamp', 'desc')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw error;
    }
  }
}

module.exports = AuditLog;
