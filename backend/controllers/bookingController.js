const Booking = require('../models/Booking');
const Class = require('../models/Class');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { db } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { validateBookingData } = require('../utils/validators');
const { isTimeConflict, getNextAvailableSlot } = require('../utils/timeHelper');
const {
  normalizeTime,
  normalizeDayOfWeek,
  combineDateAndTime,
  getAllFixedScheduleEntries,
  getFixedScheduleForDate,
  findFixedScheduleConflict,
} = require('../utils/fixedSchedule');

const MAX_BOOKINGS_PER_DAY_PER_USER = 2;
const ATTENDANCE_CONFIRMATION_WINDOW_MINUTES = 15;
const ACTIVE_BOOKING_STATUSES = new Set(['pending', 'approved']);

const isActiveBookingStatus = (status) => ACTIVE_BOOKING_STATUSES.has(String(status || '').toLowerCase());
const isWeekendDateKey = (dateKey) => {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = utcDate.getUTCDay(); // 0 Sunday, 6 Saturday
  return dayOfWeek === 0 || dayOfWeek === 6;
};

const normalizeSeats = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value];
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

const formatClock = (value) => {
  const date = toDate(value);
  if (!date) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getAttendanceDeadline = (booking) => {
  const start = toDate(booking?.startTime);
  if (!start) return null;
  const stored = toDate(booking?.attendanceDeadlineAt);
  if (stored) return stored;
  return new Date(start.getTime() + ATTENDANCE_CONFIRMATION_WINDOW_MINUTES * 60 * 1000);
};

const createAttendanceNotification = async (booking, payload) => {
  const userId = String(booking?.studentId || '').trim();
  if (!userId) return;
  await Notification.create({
    userId,
    bookingId: booking.id,
    ...payload,
  });
};

const applyAttendanceAutomation = async (bookings = [], opts = {}) => {
  const now = new Date();
  const reminderUserId = String(opts.reminderUserId || '').trim();

  for (const booking of bookings) {
    const currentStatus = String(booking?.status || '').toLowerCase();
    if (currentStatus !== 'approved') continue;

    const start = toDate(booking?.startTime);
    const deadline = getAttendanceDeadline(booking);
    if (!start || !deadline) continue;

    const patch = {};
    if (!booking.attendanceDeadlineAt) patch.attendanceDeadlineAt = deadline;

    // Reminder only for the current viewer to avoid noisy mass notifications.
    if (
      reminderUserId &&
      String(booking.studentId || '').trim() === reminderUserId &&
      now >= start &&
      now <= deadline &&
      !booking.attendanceConfirmedAt &&
      !booking.attendanceReminderNotifiedAt
    ) {
      patch.attendanceReminderNotifiedAt = now;
    }

    if (now > deadline && !booking.attendanceConfirmedAt) {
      patch.status = 'missed';
      patch.attendanceNoShowAt = now;
      if (!booking.attendanceNoShowNotifiedAt) {
        patch.attendanceNoShowNotifiedAt = now;
      }
    }

    if (Object.keys(patch).length === 0) continue;
    await Booking.update(booking.id, patch);
    Object.assign(booking, patch);

    if (patch.attendanceReminderNotifiedAt) {
      await createAttendanceNotification(booking, {
        title: 'Attendance Confirmation Needed',
        message: `Confirm your attendance between ${formatClock(start)} and ${formatClock(deadline)}.`,
        severity: 'warning',
        type: 'attendance',
      });
    }

    if (patch.status === 'missed' && patch.attendanceNoShowNotifiedAt) {
      await createAttendanceNotification(booking, {
        title: 'Marked Missed',
        message: `No attendance confirmation was received within ${ATTENDANCE_CONFIRMATION_WINDOW_MINUTES} minutes from start time.`,
        severity: 'warning',
        type: 'attendance',
      });
    }
  }
};

const DEFAULT_SEAT_CATALOG = [
  { id: 'A1', row: 'A', column: 1, side: 'left', active: true },
  { id: 'A2', row: 'A', column: 2, side: 'left', active: true },
  { id: 'A3', row: 'A', column: 3, side: 'left', active: true },
  { id: 'A4', row: 'A', column: 4, side: 'left', active: true },
  { id: 'B1', row: 'B', column: 1, side: 'left', active: true },
  { id: 'B2', row: 'B', column: 2, side: 'left', active: true },
  { id: 'B3', row: 'B', column: 3, side: 'left', active: true },
  { id: 'B4', row: 'B', column: 4, side: 'left', active: true },
  { id: 'C1', row: 'C', column: 1, side: 'left', active: true },
  { id: 'C2', row: 'C', column: 2, side: 'left', active: true },
  { id: 'C3', row: 'C', column: 3, side: 'left', active: true },
  { id: 'C4', row: 'C', column: 4, side: 'left', active: true },
  { id: 'D1', row: 'D', column: 1, side: 'right', active: true },
  { id: 'D2', row: 'D', column: 2, side: 'right', active: true },
  { id: 'D3', row: 'D', column: 3, side: 'right', active: true },
  { id: 'E1', row: 'E', column: 1, side: 'right', active: true },
  { id: 'E2', row: 'E', column: 2, side: 'right', active: true },
  { id: 'E3', row: 'E', column: 3, side: 'right', active: true },
  { id: 'F1', row: 'F', column: 1, side: 'right', active: true },
  { id: 'F2', row: 'F', column: 2, side: 'right', active: true },
  { id: 'F3', row: 'F', column: 3, side: 'right', active: true },
];

const ensureSeatCatalogInitialized = async () => {
  const settingsRef = db.collection('system_settings').doc('seat_catalog');
  const catalogRef = db.collection('seat_catalog');

  const [settingsSnap, catalogSnap] = await Promise.all([
    settingsRef.get(),
    catalogRef.get(),
  ]);

  const initialized = settingsSnap.exists && settingsSnap.data()?.initialized === true;
  if (!catalogSnap.empty || initialized) {
    return catalogSnap;
  }

  const batch = db.batch();
  const now = new Date();

  DEFAULT_SEAT_CATALOG.forEach((seat) => {
    batch.set(catalogRef.doc(seat.id), {
      row: seat.row,
      column: seat.column,
      side: seat.side,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  batch.set(settingsRef, {
    initialized: true,
    initializedAt: now,
  }, { merge: true });

  await batch.commit();
  return catalogRef.get();
};

const getSeatCatalog = async () => {
  const snapshot = await ensureSeatCatalogInitialized();
  if (snapshot.empty) return [];

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((seat) => seat.active !== false)
    .sort((a, b) => {
      const rowCmp = String(a.row || '').localeCompare(String(b.row || ''));
      if (rowCmp !== 0) return rowCmp;
      return Number(a.column || 0) - Number(b.column || 0);
    });
};

const getSeatBlocksForDate = async (date) => {
  if (!date) return [];
  const snapshot = await db.collection('seat_blocks')
    .where('date', '==', date)
    .where('active', '==', true)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const hasBlockedSeatConflict = async (seatIds, date, startDateTime, endDateTime) => {
  if (!Array.isArray(seatIds) || seatIds.length === 0) return null;

  for (const seatId of seatIds) {
    const blocksSnap = await db.collection('seat_blocks')
      .where('seatId', '==', seatId)
      .where('date', '==', date)
      .where('active', '==', true)
      .get();

    const conflict = blocksSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .find((block) => {
        const blockStart = toDate(block.startTime);
        const blockEnd = toDate(block.endTime);
        if (!blockStart || !blockEnd) return false;
        return isTimeConflict(blockStart, blockEnd, startDateTime, endDateTime);
      });

    if (conflict) {
      return { seatId, block: conflict };
    }
  }

  return null;
};

// SEAT BOOKING: create
exports.createBooking = async (req, res) => {
  try {
    const { date, startTime, endTime, seats, purpose, subject, name, gradeLevelId, gradeLevel, sectionId, section } = req.body;
    const normalizedSeats = normalizeSeats(seats);
    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);

    const seatCatalog = await getSeatCatalog();
    const allowedSeatIds = new Set(seatCatalog.map((seat) => seat.id));
    const invalidSeats = normalizedSeats.filter((seat) => !allowedSeatIds.has(seat));
    if (invalidSeats.length > 0) {
      return sendError(res, 400, 'Invalid seat selection', invalidSeats);
    }

    // Validate input
    const validation = await validateBookingData({ 
      studentId: req.user.uid, 
      date, 
      startTime: startDateTime, 
      endTime: endDateTime 
    });

    if (!validation.valid) {
      return sendError(res, 400, 'Validation failed', validation.errors);
    }

    if (isWeekendDateKey(date)) {
      return sendError(res, 400, 'Bookings are not allowed on Saturday or Sunday');
    }

    const existingUserBookings = await Booking.getByStudentId(req.user.uid);
    await applyAttendanceAutomation(existingUserBookings, { reminderUserId: req.user.uid });

    const dailyBookingsCount = existingUserBookings.filter((booking) => {
      if (!isActiveBookingStatus(booking?.status)) return false;
      return booking?.date === date;
    }).length;

    if (dailyBookingsCount >= MAX_BOOKINGS_PER_DAY_PER_USER) {
      return sendError(
        res,
        409,
        'Booking limit reached. You can only create up to 2 bookings per day.'
      );
    }

    const fixedScheduleConflict = await findFixedScheduleConflict(db, date, startDateTime, endDateTime);
    if (fixedScheduleConflict) {
      return sendError(res, 409, 'Time slot is occupied by fixed schedule', {
        conflictReason: 'Lab is occupied by a fixed weekly schedule',
        conflictDetails: {
          id: fixedScheduleConflict.id,
          label: fixedScheduleConflict.label,
          dayOfWeek: fixedScheduleConflict.dayOfWeek,
          startTime: fixedScheduleConflict.startTime,
          endTime: fixedScheduleConflict.endTime,
        },
      });
    }

    // --- Check for class conflicts ---
    const classesOnDate = await Class.getByDate(date);
    const classConflict = classesOnDate.find((cls) =>
      isTimeConflict(
        new Date(cls.startTime),
        new Date(cls.endTime),
        new Date(startTime),
        new Date(endTime)
      )
    );

    if (classConflict) {
      const allBookings = await Booking.getByDate(date);
      const combinedSlots = [
        ...classesOnDate.map(c => ({ startTime: c.startTime, endTime: c.endTime })),
        ...allBookings.map(b => ({ startTime: b.startTime, endTime: b.endTime }))
      ];
      const nextSlot = getNextAvailableSlot(combinedSlots);
      return sendError(res, 409, 'Class is scheduled during this time', {
        conflictReason: 'Teacher class scheduled during this time',
        conflictDetails: classConflict,
        suggestedSlot: {
          startTime: nextSlot.startTime.toISOString(),
          endTime: nextSlot.endTime.toISOString()
        }
      });
    }

    if (normalizedSeats.length === 0) {
      // --- Check for booking conflicts (non-seat booking) ---
      const hasConflict = await Booking.checkConflict(date, startTime, endTime);

      if (hasConflict) {
        const allBookings = await Booking.getByDate(date);
        const combinedSlots = allBookings.map(b => ({ startTime: b.startTime, endTime: b.endTime }));
        const nextSlot = getNextAvailableSlot(combinedSlots);

        return sendError(res, 409, 'Time slot is already booked', {
          conflictReason: 'Lab is already booked during this time',
          suggestedSlot: {
            startTime: nextSlot.startTime.toISOString(),
            endTime: nextSlot.endTime.toISOString()
          }
        });
      }
    } else {
      // --- Check for seat conflicts ---
      const existingBookings = await Booking.getByDate(date);
      const conflict = existingBookings.find((booking) => {
        const status = (booking.status || '').toLowerCase();
        if (!isActiveBookingStatus(status)) return false;

        const bookedStart = toDate(booking.startTime);
        const bookedEnd = toDate(booking.endTime);
        if (!bookedStart || !bookedEnd) return false;

        const timeOverlap = isTimeConflict(
          bookedStart,
          bookedEnd,
          startDateTime,
          endDateTime
        );
        if (!timeOverlap) return false;

        const bookedSeats = Array.isArray(booking.seats)
          ? booking.seats
          : booking.seat
            ? [booking.seat]
            : [];
        return bookedSeats.some((seat) => normalizedSeats.includes(seat));
      });

      if (conflict) {
        return sendError(res, 409, 'Seat is already booked for this time', {
          conflictReason: 'Selected seat is unavailable for the chosen time',
          conflictDetails: conflict,
        });
      }
    }

    const blockedSeatConflict = await hasBlockedSeatConflict(normalizedSeats, date, startDateTime, endDateTime);
    if (blockedSeatConflict) {
      return sendError(res, 409, 'Seat is blocked for this time', {
        seatId: blockedSeatConflict.seatId,
        block: blockedSeatConflict.block,
      });
    }

    const attendanceDeadlineAt = new Date(
      startDateTime.getTime() + ATTENDANCE_CONFIRMATION_WINDOW_MINUTES * 60 * 1000
    );

    // --- Create booking ---
    const bookingResult = await Booking.create({
      studentId: req.user.uid,
      studentName: name || req.user.name || 'Unknown',
      role: req.user.role || 'student',
      date,
      startTime: startDateTime,
      endTime: endDateTime,
      seats: normalizedSeats,
      purpose,
      subject,
      gradeLevelId: gradeLevelId || null,
      gradeLevel: gradeLevel || null,
      sectionId: sectionId || null,
      section: section || null,
      status: 'approved',
      attendanceDeadlineAt,
    });

    // --- Audit log ---
    await AuditLog.create({
      adminId: req.user.uid, // creator of booking
      action: 'BOOKING_CREATED',
      targetId: bookingResult.id,
      targetType: 'booking',
      details: { date, startTime, endTime, seats: normalizedSeats },
    });

    sendSuccess(res, 201, {
      id: bookingResult.id,
      date,
      startTime,
      endTime,
      seats: normalizedSeats,
      status: 'approved',
      attendanceDeadlineAt,
    }, 'Booking approved');

  } catch (error) {
    console.error('Booking creation error:', error);
    sendError(res, 500, 'Failed to create booking', error.message);
  }
};

// SEAT AVAILABILITY: by date
exports.getSeatBookingsByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return sendError(res, 400, 'Date is required');

    const bookings = await Booking.getByDate(date);
    await applyAttendanceAutomation(bookings);
    const classes = await Class.getByDate(date);
    const seatCatalog = await getSeatCatalog();
    const seatBlocks = await getSeatBlocksForDate(date);
    const fixedScheduleBlocks = await getFixedScheduleForDate(db, date);
    const payload = bookings.map((booking) => ({
      id: booking.id,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      seats: booking.seats || [],
      seat: booking.seat,
      status: booking.status,
    }));

    sendSuccess(res, 200, { bookings: payload, classes, seats: seatCatalog, seatBlocks, fixedScheduleBlocks }, 'Availability retrieved');
  } catch (error) {
    console.error('Get seat bookings error:', error);
    sendError(res, 500, 'Failed to retrieve bookings', error.message);
  }
};

// SEAT CATALOG: list (admin/student)
exports.getSeatCatalog = async (req, res) => {
  try {
    const seats = await getSeatCatalog();
    sendSuccess(res, 200, seats, 'Seat catalog retrieved');
  } catch (error) {
    console.error('Get seat catalog error:', error);
    sendError(res, 500, 'Failed to retrieve seat catalog', error.message);
  }
};

// SEAT CATALOG: upsert by id (admin)
exports.upsertSeatCatalogItem = async (req, res) => {
  try {
    const row = String(req.body.row || '').trim().toUpperCase();
    const column = Number(req.body.column);
    const side = String(req.body.side || '').trim().toLowerCase();
    const allowedSides = new Set(['left', 'right']);

    if (!/^[A-Z]$/.test(row)) return sendError(res, 400, 'Row must be one letter A-Z');
    if (!Number.isInteger(column) || column < 1 || column > 99) return sendError(res, 400, 'Column must be a number from 1 to 99');
    if (!allowedSides.has(side)) return sendError(res, 400, 'Side must be left or right');

    const seatId = `${row}${column}`;

    await db.collection('seat_catalog').doc(seatId).set({
      row,
      column,
      side,
      active: true,
      updatedAt: new Date(),
    }, { merge: true });

    sendSuccess(res, 200, { id: seatId, row, column, side, active: true }, 'Seat saved');
  } catch (error) {
    console.error('Upsert seat error:', error);
    sendError(res, 500, 'Failed to save seat', error.message);
  }
};

// SEAT CATALOG: delete (admin)
exports.deleteSeatCatalogItem = async (req, res) => {
  try {
    const seatId = String(req.params.id || '').trim().toUpperCase();
    if (!seatId) return sendError(res, 400, 'Seat ID is required');

    await db.collection('seat_catalog').doc(seatId).delete();
    sendSuccess(res, 200, { id: seatId }, 'Seat deleted');
  } catch (error) {
    console.error('Delete seat error:', error);
    sendError(res, 500, 'Failed to delete seat', error.message);
  }
};

// SEAT BLOCKS: list by date (admin)
exports.getSeatBlocks = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return sendError(res, 400, 'Date is required');
    const blocks = await getSeatBlocksForDate(date);
    sendSuccess(res, 200, blocks, 'Seat blocks retrieved');
  } catch (error) {
    console.error('Get seat blocks error:', error);
    sendError(res, 500, 'Failed to retrieve seat blocks', error.message);
  }
};

// SEAT BLOCKS: create (admin)
exports.createSeatBlock = async (req, res) => {
  try {
    const seatId = String(req.body.seatId || '').trim().toUpperCase();
    const date = String(req.body.date || '').trim();
    const startTime = new Date(req.body.startTime);
    const endTime = new Date(req.body.endTime);
    const reason = String(req.body.reason || '').trim();

    if (!seatId) return sendError(res, 400, 'Seat ID is required');
    if (!date) return sendError(res, 400, 'Date is required');
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      return sendError(res, 400, 'Invalid startTime or endTime');
    }
    if (startTime >= endTime) return sendError(res, 400, 'End time must be after start time');

    const seatCatalog = await getSeatCatalog();
    const exists = seatCatalog.some((seat) => seat.id === seatId);
    if (!exists) return sendError(res, 400, 'Seat not found in catalog');

    const existingBlocks = await getSeatBlocksForDate(date);
    const overlap = existingBlocks.find((block) => {
      if (block.seatId !== seatId) return false;
      const blockStart = toDate(block.startTime);
      const blockEnd = toDate(block.endTime);
      if (!blockStart || !blockEnd) return false;
      return isTimeConflict(blockStart, blockEnd, startTime, endTime);
    });

    if (overlap) {
      return sendError(res, 409, 'Seat already blocked during this period', overlap);
    }

    const created = await db.collection('seat_blocks').add({
      seatId,
      date,
      startTime,
      endTime,
      reason: reason || null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    sendSuccess(res, 201, { id: created.id, seatId, date, startTime, endTime, reason: reason || null, active: true }, 'Seat blocked');
  } catch (error) {
    console.error('Create seat block error:', error);
    sendError(res, 500, 'Failed to create seat block', error.message);
  }
};

// SEAT BLOCKS: delete (admin)
exports.deleteSeatBlock = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return sendError(res, 400, 'Seat block ID is required');

    await db.collection('seat_blocks').doc(id).delete();
    sendSuccess(res, 200, { id }, 'Seat block deleted');
  } catch (error) {
    console.error('Delete seat block error:', error);
    sendError(res, 500, 'Failed to delete seat block', error.message);
  }
};

