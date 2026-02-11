// utils/timeUtils.js
const { db } = require('../config/database'); // Firestore reference

// Get current date & time
const getCurrentDateTime = () => new Date();

// Format date as YYYY-MM-DD
const formatDate = (date) => date.toISOString().split('T')[0];

// Format time as HH:MM:SS
const formatTime = (date) => date.toTimeString().split(' ')[0];

// Check if two time slots overlap
const isTimeConflict = (slot1Start, slot1End, slot2Start, slot2End) => {
  return slot1Start < slot2End && slot2Start < slot1End;
};

// Firestore-friendly: Get next available slot based on booked slots
const getNextAvailableSlot = async (date, duration = 1) => {
  // duration in hours
  const now = new Date();
  let currentSlot = new Date(now);
  currentSlot.setHours(currentSlot.getHours() + 1); // start from next hour

  // Fetch all bookings and classes for the date from Firestore
  const bookingsSnap = await db.collection('bookings')
    .where('date', '==', date)
    .get();

  const classesSnap = await db.collection('classes')
    .where('date', '==', date)
    .get();

  const bookedSlots = [];

  bookingsSnap.forEach(doc => {
    const data = doc.data();
    bookedSlots.push({ startTime: new Date(data.startTime), endTime: new Date(data.endTime) });
  });

  classesSnap.forEach(doc => {
    const data = doc.data();
    bookedSlots.push({ startTime: new Date(data.startTime), endTime: new Date(data.endTime) });
  });

  // Loop until a free slot is found
  while (true) {
    const slotEnd = new Date(currentSlot);
    slotEnd.setHours(slotEnd.getHours() + duration);

    const hasConflict = bookedSlots.some(slot =>
      isTimeConflict(slot.startTime, slot.endTime, currentSlot, slotEnd)
    );

    if (!hasConflict) {
      return {
        startTime: currentSlot,
        endTime: slotEnd,
      };
    }

    // Move to next hour
    currentSlot.setHours(currentSlot.getHours() + 1);
  }
};

module.exports = {
  getCurrentDateTime,
  formatDate,
  formatTime,
  isTimeConflict,
  getNextAvailableSlot,
};
