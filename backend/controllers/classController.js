const Class = require('../models/Class');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { db } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { findFixedScheduleConflict } = require('../utils/fixedSchedule');

// CLASS SCHEDULE: create
exports.createClass = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return sendError(res, 403, 'Only admins can create classes');
    }

    const { className, startTime, endTime, date, capacity } = req.body;

    if (!className || !startTime || !endTime || !date) {
      return sendError(res, 400, 'Missing required fields');
    }

    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);
    if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(endDateTime.getTime())) {
      return sendError(res, 400, 'Invalid startTime or endTime');
    }
    if (startDateTime >= endDateTime) {
      return sendError(res, 400, 'End time must be after start time');
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

    const classResult = await Class.create({
      teacherId: req.user.uid,
      className,
      startTime: startDateTime,
      endTime: endDateTime,
      date,
      capacity: capacity || 30,
    });

    // Log class creation
    await AuditLog.create({
      adminId: req.user.uid, // the teacher/admin creating the class
      action: 'CLASS_CREATED',
      targetId: classResult.id,
      targetType: 'class',
      details: { className, date, startTime, endTime },
    });

    sendSuccess(res, 201, classResult, 'Class created successfully');
  } catch (error) {
    console.error('Class creation error:', error);
    sendError(res, 500, 'Failed to create class', error.message);
  }
};

// CLASS SCHEDULE: get teacher classes
exports.getMyClasses = async (req, res) => {
  try {
    const classes = await Class.getByTeacherId(req.user.uid);
    sendSuccess(res, 200, classes, 'Classes retrieved');
  } catch (error) {
    console.error('Get classes error:', error);
    sendError(res, 500, 'Failed to retrieve classes', error.message);
  }
};

// CLASS SCHEDULE: get by id
exports.getClassById = async (req, res) => {
  try {
    const cls = await Class.getById(req.params.id);
    if (!cls) return sendError(res, 404, 'Class not found');

    sendSuccess(res, 200, cls, 'Class retrieved');
  } catch (error) {
    console.error('Get class error:', error);
    sendError(res, 500, 'Failed to retrieve class', error.message);
  }
};

// CLASS SCHEDULE: update
exports.updateClass = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return sendError(res, 403, 'Only admins can update classes');
    }

    const cls = await Class.getById(req.params.id);
    if (!cls) return sendError(res, 404, 'Class not found');

    // Ensure startTime and endTime are Date objects if provided
    const updateData = { ...req.body };
    if (updateData.startTime) updateData.startTime = new Date(updateData.startTime);
    if (updateData.endTime) updateData.endTime = new Date(updateData.endTime);

    await Class.update(req.params.id, updateData);

    sendSuccess(res, 200, {}, 'Class updated successfully');
  } catch (error) {
    console.error('Update class error:', error);
    sendError(res, 500, 'Failed to update class', error.message);
  }
};

// CLASS SCHEDULE: delete
exports.deleteClass = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return sendError(res, 403, 'Only admins can delete classes');
    }

    const cls = await Class.getById(req.params.id);
    if (!cls) return sendError(res, 404, 'Class not found');

    await Class.delete(req.params.id);

    sendSuccess(res, 200, {}, 'Class deleted successfully');
  } catch (error) {
    console.error('Delete class error:', error);
    sendError(res, 500, 'Failed to delete class', error.message);
  }
};

// CLASS SCHEDULE: get by date
exports.getClassesByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return sendError(res, 400, 'Date is required');

    const classes = await Class.getByDate(date);
    const teacherIds = [...new Set(classes.map((cls) => cls.teacherId).filter(Boolean))];
    const teacherProfiles = await Promise.all(
      teacherIds.map(async (teacherId) => {
        try {
          return await User.getById(teacherId);
        } catch (error) {
          return null;
        }
      })
    );
    const teacherNameMap = teacherIds.reduce((acc, teacherId, index) => {
      const profile = teacherProfiles[index];
      if (profile?.name) {
        acc[teacherId] = profile.name;
      }
      return acc;
    }, {});

    const classesWithTeacher = classes.map((cls) => ({
      ...cls,
      teacherName: teacherNameMap[cls.teacherId] || cls.teacherName || null,
    }));

    sendSuccess(res, 200, classesWithTeacher, 'Classes retrieved');
  } catch (error) {
    console.error('Get classes by date error:', error);
    sendError(res, 500, 'Failed to retrieve classes', error.message);
  }
};
