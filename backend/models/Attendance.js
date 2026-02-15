const { db } = require('../config/database');

const COLLECTION = 'attendances';

class Attendance {
  static async upsertFromBooking(booking) {
    const docId = booking.id; // 1 booking = 1 attendance
    const now = new Date();

    const payload = {
      bookingId: booking.id,
      studentId: booking.studentId,
      studentName: booking.studentName || 'Unknown',
      teacherId: booking.teacherId || null,
      teacherName: booking.teacherName || null,
      date: booking.date,
      startTime: new Date(booking.startTime),
      endTime: new Date(booking.endTime),
      seatIds: Array.isArray(booking.seats) ? booking.seats : [],
      gradeLevelId: booking.gradeLevelId || null,
      gradeLevel: booking.gradeLevel || null,
      sectionId: booking.sectionId || null,
      section: booking.section || null,
      subject: booking.subject || null,
      status: 'expected', // expected | present | absent | excused | cancelled
      adminMarkedBy: null,
      adminMarkedByName: null,
      markedAt: null,
      remarks: null,
      warningSent: false,
      updatedAt: now,
    };

    const ref = db.collection(COLLECTION).doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
      await ref.set(payload, { merge: true });
      return { id: docId, ...payload };
    }

    await ref.set({ ...payload, createdAt: now });
    return { id: docId, ...payload, createdAt: now };
  }

  static async getByDate(date) {
    const snap = await db.collection(COLLECTION)
      .where('date', '==', date)
      .get();

    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return rows.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }

  static async getByBookingId(bookingId) {
    const doc = await db.collection(COLLECTION).doc(bookingId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  static async mark(bookingId, { status, remarks, adminId, adminName }) {
    const ref = db.collection(COLLECTION).doc(bookingId);
    const snap = await ref.get();
    if (!snap.exists) return null;

    const now = new Date();
    await ref.update({
      status,
      remarks: remarks || null,
      adminMarkedBy: adminId || null,
      adminMarkedByName: adminName || null,
      markedAt: now,
      warningSent: status === 'absent',
      updatedAt: now,
    });

    const updated = await ref.get();
    return { id: updated.id, ...updated.data() };
  }

  static async markCancelled(bookingId) {
    const ref = db.collection(COLLECTION).doc(bookingId);
    const snap = await ref.get();
    if (!snap.exists) return null;

    await ref.update({
      status: 'cancelled',
      updatedAt: new Date(),
    });

    const updated = await ref.get();
    return { id: updated.id, ...updated.data() };
  }
}

module.exports = Attendance;