const { db } = require('../config/database');
const { isTimeConflict } = require('../utils/timeHelper');

const COLLECTION = 'seats';

// BOOKING MODEL: Firestore access for seats collection
class Booking {
  static async create(bookingData) {
    try {
      const docRef = await db.collection(COLLECTION).add({
        studentId: bookingData.studentId,
        studentName: bookingData.studentName,
        role: bookingData.role || 'student',
        date: bookingData.date,
        startTime: new Date(bookingData.startTime),
        endTime: new Date(bookingData.endTime),
        seats: bookingData.seats || [],
        purpose: bookingData.purpose || null,
        subject: bookingData.subject || null,
        gradeLevelId: bookingData.gradeLevelId || null,
        gradeLevel: bookingData.gradeLevel || null,
        sectionId: bookingData.sectionId || null,
        section: bookingData.section || null,
        status: bookingData.status || 'pending', // pending, approved, rejected, attended
        attendanceDeadlineAt: bookingData.attendanceDeadlineAt ? new Date(bookingData.attendanceDeadlineAt) : null,
        attendanceConfirmedAt: bookingData.attendanceConfirmedAt ? new Date(bookingData.attendanceConfirmedAt) : null,
        attendanceReminderNotifiedAt: bookingData.attendanceReminderNotifiedAt ? new Date(bookingData.attendanceReminderNotifiedAt) : null,
        attendanceNoShowAt: bookingData.attendanceNoShowAt ? new Date(bookingData.attendanceNoShowAt) : null,
        attendanceNoShowNotifiedAt: bookingData.attendanceNoShowNotifiedAt ? new Date(bookingData.attendanceNoShowNotifiedAt) : null,
        rejectionReason: null,
        suggestedSlot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      throw error;
    }
  }

  static async getById(id) {
    try {
      const doc = await db.collection(COLLECTION).doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  static async getByStudentId(studentId) {
    try {
      const snapshot = await db.collection(COLLECTION)
        .where('studentId', '==', studentId)
        .get();
      const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return bookings.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    } catch (error) {
      throw error;
    }
  }

  static async getByDate(date) {
    try {
      const snapshot = await db.collection(COLLECTION)
        .where('date', '==', date)
        .get();
      const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return bookings.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    } catch (error) {
      throw error;
    }
  }

  static async checkConflict(date, startTime, endTime) {
    try {
      const snapshot = await db.collection(COLLECTION)
        .where('date', '==', date)
        .where('status', 'in', ['approved', 'attended'])
        .get();

      const conflicts = snapshot.docs.filter(doc => {
        const booking = doc.data();
        return isTimeConflict(
          new Date(booking.startTime),
          new Date(booking.endTime),
          new Date(startTime),
          new Date(endTime)
        );
      });

      return conflicts.length > 0;
    } catch (error) {
      throw error;
    }
  }

  static async update(id, data) {
    try {
      await db.collection(COLLECTION).doc(id).update({
        ...data,
        updatedAt: new Date(),
      });
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  static async delete(id) {
    try {
      await db.collection(COLLECTION).doc(id).delete();
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Booking;