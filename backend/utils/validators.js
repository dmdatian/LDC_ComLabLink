const { db } = require('../config/database'); // Firestore reference

// Simple email regex validation
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate that start < end and not in the past
const validateTimeSlot = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) {
    return { valid: false, message: 'End time must be after start time' };
  }

  const now = new Date();
  const graceMs = 5 * 60 * 1000;
  if (start.getTime() < now.getTime() - graceMs) {
    return { valid: false, message: 'Cannot book past times' };
  }

  return { valid: true };
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value.seconds) return new Date(value.seconds * 1000);
  if (value._seconds) return new Date(value._seconds * 1000);
  if (value.toDate) return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// Firestore-friendly: Validate booking data
const validateBookingData = async (data) => {
  const errors = [];

  // Basic fields
  if (!data.studentId) errors.push('Student ID required');
  if (!data.date) errors.push('Date required');
  if (!data.startTime) errors.push('Start time required');
  if (!data.endTime) errors.push('End time required');

  if (data.startTime && data.endTime) {
    const validation = validateTimeSlot(data.startTime, data.endTime);
    if (!validation.valid) errors.push(validation.message);
  }

  // Firestore check: user role if available (do not block if missing)
  if (data.studentId) {
    const studentDoc = await db.collection('users').doc(data.studentId).get();
    if (studentDoc.exists) {
      const role = (studentDoc.data().role || '').toLowerCase();
      if (role && !['student', 'teacher', 'admin'].includes(role)) {
        errors.push('User role is not allowed to book');
      }
    }
  }

  // Firestore check: lab capacity (avoid composite indexes)
  if (data.date && data.startTime && data.endTime) {
    const bookingsSnap = await db.collection('seats')
      .where('date', '==', data.date)
      .get();

    const bookings = bookingsSnap.docs.map(doc => doc.data());
    const overlapping = bookings.filter((booking) => {
      const start = toDate(booking.startTime);
      const end = toDate(booking.endTime);
      if (!start || !end) return false;
      return start < data.endTime && end > data.startTime;
    });

    const LAB_CAPACITY = 20;
    if (overlapping.length >= LAB_CAPACITY) {
      errors.push('Lab is full at this time');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
  };
};

module.exports = {
  validateEmail,
  validateTimeSlot,
  validateBookingData,
};
