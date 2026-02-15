const { db } = require('../config/database');

const COLLECTION = 'notifications';

class Notification {
  static async create(data) {
    const payload = {
      recipientId: data.recipientId,
      recipientRole: data.recipientRole || null,
      type: data.type || 'attendance_marked',
      severity: data.severity || 'info', // info | warning
      title: data.title || 'Notification',
      message: data.message || '',
      attendanceId: data.attendanceId || null,
      bookingId: data.bookingId || null,
      date: data.date || null,
      read: false,
      createdAt: new Date(),
    };

    const docRef = await db.collection(COLLECTION).add(payload);
    return { id: docRef.id, ...payload };
  }

  static async getByRecipient(recipientId, limit = 50) {
    const snap = await db.collection(COLLECTION)
      .where('recipientId', '==', recipientId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  static async markRead(id, recipientId) {
    const ref = db.collection(COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return null;

    const row = snap.data();
    if (row.recipientId !== recipientId) return null;

    await ref.update({ read: true });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() };
  }
}

module.exports = Notification;