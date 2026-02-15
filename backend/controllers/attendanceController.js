const Attendance = require('../models/Attendance');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/responseHandler');

exports.getAttendanceByDate = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return sendError(res, 403, 'Only admins can view attendance list');
    const { date } = req.query;
    if (!date) return sendError(res, 400, 'date is required');

    const data = await Attendance.getByDate(date);
    sendSuccess(res, 200, data, 'Attendance retrieved');
  } catch (error) {
    console.error('getAttendanceByDate error:', error);
    sendError(res, 500, 'Failed to retrieve attendance', error.message);
  }
};

exports.markAttendance = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return sendError(res, 403, 'Only admins can mark attendance');

    const bookingId = String(req.params.bookingId || '').trim();
    const status = String(req.body.status || '').trim().toLowerCase();
    const remarks = String(req.body.remarks || '').trim();

    if (!bookingId) return sendError(res, 400, 'bookingId is required');
    if (!['present', 'absent', 'excused'].includes(status)) {
      return sendError(res, 400, 'status must be present, absent, or excused');
    }

    const attendance = await Attendance.mark(bookingId, {
      status,
      remarks,
      adminId: req.user.uid,
      adminName: req.user.name || 'Admin',
    });

    if (!attendance) return sendError(res, 404, 'Attendance record not found');

    await Booking.update(bookingId, {
      status: status === 'present' ? 'attended' : status === 'absent' ? 'absent' : 'approved',
    });

    const base = {
      attendanceId: attendance.id,
      bookingId: attendance.bookingId,
      date: attendance.date,
      type: 'attendance_marked',
    };

    if (attendance.studentId) {
      await Notification.create({
        ...base,
        recipientId: attendance.studentId,
        recipientRole: 'student',
        severity: status === 'absent' ? 'warning' : 'info',
        title: 'Attendance Updated',
        message: `Your booking on ${attendance.date} was marked ${status.toUpperCase()}.`,
      });
    }

    if (attendance.teacherId) {
      await Notification.create({
        ...base,
        recipientId: attendance.teacherId,
        recipientRole: 'teacher',
        severity: status === 'absent' ? 'warning' : 'info',
        title: 'Student Attendance Updated',
        message: `${attendance.studentName} was marked ${status.toUpperCase()} on ${attendance.date}.`,
      });
    }

    sendSuccess(res, 200, attendance, 'Attendance marked');
  } catch (error) {
    console.error('markAttendance error:', error);
    sendError(res, 500, 'Failed to mark attendance', error.message);
  }
};