// FIXED SCHEDULE: list (admin)
exports.getFixedSchedule = async (req, res) => {
  try {
    const entries = await getAllFixedScheduleEntries(db);
    sendSuccess(res, 200, entries, 'Fixed schedule retrieved');
  } catch (error) {
    console.error('Get fixed schedule error:', error);
    sendError(res, 500, 'Failed to retrieve fixed schedule', error.message);
  }
};

// FIXED SCHEDULE: list current teacher assignments
exports.getMyFixedSchedule = async (req, res) => {
  try {
    const entries = await getAllFixedScheduleEntries(db);
    const myUid = String(req.user?.uid || '').trim();
    const myName = String(req.user?.name || '').trim().toLowerCase();

    const mine = entries.filter((entry) => {
      if (!entry || entry.active === false) return false;
      const teacherId = String(entry.teacherId || '').trim();
      const teacherName = String(entry.teacherName || '').trim().toLowerCase();
      if (teacherId && myUid && teacherId === myUid) return true;
      if (teacherName && myName && teacherName === myName) return true;
      return false;
    });

    sendSuccess(res, 200, mine, 'Assigned fixed schedule retrieved');
  } catch (error) {
    console.error('Get my fixed schedule error:', error);
    sendError(res, 500, 'Failed to retrieve assigned fixed schedule', error.message);
  }
};

