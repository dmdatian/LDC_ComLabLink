// utils/logger.js
const { db } = require('../config/database'); // Firestore reference

// General logging function
const log = async (type, message, data = null) => {
  try {
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      timestamp,
      type,
      message,
      data,
    };

    // Save log in Firestore audit_logs collection
    await db.collection('audit_logs').add(logEntry);

    // Also log to console for development
    console.log(`[${timestamp}] ${type}: ${message}`, data || '');
  } catch (err) {
    console.error('Failed to log to Firestore:', err);
  }
};

// Specific log types
const logError = async (message, error) => {
  await log('ERROR', message, error);
};

const logInfo = async (message, data) => {
  await log('INFO', message, data);
};

const logBooking = async (message, data) => {
  await log('BOOKING', message, data);
};

module.exports = {
  log,
  logError,
  logInfo,
  logBooking,
};
