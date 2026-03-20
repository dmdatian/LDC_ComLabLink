const Booking = require('../models/Booking');
const Class = require('../models/Class');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const buildBookingSummary = (bookings = []) => {
  const normalized = bookings.map((booking) => String(booking?.status || 'approved').toLowerCase());

  return {
    totalBookings: bookings.length,
    approvedBookings: normalized.filter((status) => ['approved', 'attended'].includes(status)).length,
    upcomingBookings: normalized.filter((status) => ['approved'].includes(status)).length,
    attendedBookings: normalized.filter((status) => status === 'attended').length,
    cancelledBookings: normalized.filter((status) => status === 'cancelled').length,
    missedBookings: normalized.filter((status) => status === 'missed').length,
  };
};

exports.getDailyReport = async (req, res) => {
  try {
    if (!['admin', 'teacher'].includes(req.user.role)) {
      return sendError(res, 403, 'Unauthorized');
    }

    const { date } = req.query;
    if (!date) return sendError(res, 400, 'Date is required');

    const bookings = await Booking.getByDate(date);
    const classes = await Class.getByDate(date);

    const summary = buildBookingSummary(bookings);

    sendSuccess(res, 200, {
      date,
      totalClasses: classes.length,
      ...summary,
      bookings,
      classes
    }, 'Daily report generated');
  } catch (error) {
    console.error('Daily report error:', error);
    sendError(res, 500, 'Failed to generate report', error.message);
  }
};

exports.getWeeklyReport = async (req, res) => {
  try {
    if (!['admin', 'teacher'].includes(req.user.role)) {
      return sendError(res, 403, 'Unauthorized');
    }

    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return sendError(res, 400, 'Start and end dates are required');

    // Use Booking.getByDate multiple times or a Firestore range query
    const snapshot = await require('../config/database').db.collection('workspace_booking')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    sendSuccess(res, 200, {
      startDate,
      endDate,
      ...buildBookingSummary(bookings),
      bookings
    }, 'Weekly report generated');
  } catch (error) {
    console.error('Weekly report error:', error);
    sendError(res, 500, 'Failed to generate report', error.message);
  }
};

exports.getMonthlyReport = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return sendError(res, 403, 'Only admins can view monthly reports');
    }

    const { month, year } = req.query;
    if (!month || !year) return sendError(res, 400, 'Month and year are required');

    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const snapshot = await require('../config/database').db.collection('workspace_booking')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    sendSuccess(res, 200, {
      month,
      year,
      ...buildBookingSummary(bookings),
      bookings
    }, 'Monthly report generated');
  } catch (error) {
    console.error('Monthly report error:', error);
    sendError(res, 500, 'Failed to generate report', error.message);
  }
};