// FIXED SCHEDULE: upsert (admin)
exports.upsertFixedScheduleEntry = async (req, res) => {
  try {
    const id = String(req.body.id || '').trim();
    const dayOfWeek = normalizeDayOfWeek(req.body.dayOfWeek);
    const startTime = normalizeTime(req.body.startTime);
    const endTime = normalizeTime(req.body.endTime);
    const gradeLevelId = String(req.body.gradeLevelId || '').trim();
    const gradeLevel = String(req.body.gradeLevel || '').trim();
    const sectionId = String(req.body.sectionId || '').trim();
    const section = String(req.body.section || '').trim();
    const teacherId = String(req.body.teacherId || '').trim();
    const incomingTeacherName = String(req.body.teacherName || '').trim();
    const teacherProfile = teacherId ? await User.getById(teacherId) : null;
    const teacherName = incomingTeacherName || teacherProfile?.name || '';
    const rawLabel = String(req.body.label || '').trim();
    const label = rawLabel || [gradeLevel, section, teacherName].filter(Boolean).join(' - ');
    const active = req.body.active !== false;

    if (dayOfWeek == null) return sendError(res, 400, 'dayOfWeek must be from 0 to 6');
    if (!startTime) return sendError(res, 400, 'startTime must be HH:mm');
    if (!endTime) return sendError(res, 400, 'endTime must be HH:mm');
    if (!gradeLevelId || !sectionId) return sendError(res, 400, 'Grade level and section are required');
    if (!teacherId) return sendError(res, 400, 'Teacher is required');
    if (!teacherProfile || String(teacherProfile.role || '').toLowerCase() !== 'teacher') {
      return sendError(res, 400, 'Selected teacher is invalid');
    }
    if (!label) return sendError(res, 400, 'Label is required');

    const start = combineDateAndTime('2000-01-01', startTime);
    const end = combineDateAndTime('2000-01-01', endTime);
    if (!start || !end || start >= end) {
      return sendError(res, 400, 'End time must be after start time');
    }

    const existingEntries = await getAllFixedScheduleEntries(db);
    const overlap = existingEntries.find((entry) => {
      if (!entry || entry.active === false) return false;
      if (id && String(entry.id) === id) return false;
      if (Number(entry.dayOfWeek) !== dayOfWeek) return false;
      const entryStart = combineDateAndTime('2000-01-01', entry.startTime);
      const entryEnd = combineDateAndTime('2000-01-01', entry.endTime);
      if (!entryStart || !entryEnd) return false;
      return isTimeConflict(entryStart, entryEnd, start, end);
    });

    if (overlap) {
      return sendError(res, 409, 'A fixed schedule already exists for this day/time', overlap);
    }

    const payload = {
      dayOfWeek,
      startTime,
      endTime,
      gradeLevelId,
      gradeLevel: gradeLevel || null,
      sectionId,
      section: section || null,
      teacherId,
      teacherName,
      label,
      active,
      updatedAt: new Date(),
    };

    let targetId = id;
    if (targetId) {
      await db.collection('fixed_schedule_blocks').doc(targetId).set(payload, { merge: true });
    } else {
      payload.createdAt = new Date();
      const created = await db.collection('fixed_schedule_blocks').add(payload);
      targetId = created.id;
    }

    sendSuccess(res, 200, { id: targetId, ...payload }, 'Fixed schedule saved');
  } catch (error) {
    console.error('Upsert fixed schedule error:', error);
    sendError(res, 500, 'Failed to save fixed schedule', error.message);
  }
};

