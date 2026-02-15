const { db } = require('../config/database');

const COLLECTION = 'notifications';

class Notification {
  static async create(payload) {
    const now = new Date();
    const doc = {
      userId: String(payload.userId || '').trim(),
      title: String(payload.title || 'Notification').trim(),
      message: String(payload.message || '').trim(),
      severity: String(payload.severity || 'info').trim().toLowerCase(),
      type: String(payload.type || 'general').trim().toLowerCase(),
      bookingId: payload.bookingId || null,
      read: false,
      createdAt: now,
      updatedAt: now,
    };

    if (!doc.userId || !doc.message) return null;
    const ref = await db.collection(COLLECTION).add(doc);
    return { id: ref.id, ...doc };
  }

  static async listByUser(userId, limit = 50) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const snapshot = await db.collection(COLLECTION)
      .where('userId', '==', String(userId || '').trim())
      .orderBy('createdAt', 'desc')
      .limit(safeLimit)
      .get();

    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  static async markRead(id, userId) {
    const ref = db.collection(COLLECTION).doc(String(id || '').trim());
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, code: 404 };

    const data = snap.data() || {};
    if (String(data.userId || '').trim() !== String(userId || '').trim()) {
      return { ok: false, code: 403 };
    }

    await ref.set({ read: true, updatedAt: new Date() }, { merge: true });
    return { ok: true };
  }
}

module.exports = Notification;