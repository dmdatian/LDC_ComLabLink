const { isTimeConflict } = require('./timeHelper');

const COLLECTION = 'fixed_schedule_blocks';

const DEFAULT_FIXED_SCHEDULE = [
  { dayOfWeek: 3, startTime: '07:00', endTime: '08:00', label: 'GRADE 7-ST. PETER' },
  { dayOfWeek: 4, startTime: '07:00', endTime: '08:00', label: 'GRADE 9-ST. JOSEPH' },
  { dayOfWeek: 1, startTime: '08:00', endTime: '09:00', label: 'GRADE 8-ST. CHARLES' },
  { dayOfWeek: 3, startTime: '08:00', endTime: '09:00', label: 'GRADE 9-ST. ALBERT' },
  { dayOfWeek: 4, startTime: '08:00', endTime: '09:00', label: 'GRADE 8-ST. AUGUSTINE' },
  { dayOfWeek: 5, startTime: '08:00', endTime: '09:00', label: 'GRADE 8-ST. FRANCIS' },
  { dayOfWeek: 2, startTime: '11:15', endTime: '12:15', label: 'GRADE 10-ST. POLYCARP' },
  { dayOfWeek: 3, startTime: '11:15', endTime: '12:15', label: 'GRADE 10-ST. JOHN PAUL II' },
  { dayOfWeek: 5, startTime: '11:15', endTime: '12:15', label: 'GRADE 10-ST. JANUARIUS' },
  { dayOfWeek: 3, startTime: '12:45', endTime: '13:45', label: 'GRADE 7-ST. ALPHONSUS' },
  { dayOfWeek: 5, startTime: '12:45', endTime: '13:45', label: 'GRADE 7-ST. JOHN THE BAPTISE' },
  { dayOfWeek: 2, startTime: '13:45', endTime: '14:45', label: 'GRADE 9-ST. LORENZO' },
  { dayOfWeek: 2, startTime: '15:00', endTime: '16:00', label: 'GRADE 7-ST. ANTHONY' },
];

const DAY_NAME_TO_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const normalizeTime = (value) => {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const normalizeDayOfWeek = (value) => {
  if (value === 0 || value === '0') return 0;

  if (value) {
    const num = Number(value);
    if (Number.isInteger(num) && num >= 0 && num <= 6) {
      return num;
    }
  }

  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(DAY_NAME_TO_INDEX, key)) {
    return DAY_NAME_TO_INDEX[key];
  }
  return null;
};

const getDayOfWeekFromDate = (date) => {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getDay();
};

const combineDateAndTime = (date, time) => {
  const normalizedTime = normalizeTime(time);
  if (!normalizedTime) return null;
  const parsed = new Date(`${date}T${normalizedTime}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const sortEntries = (entries) => entries.sort((a, b) => {
  const dayCmp = Number(a.dayOfWeek || 0) - Number(b.dayOfWeek || 0);
  if (dayCmp !== 0) return dayCmp;
  const startCmp = String(a.startTime || '').localeCompare(String(b.startTime || ''));
  if (startCmp !== 0) return startCmp;
  return String(a.endTime || '').localeCompare(String(b.endTime || ''));
});

const ensureFixedScheduleInitialized = async (db) => {
  const scheduleRef = db.collection(COLLECTION);
  const snapshot = await scheduleRef.get();
  if (!snapshot.empty) return;

  const now = new Date();
  const batch = db.batch();

  DEFAULT_FIXED_SCHEDULE.forEach((entry) => {
    const docRef = scheduleRef.doc();
    batch.set(docRef, {
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      label: entry.label,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  await batch.commit();
};

const getAllFixedScheduleEntries = async (db) => {
  await ensureFixedScheduleInitialized(db);
  const snapshot = await db.collection(COLLECTION).get();
  const entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return sortEntries(entries);
};

const getFixedScheduleForDate = async (db, date) => {
  const dayOfWeek = getDayOfWeekFromDate(date);
  if (dayOfWeek == null) return [];

  const entries = await getAllFixedScheduleEntries(db);
  const dayEntries = entries.filter((entry) => {
    const active = entry.active !== false;
    return active && Number(entry.dayOfWeek) === dayOfWeek;
  });

  return dayEntries
    .map((entry) => {
      const startDateTime = combineDateAndTime(date, entry.startTime);
      const endDateTime = combineDateAndTime(date, entry.endTime);
      if (!startDateTime || !endDateTime || startDateTime >= endDateTime) return null;
      return {
        ...entry,
        date,
        startDateTime,
        endDateTime,
      };
    })
    .filter(Boolean);
};

const findFixedScheduleConflict = async (db, date, startDateTime, endDateTime, excludeId = null) => {
  const dayEntries = await getFixedScheduleForDate(db, date);
  return dayEntries.find((entry) => {
    if (excludeId && String(entry.id) === String(excludeId)) return false;
    return isTimeConflict(entry.startDateTime, entry.endDateTime, startDateTime, endDateTime);
  }) || null;
};

module.exports = {
  normalizeTime,
  normalizeDayOfWeek,
  combineDateAndTime,
  getAllFixedScheduleEntries,
  getFixedScheduleForDate,
  findFixedScheduleConflict,
};