// FIXED SCHEDULE: delete (admin)
exports.deleteFixedScheduleEntry = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return sendError(res, 400, 'Fixed schedule ID is required');
    await db.collection('fixed_schedule_blocks').doc(id).delete();
    sendSuccess(res, 200, { id }, 'Fixed schedule deleted');
  } catch (error) {
    console.error('Delete fixed schedule error:', error);
    sendError(res, 500, 'Failed to delete fixed schedule', error.message);
  }
};

// SEAT BOOKING: get current user's bookings
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.getByStudentId(req.user.uid);
    await applyAttendanceAutomation(bookings, { reminderUserId: req.user.uid });
    sendSuccess(res, 200, bookings, 'Bookings retrieved');
  } catch (error) {
    console.error('Get bookings error:', error);
    sendError(res, 500, 'Failed to retrieve bookings', error.message);
  }
};

// SEAT BOOKING: get by id
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.getById(req.params.id);
    if (!booking) return sendError(res, 404, 'Booking not found');

    if (booking.studentId !== req.user.uid && req.user.role !== 'admin') {
      return sendError(res, 403, 'Unauthorized');
    }

    sendSuccess(res, 200, booking, 'Booking retrieved');
  } catch (error) {
    console.error('Get booking error:', error);
    sendError(res, 500, 'Failed to retrieve booking', error.message);
  }
};

