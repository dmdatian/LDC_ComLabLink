// models/Feedback.js
const { db } = require('../config/database');

class Feedback {
  static async create(data) {
    try {
      const timestamp = new Date();
      const payload = {
        role: data.role,
        name: data.name,
        userId: data.userId,
        message: data.message,
        category: data.category || null,
        source: data.source || null,
        createdAt: timestamp,
      };

      const docRef = await db.collection('feedback').add(payload);
      return { success: true, id: docRef.id, createdAt: timestamp };
    } catch (error) {
      throw error;
    }
  }

  static async list({ limit = 50 } = {}) {
    try {
      const snapshot = await db.collection('feedback')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Feedback;
