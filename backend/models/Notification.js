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
    const normalizedUserId = String(userId || '').trim();
    try {
      const snapshot = await db.collection(COLLECTION)
        .where('userId', '==', normalizedUserId)
        .orderBy('createdAt', 'desc')
        .limit(safeLimit)
        .get();

      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    } catch (error) {
      // Fallback for deployments where the ordered query is unavailable or not indexed yet.
      const snapshot = await db.collection(COLLECTION)
        .where('userId', '==', normalizedUserId)
        .get();

      return snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => {
          const aTime = a?.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a?.createdAt || 0).getTime();
          const bTime = b?.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b?.createdAt || 0).getTime();
          return bTime - aTime;
        })
        .slice(0, safeLimit);
    }
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