// SEAT BOOKING: mark attendance (admin)
exports.markAttendance = async (req, res) => {
  try {
    const booking = await Booking.getById(req.params.id);
    if (!booking) return sendError(res, 404, 'Booking not found');

    if (String(req.user.role || '').toLowerCase() !== 'admin') {
      return sendError(res, 403, 'Only admins can mark attendance');
    }

    const rawStatus = String(req.body.status || '').trim().toLowerCase();
    const nextStatus = rawStatus === 'present'
      ? 'attended'
      : (rawStatus === 'missed' || rawStatus === 'absent')
        ? 'missed'
        : '';

    if (!nextStatus) {
      return sendError(res, 400, 'Status must be present or missed');
    }

    const patch = { status: nextStatus };
    if (nextStatus === 'attended') {
      patch.attendanceConfirmedAt = new Date();
    }
    if (nextStatus === 'missed') {
      patch.attendanceNoShowAt = new Date();
      if (!booking.attendanceNoShowNotifiedAt) {
        patch.attendanceNoShowNotifiedAt = new Date();
      }
    }

    await Booking.update(req.params.id, patch);

    await createAttendanceNotification(booking, {
      title: nextStatus === 'attended' ? 'Attendance Confirmed' : 'Attendance Marked Missed',
      message: nextStatus === 'attended'
        ? 'Your attendance was confirmed by admin.'
        : 'Your attendance was marked missed by admin.',
      severity: nextStatus === 'attended' ? 'info' : 'warning',
      type: 'attendance',
    });

    sendSuccess(res, 200, { id: req.params.id, status: nextStatus }, 'Attendance updated');
  } catch (error) {
    console.error('Mark attendance error:', error);
    sendError(res, 500, 'Failed to mark attendance', error.message);
  }
};

// SEAT BOOKING: self confirm attendance (student/teacher)
exports.confirmAttendance = async (req, res) => {
  try {
    const booking = await Booking.getById(req.params.id);
    if (!booking) return sendError(res, 404, 'Booking not found');

    const isOwner = String(booking.studentId || '').trim() === String(req.user.uid || '').trim();
    const isAdmin = String(req.user.role || '').toLowerCase() === 'admin';
    if (!isOwner && !isAdmin) return sendError(res, 403, 'Unauthorized');

    const status = String(booking.status || '').toLowerCase();
    if (['cancelled', 'rejected', 'missed', 'absent'].includes(status)) {
      return sendError(res, 409, `Cannot confirm attendance for status: ${status}`);
    }
    if (status === 'attended') {
      return sendSuccess(res, 200, { id: booking.id, status: 'attended' }, 'Attendance already confirmed');
    }

    const start = toDate(booking.startTime);
    const deadline = getAttendanceDeadline(booking);
    if (!start || !deadline) {
      return sendError(res, 400, 'Invalid booking time');
    }

    const now = new Date();
    if (now < start) {
      return sendError(
        res,
        409,
        `Attendance confirmation starts at ${formatClock(start)}.`
      );
    }

    if (now > deadline) {
      const noShowPatch = {
        status: 'missed',
        attendanceNoShowAt: now,
      };
      if (!booking.attendanceNoShowNotifiedAt) {
        noShowPatch.attendanceNoShowNotifiedAt = now;
      }
      await Booking.update(booking.id, noShowPatch);
      if (!booking.attendanceNoShowNotifiedAt) {
        await createAttendanceNotification(booking, {
          title: 'Marked Missed',
          message: `No attendance confirmation was received within ${ATTENDANCE_CONFIRMATION_WINDOW_MINUTES} minutes from start time.`,
          severity: 'warning',
          type: 'attendance',
        });
      }
      return sendError(res, 409, 'Confirmation window expired. Booking marked missed.');
    }

    await Booking.update(booking.id, {
      status: 'attended',
      attendanceConfirmedAt: now,
      attendanceDeadlineAt: deadline,
    });

    await createAttendanceNotification(booking, {
      title: 'Attendance Confirmed',
      message: 'Your attendance has been confirmed successfully.',
      severity: 'info',
      type: 'attendance',
    });

    sendSuccess(res, 200, { id: booking.id, status: 'attended' }, 'Attendance confirmed');
  } catch (error) {
    console.error('Confirm attendance error:', error);
    sendError(res, 500, 'Failed to confirm attendance', error.message);
  }
};

// SEAT BOOKING: cancel
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.getById(req.params.id);
    if (!booking) return sendError(res, 404, 'Booking not found');

    if (booking.studentId !== req.user.uid && req.user.role !== 'admin') {
      return sendError(res, 403, 'Unauthorized');
    }

    await Booking.update(req.params.id, { status: 'cancelled' });

    sendSuccess(res, 200, {}, 'Booking cancelled');
  } catch (error) {
    console.error('Cancel booking error:', error);
    sendError(res, 500, 'Failed to cancel booking', error.message);
  }
};

// SEAT BOOKING: admin list
exports.getAllBookings = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return sendError(res, 403, 'Only admins can view all bookings');
    }

    const { date } = req.query;
    let bookings;

    if (date) {
      bookings = await Booking.getByDate(date);
      await applyAttendanceAutomation(bookings);
    } else {
      const snapshot = await require('../config/database').db.collection('seats').get();
      bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      await applyAttendanceAutomation(bookings);
    }

    sendSuccess(res, 200, bookings, 'Bookings retrieved');
  } catch (error) {
    console.error('Get all bookings error:', error);
    sendError(res, 500, 'Failed to retrieve bookings', error.message);
  }
};