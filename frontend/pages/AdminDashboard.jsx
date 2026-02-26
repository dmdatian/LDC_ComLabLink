import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import { useNavigate } from 'react-router-dom';
import { seatsAPI, reportAPI, authAPI, feedbackAPI, classAPI, attendanceAPI } from '../utils/api';
import { logoutUser } from '../utils/auth';
import { db } from '../config/firebase';
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import logoName from '../assets/logo_name.png';
import backgroundLdc from '../assets/background_ldc.jpg';

const FIXED_SCHEDULE_TIME_SLOTS = [
  { startTime: '07:00', endTime: '08:00', label: '7:00am-8:00am' },
  { startTime: '08:00', endTime: '09:00', label: '8:00am-9:00am' },
  { startTime: '09:00', endTime: '10:00', label: '9:00am-10:00am' },
  { startTime: '10:00', endTime: '10:15', label: '10:00am-10:15am' },
  { startTime: '10:15', endTime: '11:15', label: '10:15am-11:15am' },
  { startTime: '11:15', endTime: '12:15', label: '11:15am-12:15pm' },
  { startTime: '12:15', endTime: '12:45', label: '12:15pm-12:45pm' },
  { startTime: '12:45', endTime: '13:45', label: '12:45pm-1:45pm' },
  { startTime: '13:45', endTime: '14:45', label: '1:45pm-2:45pm' },
  { startTime: '14:45', endTime: '15:00', label: '2:45pm-3:00pm' },
  { startTime: '15:00', endTime: '16:00', label: '3:00pm-4:00pm' },
];

const FIXED_SCHEDULE_DAYS = [
  { dayOfWeek: 1, label: 'Monday' },
  { dayOfWeek: 2, label: 'Tuesday' },
  { dayOfWeek: 3, label: 'Wednesday' },
  { dayOfWeek: 4, label: 'Thursday' },
  { dayOfWeek: 5, label: 'Friday' },
];

export default function AdminDashboard({ user, userName }) {
  // STATE: bookings/reports/users/feedback
  const navigate = useNavigate();
  const displayName = userName || user?.displayName || user?.name || 'Admin';
  const toLocalDateKey = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const computeWeeklyEndDate = (startDate) => {
    if (!startDate) return '';
    const start = new Date(`${startDate}T00:00:00Z`);
    if (Number.isNaN(start.getTime())) return '';
    start.setUTCDate(start.getUTCDate() + 7);
    return start.toISOString().split('T')[0];
  };
  const defaultWeeklyStartDate = toLocalDateKey(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const [bookings, setBookings] = useState([]);
  const [report, setReport] = useState(null);
  const [selectedDate, setSelectedDate] = useState(toLocalDateKey());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState('');
  const [accountUsers, setAccountUsers] = useState([]);
  const [deletedAccountUsers, setDeletedAccountUsers] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState('');
  const [accountTab, setAccountTab] = useState('active');
  const [activeSection, setActiveSection] = useState('home');
  const [reportTab, setReportTab] = useState('weekly');
  const [weeklyRange, setWeeklyRange] = useState({
    startDate: defaultWeeklyStartDate,
    endDate: computeWeeklyEndDate(defaultWeeklyStartDate),
  });
  const [monthlyConfig, setMonthlyConfig] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [yearlyYear, setYearlyYear] = useState(new Date().getFullYear());
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [yearlyReport, setYearlyReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailBookings, setDetailBookings] = useState([]);
  const [detailClasses, setDetailClasses] = useState([]);
  const [detailFeedback, setDetailFeedback] = useState([]);
  const [reportInsights, setReportInsights] = useState({
    mostUsedSeat: { label: '-', count: 0 },
    topGradeLevel: { label: '-', count: 0 },
    topSection: { label: '-', count: 0 },
  });
  const [showFeedbackComments, setShowFeedbackComments] = useState(false);
  const [feedbackEntries, setFeedbackEntries] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionsError, setSectionsError] = useState('');
  const [sectionsMessage, setSectionsMessage] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionGradeId, setNewSectionGradeId] = useState('');
  const [editingSectionId, setEditingSectionId] = useState('');
  const [editSectionName, setEditSectionName] = useState('');
  const [editSectionGradeId, setEditSectionGradeId] = useState('');
  const [seatCatalogAdmin, setSeatCatalogAdmin] = useState([]);
  const [seatBlocksAdmin, setSeatBlocksAdmin] = useState([]);
  const [fixedScheduleAdmin, setFixedScheduleAdmin] = useState([]);
  const [seatAdminLoading, setSeatAdminLoading] = useState(false);
  const [seatAdminError, setSeatAdminError] = useState('');
  const [seatAdminMessage, setSeatAdminMessage] = useState('');
  const [insertSeatRow, setInsertSeatRow] = useState('');
  const [insertSeatColumn, setInsertSeatColumn] = useState('');
  const [blockDate, setBlockDate] = useState(toLocalDateKey());
  const [newBlockSeatId, setNewBlockSeatId] = useState('');
  const [newBlockStartTime, setNewBlockStartTime] = useState('');
  const [newBlockEndTime, setNewBlockEndTime] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');
  const [editingFixedScheduleId, setEditingFixedScheduleId] = useState('');
  const [selectedFixedCell, setSelectedFixedCell] = useState({
    dayOfWeek: 1,
    startTime: '07:00',
    endTime: '08:00',
  });
  const [fixedScheduleGradeId, setFixedScheduleGradeId] = useState('');
  const [fixedScheduleSectionId, setFixedScheduleSectionId] = useState('');
  const [fixedScheduleTeacherId, setFixedScheduleTeacherId] = useState('');
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceUpdatingId, setAttendanceUpdatingId] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchDailyData();
    fetchAttendance(selectedDate);
    fetchPendingUsers();
    refreshFeedback();
    fetchSectionData();
  }, []);

  useEffect(() => {
    if (activeSection === 'seats' || activeSection === 'fixed-schedule') {
      fetchSeatAdminData(blockDate);
    }
  }, [activeSection, blockDate]);

  useEffect(() => {
    if (activeSection === 'accounts') {
      fetchAccountsData();
    }
  }, [activeSection]);

  // REPORTS/BOOKINGS: daily data
  const fetchDailyData = async () => {
    setLoading(true);
    setError('');
    try {
      const bookingsResponse = await seatsAPI.getAllSeats(selectedDate);
      setBookings(bookingsResponse.data.data || []);

      const reportResponse = await reportAPI.getDailyReport(selectedDate);
      setReport(reportResponse.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async (date) => {
    setAttendanceLoading(true);
    setAttendanceError('');
    try {
      const response = await attendanceAPI.getByDate(date);
      const rows = Array.isArray(response.data.data) ? response.data.data : [];
      setAttendanceRows(
        rows.filter((row) => String(row?.status || '').trim().toLowerCase() !== 'cancelled')
      );
    } catch (err) {
      setAttendanceError(err.response?.data?.message || 'Failed to load attendance');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleMarkAttendance = async (bookingId, status) => {
    try {
      const targetId = String(bookingId);
      const nextStatus = status === 'present' ? 'attended' : 'missed';
      setAttendanceUpdatingId(targetId);
      setAttendanceRows((rows) =>
        rows.map((row) => (String(row.bookingId || row.id) === targetId ? { ...row, status: nextStatus } : row))
      );
      await attendanceAPI.mark(bookingId, status);
      await fetchAttendance(selectedDate);
      await fetchDailyData();
    } catch (err) {
      setAttendanceError(err.response?.data?.message || 'Failed to mark attendance');
    } finally {
      setAttendanceUpdatingId('');
    }
  };

  // USERS: pending approvals
  const fetchPendingUsers = async () => {
    setPendingLoading(true);
    setPendingError('');
    try {
      const response = await authAPI.getPendingUsers();
      setPendingUsers(response.data.data || []);
    } catch (err) {
      setPendingError(err.response?.data?.message || 'Failed to load pending users');
    } finally {
      setPendingLoading(false);
    }
  };

  const fetchAccountsData = async () => {
    setAccountsLoading(true);
    setAccountsError('');
    try {
      const [activeResponse, deletedResponse] = await Promise.all([
        authAPI.getAllUsers(),
        authAPI.getDeletedUsers(),
      ]);

      const activeUsers = (activeResponse.data?.data || [])
        .filter((item) => String(item.role || '').toLowerCase() !== 'admin')
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      const removedUsers = (deletedResponse.data?.data || [])
        .sort((a, b) => String(b.deletedAt || '').localeCompare(String(a.deletedAt || '')));

      setAccountUsers(activeUsers);
      setDeletedAccountUsers(removedUsers);
    } catch (err) {
      setAccountsError(err.response?.data?.message || 'Failed to load accounts');
    } finally {
      setAccountsLoading(false);
    }
  };

  // FEEDBACK: refresh
  const refreshFeedback = () => {
    feedbackAPI.getFeedback(200)
      .then((response) => setFeedbackEntries(response.data.data || []))
      .catch(() => setFeedbackEntries([]));
  };

  const buildSectionDocId = (gradeLevelId, name) => {
    const slug = String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `${gradeLevelId}_${slug}`;
  };

  const fetchSectionData = async () => {
    setSectionsLoading(true);
    setSectionsError('');
    try {
      const [gradeSnap, sectionSnap, userSnap] = await Promise.all([
        getDocs(collection(db, 'gradeLevels')),
        getDocs(collection(db, 'sections')),
        getDocs(collection(db, 'users')),
      ]);

      const grades = gradeSnap.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => item.active !== false)
        .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));

      const sectionRows = sectionSnap.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => item.active !== false)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

      const teacherRows = userSnap.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => String(item.role || '').toLowerCase() === 'teacher')
        .filter((item) => String(item.status || 'approved').toLowerCase() === 'approved')
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

      setGradeLevels(grades);
      setSections(sectionRows);
      setTeachers(teacherRows);
      if (!newSectionGradeId && grades.length > 0) {
        setNewSectionGradeId(grades[0].id);
      }
    } catch (err) {
      setSectionsError('Failed to load grade levels/sections/teachers');
    } finally {
      setSectionsLoading(false);
    }
  };

  const handleAddSection = async () => {
    const trimmedName = newSectionName.trim();
    if (!newSectionGradeId || !trimmedName) {
      setSectionsError('Grade level and section name are required.');
      return;
    }

    setSectionsError('');
    setSectionsMessage('');
    try {
      const sectionId = buildSectionDocId(newSectionGradeId, trimmedName);
      await setDoc(doc(db, 'sections', sectionId), {
        name: trimmedName,
        gradeLevelId: newSectionGradeId,
        active: true,
      }, { merge: true });

      setSectionsMessage('Section saved.');
      setNewSectionName('');
      await fetchSectionData();
    } catch (err) {
      setSectionsError('Failed to add section.');
    }
  };

  const startEditingSection = (item) => {
    setEditingSectionId(item.id);
    setEditSectionName(item.name || '');
    setEditSectionGradeId(item.gradeLevelId || '');
    setSectionsMessage('');
    setSectionsError('');
  };

  const cancelEditingSection = () => {
    setEditingSectionId('');
    setEditSectionName('');
    setEditSectionGradeId('');
  };

  const handleSaveSectionEdit = async () => {
    const trimmedName = editSectionName.trim();
    if (!editingSectionId || !editSectionGradeId || !trimmedName) {
      setSectionsError('Grade level and section name are required.');
      return;
    }

    const current = sections.find((item) => item.id === editingSectionId);
    if (!current) {
      setSectionsError('Section not found.');
      return;
    }

    setSectionsError('');
    setSectionsMessage('');
    try {
      const nextId = buildSectionDocId(editSectionGradeId, trimmedName);
      const nextPayload = {
        name: trimmedName,
        gradeLevelId: editSectionGradeId,
        active: current.active !== false,
      };

      if (nextId === editingSectionId) {
        await updateDoc(doc(db, 'sections', editingSectionId), nextPayload);
      } else {
        await setDoc(doc(db, 'sections', nextId), nextPayload, { merge: true });
        await deleteDoc(doc(db, 'sections', editingSectionId));
      }

      setSectionsMessage('Section updated.');
      cancelEditingSection();
      await fetchSectionData();
    } catch (err) {
      setSectionsError('Failed to update section.');
    }
  };

  const handleDeleteSection = async (sectionId) => {
    if (!window.confirm('Delete this section?')) return;
    setSectionsError('');
    setSectionsMessage('');
    try {
      await deleteDoc(doc(db, 'sections', sectionId));
      setSectionsMessage('Section deleted.');
      if (editingSectionId === sectionId) {
        cancelEditingSection();
      }
      await fetchSectionData();
    } catch (err) {
      setSectionsError('Failed to delete section.');
    }
  };

  const sectionsByGrade = useMemo(() => {
    return gradeLevels.map((grade) => ({
      ...grade,
      sections: sections
        .filter((item) => item.gradeLevelId === grade.id)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    }));
  }, [gradeLevels, sections]);

  const fetchSeatAdminData = async (targetDate = blockDate) => {
    setSeatAdminLoading(true);
    setSeatAdminError('');
    try {
      const [catalogResponse, blocksResponse, fixedScheduleResponse] = await Promise.all([
        seatsAPI.getSeatCatalog(),
        seatsAPI.getSeatBlocks(targetDate),
        seatsAPI.getFixedSchedule(),
      ]);
      const catalog = catalogResponse.data.data || [];
      const blocks = blocksResponse.data.data || [];
      const fixedSchedule = fixedScheduleResponse.data.data || [];
      setSeatCatalogAdmin(catalog);
      setSeatBlocksAdmin(blocks);
      setFixedScheduleAdmin(fixedSchedule);
      if (!newBlockSeatId && catalog.length > 0) {
        setNewBlockSeatId(catalog[0].id);
      }
    } catch (err) {
      setSeatAdminError(err.response?.data?.message || 'Failed to load seat controls');
    } finally {
      setSeatAdminLoading(false);
    }
  };

  const upsertSeatByPosition = async (row, column, side, customSuccessMessage = '') => {
    const normalizedRow = String(row || '').trim().toUpperCase();
    const normalizedColumn = Number(column);
    const normalizedSide = String(side || '').trim().toLowerCase();

    if (!/^[A-Z]$/.test(normalizedRow)) {
      setSeatAdminError('Seat row must be a single capital letter A-Z.');
      return;
    }
    if (!Number.isInteger(normalizedColumn) || normalizedColumn < 1 || normalizedColumn > 99) {
      setSeatAdminError('Seat column must be from 1 to 99.');
      return;
    }
    if (!['left', 'right'].includes(normalizedSide)) {
      setSeatAdminError('Seat side must be left or right.');
      return;
    }

    setSeatAdminError('');
    setSeatAdminMessage('');
    try {
      await seatsAPI.upsertSeatCatalogItem(normalizedRow, normalizedColumn, normalizedSide);
      setSeatAdminMessage(customSuccessMessage || `Seat ${normalizedRow}${normalizedColumn} saved.`);
      await fetchSeatAdminData(blockDate);
    } catch (err) {
      setSeatAdminError(err.response?.data?.message || 'Failed to save seat');
    }
  };

  const handleDeleteSeatCatalogItem = async (seatId) => {
    if (!window.confirm(`Delete seat ${seatId}?`)) return;

    const targetSeat = seatCatalogAdmin.find((seat) => String(seat.id || '').toUpperCase() === String(seatId || '').toUpperCase());
    const targetSide = (targetSeat?.side || '').toLowerCase();
    const sideForReindex = targetSide === 'right' ? 'right' : 'left';

    setSeatAdminError('');
    setSeatAdminMessage('');
    try {
      await seatsAPI.deleteSeatCatalogItem(seatId);

      // Auto-adjust row letters so there are no gaps after deletion.
      // Example: if row G is removed and H exists, H becomes G.
      const afterDeleteCatalogResponse = await seatsAPI.getSeatCatalog();
      const afterDeleteCatalog = afterDeleteCatalogResponse.data.data || [];

      const sideSeats = afterDeleteCatalog
        .filter((seat) => String(seat.side || '').toLowerCase() === sideForReindex)
        .map((seat) => ({
          id: String(seat.id || '').toUpperCase(),
          row: String(seat.row || '').toUpperCase(),
          column: Number(seat.column || 0),
        }))
        .filter((seat) => /^[A-Z]$/.test(seat.row) && Number.isInteger(seat.column) && seat.column > 0)
        .sort((a, b) => a.row.localeCompare(b.row) || a.column - b.column);

      const otherSideRows = new Set(
        afterDeleteCatalog
          .filter((seat) => String(seat.side || '').toLowerCase() !== sideForReindex)
          .map((seat) => String(seat.row || '').toUpperCase())
          .filter((row) => /^[A-Z]$/.test(row))
      );

      const uniqueRows = [...new Set(sideSeats.map((seat) => seat.row))].sort((a, b) => a.localeCompare(b));
      const baseCode = sideForReindex === 'right' ? 'D'.charCodeAt(0) : 'A'.charCodeAt(0);
      const rowMap = new Map();
      let nextCode = baseCode;

      uniqueRows.forEach((oldRow) => {
        while (nextCode <= 90 && otherSideRows.has(String.fromCharCode(nextCode))) {
          nextCode += 1;
        }
        if (nextCode <= 90) {
          rowMap.set(oldRow, String.fromCharCode(nextCode));
          nextCode += 1;
        }
      });

      const needsRemap = uniqueRows.some((row) => rowMap.get(row) && rowMap.get(row) !== row);

      if (needsRemap) {
        for (const oldRow of uniqueRows) {
          const newRow = rowMap.get(oldRow);
          if (!newRow || newRow === oldRow) continue;

          const seatsInRow = sideSeats.filter((seat) => seat.row === oldRow);
          for (const seat of seatsInRow) {
            await seatsAPI.upsertSeatCatalogItem(newRow, seat.column, sideForReindex);
            await seatsAPI.deleteSeatCatalogItem(`${oldRow}${seat.column}`);
          }
        }
      }

      setSeatAdminMessage(needsRemap ? 'Seat deleted and rows auto-adjusted.' : 'Seat deleted.');
      await fetchSeatAdminData(blockDate);
    } catch (err) {
      setSeatAdminError(err.response?.data?.message || 'Failed to delete seat');
    }
  };

  const handleCreateSeatBlock = async () => {
    if (!newBlockSeatId || !blockDate || !newBlockStartTime || !newBlockEndTime) {
      setSeatAdminError('Seat, date, start time, and end time are required.');
      return;
    }

    const startIso = `${blockDate}T${newBlockStartTime}:00`;
    const endIso = `${blockDate}T${newBlockEndTime}:00`;
    if (new Date(startIso) >= new Date(endIso)) {
      setSeatAdminError('End time must be after start time.');
      return;
    }

    setSeatAdminError('');
    setSeatAdminMessage('');
    try {
      await seatsAPI.createSeatBlock({
        seatId: newBlockSeatId,
        date: blockDate,
        startTime: startIso,
        endTime: endIso,
        reason: newBlockReason.trim() || null,
      });
      setSeatAdminMessage('Seat block created.');
      setNewBlockStartTime('');
      setNewBlockEndTime('');
      setNewBlockReason('');
      await fetchSeatAdminData(blockDate);
    } catch (err) {
      setSeatAdminError(err.response?.data?.message || 'Failed to block seat');
    }
  };

  const handleDeleteSeatBlock = async (id) => {
    if (!window.confirm('Remove this seat block?')) return;
    setSeatAdminError('');
    setSeatAdminMessage('');
    try {
      await seatsAPI.deleteSeatBlock(id);
      setSeatAdminMessage('Seat block removed.');
      await fetchSeatAdminData(blockDate);
    } catch (err) {
      setSeatAdminError(err.response?.data?.message || 'Failed to remove seat block');
    }
  };

  const resetFixedScheduleForm = () => {
    setEditingFixedScheduleId('');
    setSelectedFixedCell({
      dayOfWeek: 1,
      startTime: '07:00',
      endTime: '08:00',
    });
    setFixedScheduleGradeId('');
    setFixedScheduleSectionId('');
    setFixedScheduleTeacherId('');
  };

  const handleSelectFixedScheduleCell = (dayOfWeek, startTime, endTime, entry = null) => {
    setSelectedFixedCell({ dayOfWeek, startTime, endTime });
    setEditingFixedScheduleId(entry?.id || '');
    setFixedScheduleGradeId(String(entry?.gradeLevelId || ''));
    setFixedScheduleSectionId(String(entry?.sectionId || ''));
    setFixedScheduleTeacherId(String(entry?.teacherId || ''));
    setSeatAdminError('');
    setSeatAdminMessage('');
  };

  const handleSaveFixedScheduleEntry = async () => {
    if (!selectedFixedCell?.dayOfWeek || !selectedFixedCell?.startTime || !selectedFixedCell?.endTime) {
      setSeatAdminError('Select a schedule cell first.');
      return;
    }

    if (!fixedScheduleGradeId || !fixedScheduleSectionId || !fixedScheduleTeacherId) {
      setSeatAdminError('Grade level, section, and teacher are required for fixed schedule.');
      return;
    }

    const selectedGrade = gradeLevels.find((grade) => grade.id === fixedScheduleGradeId);
    const selectedSection = sections.find((section) => section.id === fixedScheduleSectionId);
    const selectedTeacher = teachers.find((teacher) => teacher.id === fixedScheduleTeacherId);
    if (!selectedGrade || !selectedSection) {
      setSeatAdminError('Select a valid grade level and section.');
      return;
    }
    if (!selectedTeacher) {
      setSeatAdminError('Select a valid teacher.');
      return;
    }

    if (selectedSection.gradeLevelId !== selectedGrade.id) {
      setSeatAdminError('Selected section does not belong to the selected grade level.');
      return;
    }

    setSeatAdminError('');
    setSeatAdminMessage('');
    try {
      await seatsAPI.upsertFixedScheduleEntry({
        id: editingFixedScheduleId || undefined,
        dayOfWeek: Number(selectedFixedCell.dayOfWeek),
        startTime: selectedFixedCell.startTime,
        endTime: selectedFixedCell.endTime,
        gradeLevelId: selectedGrade.id,
        gradeLevel: selectedGrade.name || selectedGrade.id,
        sectionId: selectedSection.id,
        section: selectedSection.name || selectedSection.id,
        teacherId: selectedTeacher.id,
        teacherName: selectedTeacher.name || selectedTeacher.email || selectedTeacher.id,
        label: `${selectedGrade.name || selectedGrade.id} - ${selectedSection.name || selectedSection.id} - ${selectedTeacher.name || selectedTeacher.email || selectedTeacher.id}`,
      });
      setSeatAdminMessage('Fixed schedule saved.');
      resetFixedScheduleForm();
      await fetchSeatAdminData(blockDate);
    } catch (err) {
      setSeatAdminError(err.response?.data?.message || 'Failed to save fixed schedule');
    }
  };

  const handleDeleteFixedScheduleEntry = async (id) => {
    if (!window.confirm('Remove this fixed schedule entry?')) return;
    setSeatAdminError('');
    setSeatAdminMessage('');
    try {
      await seatsAPI.deleteFixedScheduleEntry(id);
      setSeatAdminMessage('Fixed schedule removed.');
      if (editingFixedScheduleId === id) {
        resetFixedScheduleForm();
      }
      await fetchSeatAdminData(blockDate);
    } catch (err) {
      setSeatAdminError(err.response?.data?.message || 'Failed to remove fixed schedule');
    }
  };

  const leftSeatCatalog = useMemo(
    () => seatCatalogAdmin
      .filter((seat) => (seat.side || '').toLowerCase() === 'left')
      .sort((a, b) => String(a.row || '').localeCompare(String(b.row || '')) || Number(a.column || 0) - Number(b.column || 0)),
    [seatCatalogAdmin]
  );

  const rightSeatCatalog = useMemo(
    () => seatCatalogAdmin
      .filter((seat) => (seat.side || '').toLowerCase() === 'right')
      .sort((a, b) => String(a.row || '').localeCompare(String(b.row || '')) || Number(a.column || 0) - Number(b.column || 0)),
    [seatCatalogAdmin]
  );

  const groupSeatsByRow = (seats) => {
    const grouped = seats.reduce((acc, seat) => {
      const row = String(seat.row || '').toUpperCase();
      if (!row) return acc;
      if (!acc[row]) acc[row] = [];
      acc[row].push(seat);
      return acc;
    }, {});

    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((row) => ({
        row,
        seats: grouped[row].sort((a, b) => Number(a.column || 0) - Number(b.column || 0)),
      }));
  };

  const leftSeatRows = useMemo(() => groupSeatsByRow(leftSeatCatalog), [leftSeatCatalog]);
  const rightSeatRows = useMemo(() => groupSeatsByRow(rightSeatCatalog), [rightSeatCatalog]);

  const fixedScheduleLookup = useMemo(() => {
    const map = new Map();
    (Array.isArray(fixedScheduleAdmin) ? fixedScheduleAdmin : []).forEach((entry) => {
      if (entry?.active === false) return;
      const key = `${entry.dayOfWeek}|${entry.startTime}|${entry.endTime}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    });
    return map;
  }, [fixedScheduleAdmin]);

  const selectedFixedDayLabel = useMemo(() => {
    const day = FIXED_SCHEDULE_DAYS.find((item) => item.dayOfWeek === Number(selectedFixedCell?.dayOfWeek));
    return day?.label || '-';
  }, [selectedFixedCell]);

  const fixedScheduleSectionOptions = useMemo(
    () => sections
      .filter((section) => section.gradeLevelId === fixedScheduleGradeId)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [sections, fixedScheduleGradeId]
  );

  const fixedScheduleTeacherOptions = useMemo(
    () => [...teachers].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [teachers]
  );

  const seatIdExists = (row, column) => {
    const id = `${String(row).toUpperCase()}${Number(column)}`;
    return seatCatalogAdmin.some((seat) => String(seat.id || '').toUpperCase() === id);
  };

  const detectRowSide = (row) => {
    const normalizedRow = String(row || '').trim().toUpperCase();
    if (!/^[A-Z]$/.test(normalizedRow)) return null;

    const sides = new Set(
      seatCatalogAdmin
        .filter((seat) => String(seat.row || '').toUpperCase() === normalizedRow)
        .map((seat) => String(seat.side || '').toLowerCase())
        .filter((side) => side === 'left' || side === 'right')
    );

    if (sides.size === 1) return [...sides][0];
    return null;
  };

  const handleInsertSeatAtPosition = async () => {
    const row = String(insertSeatRow || '').trim().toUpperCase();
    const requestedColumn = Number(insertSeatColumn);
    const side = detectRowSide(row);

    if (!/^[A-Z]$/.test(row)) {
      setSeatAdminError('Row must be one capital letter (A-Z).');
      return;
    }
    if (!Number.isInteger(requestedColumn) || requestedColumn < 1 || requestedColumn > 99) {
      setSeatAdminError('Column must be a number from 1 to 99.');
      return;
    }
    if (!side) {
      setSeatAdminError(`Row ${row} does not exist yet or has inconsistent side data. Insert only works for existing rows.`);
      return;
    }
    const rowColumns = new Set(
      seatCatalogAdmin
        .filter((seat) => String(seat.row || '').toUpperCase() === row && String(seat.side || '').toLowerCase() === side)
        .map((seat) => Number(seat.column))
        .filter((n) => Number.isInteger(n) && n > 0)
    );

    let adjustedColumn = requestedColumn;
    for (let c = 1; c < requestedColumn; c += 1) {
      if (!rowColumns.has(c)) {
        adjustedColumn = c;
        break;
      }
    }

    if (rowColumns.has(adjustedColumn) || seatIdExists(row, adjustedColumn)) {
      setSeatAdminError(`Seat ${row}${adjustedColumn} already exists. Choose another position.`);
      return;
    }

    const adjustedMessage = adjustedColumn !== requestedColumn
      ? `Requested ${row}${requestedColumn} adjusted to ${row}${adjustedColumn} because ${row}${adjustedColumn} was missing.`
      : '';

    await upsertSeatByPosition(row, adjustedColumn, side, adjustedMessage);
    setInsertSeatRow('');
    setInsertSeatColumn('');
  };

  const handleAddRightSeat = async (side) => {
    const sideSeats = side === 'left' ? leftSeatCatalog : rightSeatCatalog;
    const oppositeSeats = side === 'left' ? rightSeatCatalog : leftSeatCatalog;
    const oppositeRows = new Set(oppositeSeats.map((seat) => String(seat.row || '').toUpperCase()).filter((row) => /^[A-Z]$/.test(row)));
    let targetRow = '';
    let targetColumn = 1;

    if (sideSeats.length === 0) {
      let code = side === 'left' ? 'A'.charCodeAt(0) : 'D'.charCodeAt(0);
      while (code <= 90 && oppositeRows.has(String.fromCharCode(code))) {
        code += 1;
      }
      if (code > 90) {
        setSeatAdminError('No available row letter left (A-Z).');
        return;
      }
      targetRow = String.fromCharCode(code);
      while (seatIdExists(targetRow, targetColumn) && targetColumn <= 99) {
        targetColumn += 1;
      }
      if (targetColumn > 99) {
        setSeatAdminError(`No available slot on row ${targetRow}.`);
        return;
      }
      await upsertSeatByPosition(targetRow, targetColumn, side);
      return;
    }

    const lastSeat = sideSeats[sideSeats.length - 1];
    targetRow = String(lastSeat.row || '').toUpperCase();
    const maxColumnInRow = Math.max(
      ...sideSeats
        .filter((seat) => String(seat.row || '').toUpperCase() === targetRow)
        .map((seat) => Number(seat.column || 0)),
      0
    );
    targetColumn = maxColumnInRow + 1;

    while (seatIdExists(targetRow, targetColumn) && targetColumn <= 99) {
      targetColumn += 1;
    }

    if (targetColumn > 99) {
      setSeatAdminError(`No available column left for row ${targetRow}.`);
      return;
    }

    await upsertSeatByPosition(targetRow, targetColumn, side);
  };

  const handleAddLastSeatPerSide = async (side) => {
    const sideSeats = side === 'left' ? leftSeatCatalog : rightSeatCatalog;
    const oppositeSeats = side === 'left' ? rightSeatCatalog : leftSeatCatalog;
    const oppositeRows = new Set(oppositeSeats.map((seat) => String(seat.row || '').toUpperCase()).filter((row) => /^[A-Z]$/.test(row)));
    const sideRows = sideSeats.map((seat) => String(seat.row || '').toUpperCase()).filter(Boolean);
    const maxRow = sideRows.length > 0 ? sideRows.sort((a, b) => a.localeCompare(b))[sideRows.length - 1] : (side === 'left' ? 'A' : 'D');

    let code = maxRow.charCodeAt(0) + (sideRows.length > 0 ? 1 : 0);
    while (code <= 90) { // Z
      const row = String.fromCharCode(code);
      if (!oppositeRows.has(row) && !seatIdExists(row, 1)) {
        await upsertSeatByPosition(row, 1, side);
        return;
      }
      code += 1;
    }

    setSeatAdminError('No available row letter left (A-Z).');
  };

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const handleApproveUser = async (email) => {
    try {
      await authAPI.approveUser(email);
      setPendingUsers((prev) => prev.filter((u) => u.email !== email));
    } catch (err) {
      setError('Failed to approve user');
    }
  };

  const handleRejectUser = async (email) => {
    if (!window.confirm('Reject this registration request?')) return;
    try {
      await authAPI.rejectUser(email);
      setPendingUsers((prev) => prev.filter((u) => u.email !== email));
    } catch (err) {
      setError('Failed to reject user');
    }
  };

  const handleDeleteAccount = async (uid, label) => {
    if (!window.confirm(`Delete account for ${label}? This removes login access.`)) return;
    setAccountsError('');
    try {
      await authAPI.deleteUserByUid(uid);
      await fetchAccountsData();
      await fetchSectionData();
    } catch (err) {
      setAccountsError(err.response?.data?.message || 'Failed to delete account');
    }
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const handleWeeklyGenerate = async () => {
    setReportLoading(true);
    setReportError('');
    try {
      const response = await reportAPI.getWeeklyReport(weeklyRange.startDate, weeklyRange.endDate);
      setWeeklyReport(response.data.data);
    } catch (err) {
      setReportError(err.response?.data?.message || 'Failed to generate weekly report');
    } finally {
      setReportLoading(false);
    }
  };

  const handleMonthlyGenerate = async () => {
    setReportLoading(true);
    setReportError('');
    try {
      const response = await reportAPI.getMonthlyReport(monthlyConfig.month, monthlyConfig.year);
      setMonthlyReport(response.data.data);
    } catch (err) {
      setReportError(err.response?.data?.message || 'Failed to generate monthly report');
    } finally {
      setReportLoading(false);
    }
  };

  const handleYearlyGenerate = async () => {
    setReportLoading(true);
    setReportError('');
    try {
      const months = Array.from({ length: 12 }, (_, idx) => idx + 1);
      const responses = await Promise.all(
        months.map((month) => reportAPI.getMonthlyReport(month, yearlyYear))
      );

      const totals = responses.reduce(
        (acc, response) => {
          const data = response.data.data;
          acc.totalBookings += data.totalBookings;
          acc.approvedBookings += data.approvedBookings;
          acc.attendedBookings += data.attendedBookings;
          return acc;
        },
        { totalBookings: 0, approvedBookings: 0, attendedBookings: 0 }
      );

      setYearlyReport({
        year: yearlyYear,
        ...totals,
      });
    } catch (err) {
      setReportError(err.response?.data?.message || 'Failed to generate yearly report');
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate) {
      fetchDailyData();
      fetchAttendance(selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!weeklyRange.startDate) return;
    const computedEndDate = computeWeeklyEndDate(weeklyRange.startDate);
    if (computedEndDate && computedEndDate !== weeklyRange.endDate) {
      setWeeklyRange((prev) => ({ ...prev, endDate: computedEndDate }));
    }
  }, [weeklyRange.startDate]);

  useEffect(() => {
    if (activeSection !== 'reports') return;
    fetchDetailedReportData();
  }, [activeSection, reportTab, weeklyRange, monthlyConfig, yearlyYear, feedbackEntries]);

  useEffect(() => {
    if (activeSection !== 'reports') return;
    fetchReportInsights();
  }, [activeSection, reportTab, weeklyRange, monthlyConfig, yearlyYear]);

  const ReportGraph = ({ data, title }) => {
    if (!data) {
      return (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold mb-2">{title}</h3>
          <p className="text-gray-600">Generate a report to see the graph.</p>
        </div>
      );
    }

    const metrics = [
      { label: 'Total Bookings', value: data.totalBookings, color: 'bg-blue-500' },
      { label: 'Approved', value: data.approvedBookings, color: 'bg-green-500' },
      { label: 'Attended', value: data.attendedBookings, color: 'bg-purple-500' },
    ];
    const maxValue = Math.max(...metrics.map((m) => m.value), 1);

    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-6">{title}</h3>
        <div className="flex items-end gap-8 h-48">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex flex-col items-center w-24">
              <div className="w-full h-40 flex items-end">
                <div
                  className={`w-full ${metric.color} rounded-t-md`}
                  style={{ height: `${(metric.value / maxValue) * 100}%` }}
                />
              </div>
              <p className="text-lg font-semibold mt-2">{metric.value}</p>
              <p className="text-xs text-gray-600 text-center">{metric.label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-sm text-slate-600">Most Used Seat</p>
            <p className="text-lg font-bold">{reportInsights.mostUsedSeat.label}</p>
            <p className="text-xs text-slate-500">Bookings: {reportInsights.mostUsedSeat.count}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-sm text-slate-600">Top Grade Level</p>
            <p className="text-lg font-bold">{reportInsights.topGradeLevel.label}</p>
            <p className="text-xs text-slate-500">Bookings: {reportInsights.topGradeLevel.count}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-sm text-slate-600">Top Section</p>
            <p className="text-lg font-bold">{reportInsights.topSection.label}</p>
            <p className="text-xs text-slate-500">Bookings: {reportInsights.topSection.count}</p>
          </div>
        </div>
      </div>
    );
  };

  const MAX_DETAIL_DAYS = 45;

  const toDateObject = (value, fallbackDate) => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'object') {
      if (typeof value.toDate === 'function') {
        const d = value.toDate();
        return Number.isNaN(d.getTime()) ? null : d;
      }
      if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
      if (typeof value._seconds === 'number') return new Date(value._seconds * 1000);
    }

    if (typeof value === 'string' && fallbackDate && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
      const timePart = value.length === 5 ? `${value}:00` : value;
      const combined = new Date(`${fallbackDate}T${timePart}`);
      return Number.isNaN(combined.getTime()) ? null : combined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatClockTime = (value, fallbackDate, invalidLabel = '-') => {
    if (!value) return invalidLabel;

    if (typeof value === 'string') {
      const directTime = value.match(/^(\d{2}:\d{2})/);
      if (directTime) {
        const [h, m] = directTime[1].split(':').map(Number);
        const hour12 = ((h + 11) % 12) + 1;
        const suffix = h >= 12 ? 'PM' : 'AM';
        return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
      }

      const isoTime = value.match(/T(\d{2}:\d{2})/);
      if (isoTime) {
        const [h, m] = isoTime[1].split(':').map(Number);
        const hour12 = ((h + 11) % 12) + 1;
        const suffix = h >= 12 ? 'PM' : 'AM';
        return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
      }
    }

    const parsed = toDateObject(value, fallbackDate);
    if (!parsed) return invalidLabel;

    const h = parsed.getUTCHours();
    const m = parsed.getUTCMinutes();
    const hour12 = ((h + 11) % 12) + 1;
    const suffix = h >= 12 ? 'PM' : 'AM';
    return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
  };

  const toDateKey = (date) => {
    const d = toDateObject(date);
    if (!d) return null;
    return d.toISOString().split('T')[0];
  };

  const getBookingDateKey = (booking) => {
    if (!booking) return null;
    if (booking.date && /^\d{4}-\d{2}-\d{2}$/.test(String(booking.date))) return String(booking.date);

    const fromStart = toDateObject(booking.startTime || booking.start, booking.date);
    if (fromStart) return fromStart.toISOString().split('T')[0];

    return null;
  };

  const summarizeTop = (mapObj) => {
    const entries = Object.entries(mapObj || {});
    if (entries.length === 0) return { label: '-', count: 0 };
    const [label, count] = entries.sort((a, b) => b[1] - a[1])[0];
    return { label, count };
  };

  const getDateRangeForTab = () => {
    if (reportTab === 'weekly') {
      return { startDate: weeklyRange.startDate, endDate: weeklyRange.endDate };
    }

    if (reportTab === 'monthly') {
      const start = new Date(monthlyConfig.year, monthlyConfig.month - 1, 1);
      const end = new Date(monthlyConfig.year, monthlyConfig.month, 0);
      return { startDate: toDateKey(start), endDate: toDateKey(end) };
    }

    const start = new Date(yearlyYear, 0, 1);
    const end = new Date(yearlyYear, 11, 31);
    return { startDate: toDateKey(start), endDate: toDateKey(end) };
  };

  const listDatesInRange = (startDate, endDate) => {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) return dates;

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const classifySentiment = (message) => {
    if (!message) return 'neutral';
    const text = String(message).toLowerCase();
    const normalized = text.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!normalized) return 'neutral';

    const phraseWeights = [
      { phrase: 'very good', weight: 2 },
      { phrase: 'really good', weight: 2 },
      { phrase: 'works well', weight: 2 },
      { phrase: 'easy to use', weight: 2 },
      { phrase: 'thank you', weight: 1 },
      { phrase: 'not bad', weight: 1 },
      { phrase: 'very bad', weight: -3 },
      { phrase: 'really bad', weight: -3 },
      { phrase: 'not good', weight: -2 },
      { phrase: 'not helpful', weight: -2 },
      { phrase: 'too slow', weight: -2 },
      { phrase: 'very slow', weight: -2 },
      { phrase: 'does not work', weight: -3 },
      { phrase: 'not working', weight: -3 },
      { phrase: 'hard to use', weight: -2 },
      { phrase: 'too difficult', weight: -2 },
    ];

    const positiveWords = new Set([
      'good', 'great', 'excellent', 'love', 'helpful', 'amazing', 'easy', 'nice',
      'thanks', 'thank', 'fast', 'clear', 'smooth', 'perfect', 'awesome',
    ]);
    const negativeWords = new Set([
      'bad', 'poor', 'terrible', 'hate', 'slow', 'bug', 'issue', 'problem',
      'hard', 'confusing', 'difficult', 'fail', 'broken', 'error', 'worst', 'awful',
    ]);
    const negators = new Set(['not', 'no', 'never', 'none', "don't", "didn't", "isn't", "wasn't", "can't"]);

    let score = 0;

    phraseWeights.forEach(({ phrase, weight }) => {
      if (normalized.includes(phrase)) score += weight;
    });

    const words = normalized.split(' ');
    words.forEach((word, idx) => {
      const prev = words[idx - 1];
      const prev2 = words[idx - 2];
      const hasNegation = negators.has(prev) || negators.has(prev2);

      if (positiveWords.has(word)) {
        score += hasNegation ? -2 : 1;
      } else if (negativeWords.has(word)) {
        score += hasNegation ? 1 : -2;
      }
    });

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  };

  const fetchReportInsights = async () => {
    const { startDate, endDate } = getDateRangeForTab();
    if (!startDate || !endDate) return;

    try {
      const response = await seatsAPI.getAllSeatsAdmin();
      const allBookings = response.data.data || [];
      const filtered = allBookings.filter((booking) => {
        const dateKey = getBookingDateKey(booking);
        if (!dateKey) return false;
        return dateKey >= startDate && dateKey <= endDate;
      });

      const seatCounts = {};
      const gradeCounts = {};
      const sectionCounts = {};

      filtered.forEach((booking) => {
        const status = (booking.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'rejected') return;

        const seats = Array.isArray(booking.seats)
          ? booking.seats
          : booking.seat
            ? [booking.seat]
            : [];
        seats.forEach((seat) => {
          const key = String(seat || '').toUpperCase();
          if (!key) return;
          seatCounts[key] = (seatCounts[key] || 0) + 1;
        });

        const grade = String(booking.gradeLevel || booking.gradeLevelId || '').trim();
        if (grade) gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;

        const section = String(booking.section || booking.sectionId || '').trim();
        if (section) sectionCounts[section] = (sectionCounts[section] || 0) + 1;
      });

      setReportInsights({
        mostUsedSeat: summarizeTop(seatCounts),
        topGradeLevel: summarizeTop(gradeCounts),
        topSection: summarizeTop(sectionCounts),
      });
    } catch (err) {
      setReportInsights({
        mostUsedSeat: { label: '-', count: 0 },
        topGradeLevel: { label: '-', count: 0 },
        topSection: { label: '-', count: 0 },
      });
    }
  };

  const fetchDetailedReportData = async () => {
    const { startDate, endDate } = getDateRangeForTab();
    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const rangeDays = Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;

    if (rangeDays > MAX_DETAIL_DAYS) {
      setDetailError(`Range too large for detailed charts. Please use ${MAX_DETAIL_DAYS} days or less.`);
      setDetailBookings([]);
      setDetailClasses([]);
      setDetailFeedback([]);
      return;
    }

    setDetailLoading(true);
    setDetailError('');

    try {
      const dates = listDatesInRange(startDate, endDate);

      const bookingResults = await Promise.all(
        dates.map(async (date) => {
          try {
            const response = await seatsAPI.getAllSeats(date);
            return { date, bookings: response.data.data || [] };
          } catch (err) {
            return { date, bookings: [] };
          }
        })
      );

      const classResults = await Promise.all(
        dates.map(async (date) => {
          try {
            const response = await classAPI.getClassesByDate(date);
            return { date, classes: response.data.data || [] };
          } catch (err) {
            return { date, classes: [] };
          }
        })
      );

      const filteredFeedback = (feedbackEntries || []).filter((entry) => {
        const created = toDateKey(entry.createdAt);
        return created && created >= startDate && created <= endDate;
      });

      setDetailBookings(bookingResults);
      setDetailClasses(classResults);
      setDetailFeedback(filteredFeedback);
    } finally {
      setDetailLoading(false);
    }
  };

  const buildBookingStatusSeries = () => {
    const series = detailBookings.map(({ date, bookings }) => {
      const counts = {
        pending: 0,
        approved: 0,
        attended: 0,
        cancelled: 0,
        rejected: 0,
      };

      bookings.forEach((booking) => {
        const status = (booking.status || 'pending').toLowerCase();
        if (counts[status] !== undefined) {
          counts[status] += 1;
        } else {
          counts.pending += 1;
        }
      });

      return { date, ...counts };
    });

    return series;
  };

  const bookingStatusSeries = buildBookingStatusSeries();

  const attendanceSeries = bookingStatusSeries.map((entry) => {
    const denom = entry.approved + entry.attended;
    const rate = denom > 0 ? Math.round((entry.attended / denom) * 100) : 0;
    return { date: entry.date, value: rate };
  });

  function extractBookingHour(booking) {
    const raw = booking?.startTime || booking?.start || booking?.time;

    if (typeof raw === 'string') {
      const direct = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
      if (direct) {
        const hour = Number(direct[1]);
        return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
      }

      const iso = raw.match(/T(\d{2}):(\d{2})/);
      if (iso) {
        const hour = Number(iso[1]);
        return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
      }
    }

    const parsed = toDateObject(raw, booking?.date);
    if (!parsed) return null;
    return parsed.getUTCHours();
  }

  const hourlyBookingSeries = (() => {
    const counts = Array.from({ length: 24 }, () => 0);
    detailBookings.forEach(({ bookings }) => {
      bookings.forEach((booking) => {
        const status = (booking.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'rejected') return;

        const hour = extractBookingHour(booking);
        if (hour == null) return;
        counts[hour] += 1;
      });
    });
    return counts.map((value, hour) => ({ hour, value }));
  })();

  const peakHours = (() => {
    const peak = hourlyBookingSeries
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    return peak.length === 0 ? hourlyBookingSeries : peak;
  })();

  const formatHourLabel12h = (hour) => {
    const normalized = Number(hour);
    if (!Number.isFinite(normalized)) return '--';
    const h = ((normalized % 24) + 24) % 24;
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour12 = ((h + 11) % 12) + 1;
    return `${hour12}:00 ${suffix}`;
  };

  const predictedPeakHours = (() => {
    const dayCount = detailBookings.length;
    if (dayCount === 0) return [];

    const hourlyByDay = Array.from({ length: 24 }, () => Array.from({ length: dayCount }, () => 0));

    detailBookings.forEach(({ bookings }, dayIdx) => {
      bookings.forEach((booking) => {
        const status = (booking.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'rejected') return;

        const hour = extractBookingHour(booking);
        if (hour == null) return;
        if (hour >= 0 && hour <= 23) {
          hourlyByDay[hour][dayIdx] += 1;
        }
      });
    });

    const forecast = hourlyByDay.map((series, hour) => {
      if (series.length === 1) return { hour, value: series[0] };

      const n = series.length;
      const xMean = (n - 1) / 2;
      const yMean = series.reduce((sum, value) => sum + value, 0) / n;
      let num = 0;
      let den = 0;

      series.forEach((value, idx) => {
        const dx = idx - xMean;
        num += dx * (value - yMean);
        den += dx * dx;
      });

      const slope = den === 0 ? 0 : num / den;
      const intercept = yMean - slope * xMean;
      const nextValue = Math.max(0, Math.round(intercept + slope * n));
      return { hour, value: nextValue };
    });

    const top = forecast
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    if (top.length > 0) return top;
    return peakHours
      .filter((item) => item.value > 0)
      .slice(0, 6);
  })();

  const topStudents = (() => {
    const map = {};
    detailBookings.forEach(({ bookings }) => {
      bookings.forEach((booking) => {
        const role = String(booking.role || '').toLowerCase();
        // Only include student bookings; prevent teacher entries from leaking here.
        if (role && role !== 'student') return;
        if (!role && (booking.teacherId || booking.teacherName)) return;
        const name = booking.studentName || 'Unknown';
        map[name] = (map[name] || 0) + 1;
      });
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  })();

  const topTeachers = (() => {
    const map = {};
    detailBookings.forEach(({ bookings }) => {
      bookings.forEach((booking) => {
        const role = String(booking.role || '').toLowerCase();
        if (role !== 'teacher') return;
        const key = booking.studentName || booking.teacherName || booking.teacherId || 'Unknown';
        map[key] = (map[key] || 0) + 1;
      });
    });

    detailClasses.forEach(({ classes }) => {
      classes.forEach((cls) => {
        const key = cls.teacherName || cls.teacherId || 'Unknown';
        map[key] = (map[key] || 0) + 1;
      });
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  })();

  const feedbackSummary = (() => {
    const summary = {
      total: detailFeedback.length,
      byRole: {},
      bySentiment: { positive: 0, neutral: 0, negative: 0 },
      daily: {},
      avgScore: 0,
    };
    let score = 0;

    detailFeedback.forEach((entry) => {
      const role = entry.role || 'unknown';
      summary.byRole[role] = (summary.byRole[role] || 0) + 1;

      const sentiment = classifySentiment(entry.message);
      summary.bySentiment[sentiment] += 1;
      if (sentiment === 'positive') score += 1;
      if (sentiment === 'negative') score -= 1;

      const dateKey = toDateKey(entry.createdAt);
      if (dateKey) {
        summary.daily[dateKey] = (summary.daily[dateKey] || 0) + 1;
      }
    });

    summary.avgScore = detailFeedback.length > 0 ? Math.round((score / detailFeedback.length) * 100) : 0;
    return summary;
  })();
  const sentimentBarWidth = feedbackSummary.total > 0
    ? Math.max(Math.abs(feedbackSummary.avgScore), 2)
    : 0;
  const sentimentBarColor = feedbackSummary.avgScore > 0
    ? 'bg-green-500'
    : feedbackSummary.avgScore < 0
      ? 'bg-red-500'
      : 'bg-gray-400';
  const sentimentScoreLabel = feedbackSummary.total === 0
    ? 'No feedback data'
    : feedbackSummary.avgScore === 0
      ? '0% (balanced positive and negative)'
      : `${feedbackSummary.avgScore}% (positive to negative scale)`;

  const statusColors = {
    pending: 'bg-yellow-400',
    approved: 'bg-blue-500',
    attended: 'bg-green-500',
    cancelled: 'bg-red-400',
    rejected: 'bg-gray-500',
  };

  const FeedbackSummaryPanel = () => (
    <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Feedback Summary</h3>
        <button
          onClick={() => setShowFeedbackComments((prev) => !prev)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {showFeedbackComments ? 'Hide comments' : 'View comments'}
        </button>
      </div>

      {detailFeedback.length === 0 ? (
        <p className="text-gray-600">No feedback for this range.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-sm text-blue-700">Total Feedback</p>
              <p className="text-2xl font-bold">{feedbackSummary.total}</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-lg p-4">
              <p className="text-sm text-green-700">Positive</p>
              <p className="text-2xl font-bold">{feedbackSummary.bySentiment.positive}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4">
              <p className="text-sm text-yellow-700">Neutral</p>
              <p className="text-2xl font-bold">{feedbackSummary.bySentiment.neutral}</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg p-4">
              <p className="text-sm text-red-700">Negative</p>
              <p className="text-2xl font-bold">{feedbackSummary.bySentiment.negative}</p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">Average sentiment score</p>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-3 ${sentimentBarColor}`}
                style={{ width: `${Math.min(sentimentBarWidth, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">{sentimentScoreLabel}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Feedback by Role</h4>
              <div className="space-y-2">
                {Object.entries(feedbackSummary.byRole).map(([role, value]) => (
                  <div key={role} className="flex items-center justify-between">
                    <span className="capitalize text-sm text-gray-600">{role}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Feedback Volume</h4>
              <div className="flex items-end gap-2 h-32">
                {Object.entries(feedbackSummary.daily).map(([date, value]) => (
                  <div key={date} className="flex flex-col items-center flex-1 min-w-[20px]">
                    <div
                      className="w-full bg-blue-400 rounded"
                      style={{ height: `${Math.max(value, 1) * 12}px` }}
                    />
                    <span className="text-[10px] text-gray-500 mt-1">{date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {showFeedbackComments && (
            <div className="mt-6 space-y-3">
              {detailFeedback.map((entry) => (
                <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">{entry.name || 'Anonymous'}</p>
                    <p className="text-xs text-gray-500">{formatFeedbackDate(entry.createdAt)}</p>
                  </div>
                  <p className="text-sm text-gray-600 mb-1 capitalize">{entry.role || 'user'}</p>
                  <p className="text-gray-700">{entry.message}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  const formatFeedbackDate = (value) => {
    if (!value) return '—';
    const date = toDateObject(value);
    if (!date) return '—';
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
  };

  const handleDownloadReport = () => {
    if (!activeReportData) return;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = 16;

    const ensureSpace = (heightNeeded) => {
      if (y + heightNeeded <= pageHeight - margin) return;
      pdf.addPage();
      y = margin;
    };

    const addTitle = (text) => {
      ensureSpace(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text(text, margin, y);
      y += 8;
    };

    const addParagraph = (text) => {
      const lines = pdf.splitTextToSize(String(text), contentWidth);
      const lineHeight = 5;
      ensureSpace(lines.length * lineHeight + 2);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(lines, margin, y);
      y += lines.length * lineHeight + 2;
    };

    const fitCellText = (text, cellWidth) => {
      const raw = String(text ?? '-');
      const maxChars = Math.max(6, Math.floor(cellWidth / 1.9));
      return raw.length > maxChars ? `${raw.slice(0, maxChars - 3)}...` : raw;
    };

    const addTable = (headers, rows) => {
      const cols = headers.length;
      const rowHeight = 7;
      const colWidth = contentWidth / cols;
      ensureSpace(rowHeight + 2);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      let x = margin;
      headers.forEach((header) => {
        pdf.rect(x, y, colWidth, rowHeight);
        pdf.text(fitCellText(header, colWidth), x + 1.5, y + 4.8);
        x += colWidth;
      });
      y += rowHeight;

      pdf.setFont('helvetica', 'normal');
      rows.forEach((row) => {
        ensureSpace(rowHeight);
        let rowX = margin;
        row.forEach((cell) => {
          pdf.rect(rowX, y, colWidth, rowHeight);
          pdf.text(fitCellText(cell, colWidth), rowX + 1.5, y + 4.8);
          rowX += colWidth;
        });
        y += rowHeight;
      });

      y += 4;
    };

    const addSummaryBarChart = (title, items, valueSuffix = '') => {
      const safeItems = (items || []).map((item) => ({
        label: String(item?.label ?? '-'),
        value: Number(item?.value ?? 0),
      }));
      if (safeItems.length === 0) return;

      addTitle(title);
      const rowHeight = 8;
      const labelWidth = 40;
      const valueWidth = 20;
      const barWidth = contentWidth - labelWidth - valueWidth - 4;
      const maxValue = Math.max(...safeItems.map((item) => item.value), 1);

      ensureSpace(safeItems.length * rowHeight + 4);
      safeItems.forEach((item, index) => {
        const rowY = y + index * rowHeight;
        const barX = margin + labelWidth;
        const barY = rowY + 2;
        const fillWidth = (item.value / maxValue) * barWidth;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(item.label, margin, rowY + 5);

        pdf.setFillColor(241, 245, 249);
        pdf.rect(barX, barY, barWidth, 4, 'F');

        pdf.setFillColor(37, 99, 235);
        pdf.rect(barX, barY, fillWidth, 4, 'F');

        pdf.setTextColor(71, 85, 105);
        pdf.text(`${item.value}${valueSuffix}`, barX + barWidth + 2, rowY + 5);
        pdf.setTextColor(0, 0, 0);
      });

      y += safeItems.length * rowHeight + 4;
    };

    const periodLabel = (() => {
      if (reportTab === 'weekly') return `${weeklyRange.startDate} to ${weeklyRange.endDate}`;
      if (reportTab === 'monthly') return `${monthlyConfig.year}-${String(monthlyConfig.month).padStart(2, '0')}`;
      return `${yearlyYear}`;
    })();

    addTitle(`Admin ${reportTab.toUpperCase()} Report`);
    addParagraph(`Period: ${periodLabel}`);
    addParagraph(`Generated: ${new Date().toLocaleString()}`);

    addTitle('Summary');
    addTable(
      ['Metric', 'Value'],
      [
        ['Total Bookings', activeReportData.totalBookings ?? 0],
        ['Approved Bookings', activeReportData.approvedBookings ?? 0],
        ['Attended Bookings', activeReportData.attendedBookings ?? 0],
        ['Most Used Seat', `${reportInsights.mostUsedSeat.label} (${reportInsights.mostUsedSeat.count})`],
        ['Top Grade Level', `${reportInsights.topGradeLevel.label} (${reportInsights.topGradeLevel.count})`],
        ['Top Section', `${reportInsights.topSection.label} (${reportInsights.topSection.count})`],
      ]
    );

    const isSummaryGraphMode = reportTab === 'monthly' || reportTab === 'yearly';

    if (bookingStatusSeries.length > 0) {
      if (isSummaryGraphMode) {
        const statusTotals = bookingStatusSeries.reduce(
          (acc, entry) => ({
            pending: acc.pending + (entry.pending || 0),
            approved: acc.approved + (entry.approved || 0),
            attended: acc.attended + (entry.attended || 0),
            cancelled: acc.cancelled + (entry.cancelled || 0),
            rejected: acc.rejected + (entry.rejected || 0),
          }),
          { pending: 0, approved: 0, attended: 0, cancelled: 0, rejected: 0 }
        );

        addSummaryBarChart('Bookings by Status (Summary Graph)', [
          { label: 'Pending', value: statusTotals.pending },
          { label: 'Approved', value: statusTotals.approved },
          { label: 'Attended', value: statusTotals.attended },
          { label: 'Cancelled', value: statusTotals.cancelled },
          { label: 'Rejected', value: statusTotals.rejected },
        ]);
      } else {
        addTitle('Bookings by Status (Daily)');
        addTable(
          ['Date', 'Pending', 'Approved', 'Attended', 'Cancelled', 'Rejected'],
          bookingStatusSeries.slice(0, 30).map((entry) => [
            entry.date,
            entry.pending,
            entry.approved,
            entry.attended,
            entry.cancelled,
            entry.rejected,
          ])
        );
      }
    }

    if (attendanceSeries.length > 0) {
      if (isSummaryGraphMode) {
        const values = attendanceSeries.map((entry) => Number(entry.value || 0));
        const avg = values.length > 0
          ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
          : 0;
        const min = values.length > 0 ? Math.min(...values) : 0;
        const max = values.length > 0 ? Math.max(...values) : 0;

        addSummaryBarChart('Attendance Rate (Summary Graph)', [
          { label: 'Average', value: avg },
          { label: 'Highest', value: max },
          { label: 'Lowest', value: min },
        ], '%');
      } else {
        addTitle('Attendance Rate');
        addTable(
          ['Date', 'Rate (%)'],
          attendanceSeries.slice(0, 30).map((entry) => [entry.date, entry.value])
        );
      }
    }

    addTitle('Top Activity');
    addTable(
      ['Top Students', 'Bookings', 'Top Teachers', 'Classes'],
      Array.from({ length: Math.max(topStudents.length, topTeachers.length, 1) }, (_, idx) => [
        topStudents[idx]?.name || '-',
        topStudents[idx]?.value ?? '-',
        topTeachers[idx]?.name || '-',
        topTeachers[idx]?.value ?? '-',
      ])
    );

    addTitle('Feedback Summary');
    addTable(
      ['Total', 'Positive', 'Neutral', 'Negative', 'Avg Score (%)'],
      [[
        feedbackSummary.total,
        feedbackSummary.bySentiment.positive,
        feedbackSummary.bySentiment.neutral,
        feedbackSummary.bySentiment.negative,
        feedbackSummary.avgScore,
      ]]
    );

    const today = new Date().toISOString().split('T')[0];
    pdf.save(`AdminReport_${reportTab}_${today}.pdf`);
  };

  const DetailCharts = () => {
    if (detailLoading) {
      return (
        <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
          <p className="text-gray-600">Loading detailed charts...</p>
        </div>
      );
    }

    if (detailError) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mt-8">
          {detailError}
        </div>
      );
    }

    if (detailBookings.length === 0 && detailFeedback.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
          <p className="text-gray-600">No detailed data to display.</p>
        </div>
      );
    }

    const maxDailyTotal = Math.max(
      ...bookingStatusSeries.map((entry) =>
        entry.pending + entry.approved + entry.attended + entry.cancelled + entry.rejected
      ),
      1
    );

    const maxAttendance = Math.max(...attendanceSeries.map((item) => item.value), 1);
    const maxPeak = Math.max(...hourlyBookingSeries.map((item) => item.value), 1);
    const maxStudent = Math.max(...topStudents.map((item) => item.value), 1);
    const maxTeacher = Math.max(...topTeachers.map((item) => item.value), 1);
    const peakAxisTicks = (() => {
      const rawTicks = Array.from({ length: 5 }, (_, idx) =>
        Math.round(maxPeak - (idx * maxPeak) / 4)
      );
      const uniqueTicks = [...new Set(rawTicks)];
      if (!uniqueTicks.includes(0)) uniqueTicks.push(0);
      return uniqueTicks.sort((a, b) => b - a);
    })();

    return (
      <>
        <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
          <h3 className="text-xl font-bold mb-4">Bookings by Status Over Time</h3>
          <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-4">
            {Object.keys(statusColors).map((status) => (
              <div key={status} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded ${statusColors[status]}`} />
                <span className="capitalize">{status}</span>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-2 h-48">
            {bookingStatusSeries.map((entry) => {
              const total = entry.pending + entry.approved + entry.attended + entry.cancelled + entry.rejected;
              const heightPercent = (total / maxDailyTotal) * 100;
              return (
                <div key={entry.date} className="flex flex-col items-center flex-1 min-w-[24px]">
                  <div className="w-full h-40 bg-slate-100 rounded overflow-hidden flex flex-col justify-end">
                    {Object.keys(statusColors).map((status) => {
                      const value = entry[status];
                      if (!value) return null;
                      const segment = total > 0 ? (value / total) * heightPercent : 0;
                      return (
                        <div
                          key={`${entry.date}-${status}`}
                          className={`${statusColors[status]} w-full`}
                          style={{ height: `${segment}%` }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-gray-500 mt-2">{entry.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
          <h3 className="text-xl font-bold mb-4">Attendance Rate (%)</h3>
          <div className="flex items-end gap-2 h-40">
            {attendanceSeries.map((item) => (
              <div key={item.date} className="flex flex-col items-center flex-1 min-w-[24px]">
                <div
                  className="w-full bg-green-500 rounded"
                  style={{ height: `${(item.value / maxAttendance) * 100}%` }}
                />
                <span className="text-[10px] text-gray-500 mt-2">{item.date.slice(5)}</span>
                <span className="text-[10px] text-gray-400">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
          <h3 className="text-xl font-bold mb-4">Peak Booking Hours</h3>
          <div className="w-full overflow-x-auto">
            <svg viewBox="0 0 1000 240" className="w-full min-w-[700px] h-56">
              <rect x="0" y="0" width="1000" height="240" fill="#f8fafc" />
              {peakAxisTicks.map((value) => {
                const yPos = 190 - ((value / maxPeak) * 160);
                return (
                  <g key={`peak-tick-${value}`}>
                    <line x1="56" y1={yPos} x2="960" y2={yPos} stroke="#e2e8f0" strokeWidth="1" />
                    <text x="12" y={yPos + 3} fontSize="11" fill="#64748b">{value}</text>
                  </g>
                );
              })}

              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth="3"
                points={hourlyBookingSeries
                  .map((item, idx) => {
                    const x = 56 + (idx * (960 - 56)) / 23;
                    const y = 190 - ((item.value / maxPeak) * 160);
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />

              {hourlyBookingSeries.map((item, idx) => {
                const x = 56 + (idx * (960 - 56)) / 23;
                const y = 190 - ((item.value / maxPeak) * 160);
                const isLabelHour = idx % 2 === 0;
                return (
                  <g key={item.hour}>
                    <circle cx={x} cy={y} r="3.5" fill="#1d4ed8" />
                    {isLabelHour && (
                      <text x={x - 16} y="214" fontSize="10" fill="#475569">
                        {formatHourLabel12h(item.hour)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="text-xs text-gray-500 mt-2">Hourly bookings (12-hour format)</p>
          <h4 className="text-sm font-semibold text-gray-700 mt-4 mb-2">Real Peak Hours</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4 text-sm">
            {peakHours.slice(0, 6).map((item) => (
              <div key={`peak-${item.hour}`} className="bg-blue-50 border border-blue-100 rounded px-3 py-2">
                <span className="font-semibold">{formatHourLabel12h(item.hour)}</span>
                <span className="text-gray-600"> - {item.value} bookings</span>
              </div>
            ))}
          </div>
          <h4 className="text-sm font-semibold text-gray-700 mt-5 mb-2">Predicted Peak Hours (Next Day)</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {predictedPeakHours.map((item) => (
              <div key={`pred-peak-${item.hour}`} className="bg-emerald-50 border border-emerald-100 rounded px-3 py-2">
                <span className="font-semibold">{formatHourLabel12h(item.hour)}</span>
                <span className="text-gray-600"> - {item.value} predicted</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold mb-4">Most Active Students</h3>
            {topStudents.length === 0 ? (
              <p className="text-gray-600">No student data available.</p>
            ) : (
              <div className="space-y-3">
                {topStudents.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-gray-600">{item.value}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-purple-500"
                        style={{ width: `${(item.value / maxStudent) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold mb-4">Most Active Teachers</h3>
            {topTeachers.length === 0 ? (
              <p className="text-gray-600">No teacher data available.</p>
            ) : (
              <div className="space-y-3">
                {topTeachers.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-gray-600">{item.value}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-orange-500"
                        style={{ width: `${(item.value / maxTeacher) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <FeedbackSummaryPanel />
      </>
    );
  };

  const activeReportData =
    reportTab === 'weekly'
      ? weeklyReport
      : reportTab === 'monthly'
        ? monthlyReport
        : yearlyReport;

  return (
    <div
      className="-m-6 h-[calc(100vh-64px)] flex overflow-hidden bg-cover bg-center"
      style={{
        backgroundImage: `url(${backgroundLdc})`,
      }}
    >

      {/* SIDEBAR */}
      <aside className={`fixed left-0 top-16 bottom-0 w-64 bg-blue-700 text-white flex flex-col px-6 pt-6 pb-6 overflow-y-auto z-30 transform transition-transform duration-200 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-3 rounded-lg bg-white p-2">
          <img
            src={logoName}
            alt="Liceo logo and name"
            className="h-9 w-auto object-contain"
          />
        </div>
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-base text-blue-100 mb-8">{displayName}</p>

        <nav className="space-y-3">
          {['home', 'calendar', 'reports', 'accounts', 'sections', 'fixed-schedule', 'seats'].map((item) => (
            <button
              key={item}
              onClick={() => {
                setActiveSection(item);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-2 rounded transition ${
                activeSection === item ? 'bg-blue-600' : 'hover:bg-blue-600'
              }`}
            >
              {item === 'fixed-schedule'
                ? 'Fixed Schedule'
                : item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>

        <div className="mt-auto">
          <button
            onClick={handleLogout}
            className="w-full bg-red-500 hover:bg-red-600 px-4 py-2 rounded transition"
          >
            Logout
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 top-16 bg-black/40 z-20 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu overlay"
        />
      )}

      {/* MAIN CONTENT */}
      <main className="ml-0 md:ml-64 flex-1 h-full overflow-y-auto p-4 md:p-8">

        <div className="mb-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            {mobileMenuOpen ? 'Close' : 'Menu'}
          </button>
        </div>

        {/* HEADER */}
        <section className="mb-10">
          <h1 className="text-3xl font-bold mb-2">
            Welcome, {displayName}.
          </h1>
        </section>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* HOME */}
        {activeSection === 'home' && (
          <>
            {report && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[ 
                  ['Total Bookings', report.totalBookings, 'green'],
                  ['Approved', report.approvedBookings, 'yellow'],
                  ['Attendance', report.attendedBookings, 'purple'],
                ].map(([label, value, color]) => (
                  <div
                    key={label}
                    className="bg-white text-gray-900 p-6 rounded-lg shadow-lg border border-gray-200"
                  >
                    <p className="text-sm text-gray-500">{label}</p>
                    <p className="text-4xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Pending Approvals</h2>

              {pendingLoading && <p className="text-gray-500">Loading…</p>}
              {pendingError && <p className="text-red-600">{pendingError}</p>}

              {!pendingLoading && pendingUsers.length === 0 && (
                <p className="text-gray-500">No pending users</p>
              )}

              {!pendingLoading && pendingUsers.length > 0 && (
                <div className="space-y-3">
                  {pendingUsers.map((pending) => (
                    <div
                      key={pending.email}
                      className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    >
                      <div>
                        <p className="font-semibold">{pending.name || 'Unnamed'}</p>
                        <p className="text-sm text-gray-600">{pending.email}</p>
                        <p className="text-xs text-gray-500 capitalize">{pending.role || 'student'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveUser(pending.email)}
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectUser(pending.email)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
              <h2 className="text-2xl font-bold mb-4">Attendance Queue ({selectedDate})</h2>

              {attendanceLoading && <p className="text-gray-500">Loading attendance...</p>}
              {attendanceError && <p className="text-red-600">{attendanceError}</p>}

              {!attendanceLoading && attendanceRows.length === 0 && (
                <p className="text-gray-500">No attendance records for this date.</p>
              )}

              {!attendanceLoading && attendanceRows.length > 0 && (
                <div className="space-y-3">
                  {attendanceRows.map((row) => {
                    const bookingId = row.bookingId || row.id;
                    const normalizedStatus = String(row.status || '').trim().toLowerCase();
                    const isTerminalStatus = normalizedStatus === 'attended' || normalizedStatus === 'missed';
                    const isUpdating = attendanceUpdatingId && String(attendanceUpdatingId) === String(bookingId);
                    const startLabel = formatClockTime(row.startTime, row.date);
                    const endLabel = formatClockTime(row.endTime, row.date);
                    return (
                      <div
                        key={bookingId}
                        className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                      >
                        <div>
                          <p className="font-semibold">{row.studentName || 'Unknown student'}</p>
                          <p className="text-sm text-gray-600">
                            {startLabel}
                            {' - '}
                            {endLabel}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">Status: {row.status || 'expected'}</p>
                        </div>

                        {isTerminalStatus ? (
                          <span
                            className={`px-3 py-1 rounded text-sm font-semibold ${
                              normalizedStatus === 'attended'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {normalizedStatus === 'attended' ? 'Attended' : 'Missed'}
                          </span>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMarkAttendance(bookingId, 'present')}
                              disabled={isUpdating}
                              className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-3 py-1 rounded transition"
                            >
                              Present
                            </button>
                            <button
                              onClick={() => handleMarkAttendance(bookingId, 'missed')}
                              disabled={isUpdating}
                              className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-3 py-1 rounded transition"
                            >
                              Missed
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* CALENDAR */}
        {activeSection === 'calendar' && (
          <>
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <label className="block font-bold mb-2">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="border rounded-lg px-4 py-2"
              />
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              {loading ? (
                <p className="text-gray-500">Loading…</p>
              ) : bookings.length === 0 ? (
                <p className="text-gray-500">No bookings</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        {['Name', 'Role', 'Grade Level', 'Section', 'Start Time', 'End Time', 'Seat', 'Subject', 'Purpose', 'Status'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => {
                        const startLabel = formatClockTime(b.startTime, b.date);
                        const endLabel = formatClockTime(b.endTime, b.date);
                        const seats = Array.isArray(b.seats)
                          ? b.seats
                          : b.seat
                            ? [b.seat]
                            : [];

                        return (
                          <tr key={b.id} className="border-b">
                            <td className="px-3 py-2 whitespace-nowrap">{b.studentName || '-'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{b.role || '-'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{b.gradeLevel || b.gradeLevelId || '-'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{b.section || b.sectionId || '-'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{startLabel}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{endLabel}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{seats.length > 0 ? seats.join(', ') : '-'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{b.subject || '-'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{b.purpose || '-'}</td>
                            <td className="px-3 py-2 whitespace-nowrap capitalize">{String(b.status || '-')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* REPORTS */}
        {activeSection === 'reports' && (
          <>
            <div className="flex gap-3 mb-6">
              {['weekly', 'monthly', 'yearly'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setReportTab(tab)}
                  className={`px-4 py-2 rounded-lg ${
                    reportTab === tab ? 'bg-blue-600 text-white' : 'bg-white border'
                  }`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              {reportTab === 'weekly' && (
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Start Date</label>
                    <input
                      type="date"
                      value={weeklyRange.startDate}
                      onChange={(e) => {
                        const startDate = e.target.value;
                        setWeeklyRange((prev) => ({
                          ...prev,
                          startDate,
                          endDate: computeWeeklyEndDate(startDate),
                        }));
                      }}
                      className="border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Auto End Date (7-day range)</label>
                    <div className="border rounded-lg px-3 py-2 bg-gray-50 text-gray-700">
                      {weeklyRange.endDate || '-'}
                    </div>
                  </div>
                </div>
              )}

              {reportTab === 'monthly' && (
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Month</label>
                    <select
                      value={monthlyConfig.month}
                      onChange={(e) =>
                        setMonthlyConfig((prev) => ({ ...prev, month: Number(e.target.value) }))
                      }
                      className="border rounded-lg px-3 py-2"
                    >
                      {Array.from({ length: 12 }, (_, idx) => idx + 1).map((month) => (
                        <option key={month} value={month}>
                          {new Date(2000, month - 1, 1).toLocaleString('default', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Year</label>
                    <input
                      type="number"
                      min="2000"
                      max="2100"
                      value={monthlyConfig.year}
                      onChange={(e) =>
                        setMonthlyConfig((prev) => ({ ...prev, year: Number(e.target.value) || prev.year }))
                      }
                      className="border rounded-lg px-3 py-2 w-32"
                    />
                  </div>
                </div>
              )}

              {reportTab === 'yearly' && (
                <div>
                  <label className="block text-sm font-semibold mb-1">Year</label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={yearlyYear}
                    onChange={(e) => setYearlyYear(Number(e.target.value) || yearlyYear)}
                    className="border rounded-lg px-3 py-2 w-32"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-3 mt-5">
                <button
                  onClick={
                    reportTab === 'weekly'
                      ? handleWeeklyGenerate
                      : reportTab === 'monthly'
                        ? handleMonthlyGenerate
                        : handleYearlyGenerate
                  }
                  disabled={reportLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg transition"
                >
                  {reportLoading ? 'Generating...' : 'Generate Report'}
                </button>
                <button
                  onClick={handleDownloadReport}
                  disabled={!activeReportData}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-lg transition"
                >
                  Download PDF
                </button>
              </div>
            </div>

            {reportError && (
              <div className="text-red-600 mb-4">{reportError}</div>
            )}

            <div>
              {reportTab === 'weekly' && <ReportGraph data={weeklyReport} />}
              {reportTab === 'monthly' && <ReportGraph data={monthlyReport} />}
              {reportTab === 'yearly' && <ReportGraph data={yearlyReport} />}
              <DetailCharts />
            </div>
          </>
        )}

        {/* ACCOUNTS */}
        {activeSection === 'accounts' && (
          <>
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h2 className="text-2xl font-bold">Account Management</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountTab('active')}
                    className={`px-3 py-2 rounded ${accountTab === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    Active Accounts
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountTab('deleted')}
                    className={`px-3 py-2 rounded ${accountTab === 'deleted' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    Deleted Accounts
                  </button>
                </div>
              </div>

              {accountsError && (
                <div className="mb-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded">
                  {accountsError}
                </div>
              )}

              {accountsLoading ? (
                <p className="text-gray-500">Loading accounts...</p>
              ) : accountTab === 'active' ? (
                accountUsers.length === 0 ? (
                  <p className="text-gray-500">No active accounts found.</p>
                ) : (
                  <div className="space-y-3">
                    {accountUsers.map((acct) => (
                      <div
                        key={acct.uid}
                        className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                      >
                        <div>
                          <p className="font-semibold">{acct.name || acct.email || acct.uid}</p>
                          <p className="text-sm text-gray-600">{acct.email || '-'}</p>
                          <p className="text-xs text-gray-500 capitalize">
                            {acct.role || 'user'} • {acct.status || 'approved'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(acct.uid, acct.name || acct.email || acct.uid)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded transition"
                        >
                          Delete Account
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                deletedAccountUsers.length === 0 ? (
                  <p className="text-gray-500">No deleted accounts yet.</p>
                ) : (
                  <div className="space-y-3">
                    {deletedAccountUsers.map((acct) => (
                      <div
                        key={acct.uid}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <p className="font-semibold">{acct.name || acct.email || acct.uid}</p>
                        <p className="text-sm text-gray-600">{acct.email || '-'}</p>
                        <p className="text-xs text-gray-500 capitalize">
                          {acct.role || 'user'} • Deleted: {formatFeedbackDate(acct.deletedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </>
        )}

        {/* SECTIONS */}
        {activeSection === 'sections' && (
          <>
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">Manage Sections</h2>
              {sectionsError && (
                <div className="mb-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded">
                  {sectionsError}
                </div>
              )}
              {sectionsMessage && (
                <div className="mb-4 bg-green-100 border border-green-300 text-green-700 px-4 py-2 rounded">
                  {sectionsMessage}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Grade Level</label>
                  <select
                    value={newSectionGradeId}
                    onChange={(e) => setNewSectionGradeId(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select grade level</option>
                    {gradeLevels.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.name || grade.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold mb-1">Section Name</label>
                  <div className="flex gap-2">
                    <input
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      placeholder="e.g. St. John the Baptist"
                      className="flex-1 border rounded-lg px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={handleAddSection}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                    >
                      Add Section
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Existing Sections</h3>
              {sectionsLoading ? (
                <p className="text-gray-500">Loading sections...</p>
              ) : (
                <div className="space-y-6">
                  {sectionsByGrade.map((grade) => (
                    <div key={grade.id} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-3">{grade.name || grade.id}</h4>
                      {grade.sections.length === 0 ? (
                        <p className="text-sm text-gray-500">No sections yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {grade.sections.map((item) => (
                            <div
                              key={item.id}
                              className="border border-gray-100 rounded px-3 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                            >
                              {editingSectionId === item.id ? (
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <select
                                    value={editSectionGradeId}
                                    onChange={(e) => setEditSectionGradeId(e.target.value)}
                                    className="border rounded px-2 py-1"
                                  >
                                    <option value="">Select grade level</option>
                                    {gradeLevels.map((gradeOpt) => (
                                      <option key={gradeOpt.id} value={gradeOpt.id}>
                                        {gradeOpt.name || gradeOpt.id}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    value={editSectionName}
                                    onChange={(e) => setEditSectionName(e.target.value)}
                                    className="border rounded px-2 py-1"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                </div>
                              )}

                              <div className="flex gap-2">
                                {editingSectionId === item.id ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={handleSaveSectionEdit}
                                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditingSection}
                                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded transition"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEditingSection(item)}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded transition"
                                  >
                                    Edit
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSection(item.id)}
                                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* FIXED SCHEDULE */}
        {activeSection === 'fixed-schedule' && (
          <>
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">Fixed Weekly Schedule</h2>
              <p className="text-sm text-gray-600 mb-4">
                Time slots in this table are blocked system-wide. If a slot is occupied here, students and teachers cannot create bookings for that period.
              </p>

              {seatAdminError && (
                <div className="mb-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded">
                  {seatAdminError}
                </div>
              )}
              {seatAdminMessage && (
                <div className="mb-4 bg-green-100 border border-green-300 text-green-700 px-4 py-2 rounded">
                  {seatAdminMessage}
                </div>
              )}

              <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left font-semibold px-3 py-2 border-b border-gray-200">Time</th>
                      {FIXED_SCHEDULE_DAYS.map((day) => (
                        <th key={day.dayOfWeek} className="text-left font-semibold px-3 py-2 border-b border-gray-200">
                          {day.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FIXED_SCHEDULE_TIME_SLOTS.map((slot) => (
                      <tr key={`${slot.startTime}-${slot.endTime}`} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-medium text-gray-700">{slot.label}</td>
                        {FIXED_SCHEDULE_DAYS.map((day) => {
                          const key = `${day.dayOfWeek}|${slot.startTime}|${slot.endTime}`;
                          const entries = fixedScheduleLookup.get(key) || [];
                          const entry = entries[0] || null;
                          const selected = Number(selectedFixedCell?.dayOfWeek) === day.dayOfWeek
                            && selectedFixedCell?.startTime === slot.startTime
                            && selectedFixedCell?.endTime === slot.endTime;
                          const displayText = entry
                            ? (entry.label || [entry.gradeLevel, entry.section, entry.teacherName].filter(Boolean).join(' - ') || 'Occupied')
                            : 'Available';
                          return (
                            <td key={key} className="px-3 py-2 align-top">
                              <button
                                type="button"
                                onClick={() => handleSelectFixedScheduleCell(day.dayOfWeek, slot.startTime, slot.endTime, entry)}
                                className={`w-full min-h-[64px] text-left border rounded px-2 py-2 transition ${
                                  selected
                                    ? 'border-blue-500 bg-blue-50'
                                    : entry
                                      ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                                      : 'border-gray-200 bg-white hover:bg-gray-50'
                                }`}
                              >
                                <p className={`text-xs ${entry ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
                                  {displayText}
                                </p>
                                {entry?.teacherName && (
                                  <p className="text-[11px] text-gray-600 mt-1">
                                    Teacher: {entry.teacherName}
                                  </p>
                                )}
                                {entries.length > 1 && (
                                  <p className="text-[11px] text-red-600 mt-1">
                                    {entries.length} entries in this slot
                                  </p>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Selected Day</label>
                  <div className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-700">{selectedFixedDayLabel}</div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Start</label>
                  <div className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-700">{selectedFixedCell.startTime}</div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">End</label>
                  <div className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-700">{selectedFixedCell.endTime}</div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Grade Level</label>
                  <select
                    value={fixedScheduleGradeId}
                    onChange={(e) => {
                      setFixedScheduleGradeId(e.target.value);
                      setFixedScheduleSectionId('');
                    }}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select grade level</option>
                    {gradeLevels.map((grade) => (
                      <option key={grade.id} value={grade.id}>{grade.name || grade.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Section</label>
                  <select
                    value={fixedScheduleSectionId}
                    onChange={(e) => setFixedScheduleSectionId(e.target.value)}
                    disabled={!fixedScheduleGradeId}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">{fixedScheduleGradeId ? 'Select section' : 'Select grade first'}</option>
                    {fixedScheduleSectionOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.name || item.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Teacher</label>
                  <select
                    value={fixedScheduleTeacherId}
                    onChange={(e) => setFixedScheduleTeacherId(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select teacher</option>
                    {fixedScheduleTeacherOptions.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name || teacher.email || teacher.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={handleSaveFixedScheduleEntry}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition"
                  >
                    {editingFixedScheduleId ? 'Update Slot' : 'Save Slot'}
                  </button>
                  {editingFixedScheduleId && (
                    <button
                      type="button"
                      onClick={() => handleDeleteFixedScheduleEntry(editingFixedScheduleId)}
                      className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
                    >
                      Remove Slot
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={resetFixedScheduleForm}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
                >
                  Clear Selection
                </button>
              </div>
              {editingFixedScheduleId && (
                <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  Editing existing slot. Choose new Grade/Section/Teacher then click Update Slot, or Remove Slot.
                </div>
              )}
            </div>
          </>
        )}

        {/* SEAT CONTROLS */}
        {activeSection === 'seats' && (
          <>
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">Seat Controls</h2>
              <p className="text-sm text-gray-600 mb-4">
                Layout matches Student booking. Use auto-add buttons per side to keep seat names uppercase like A1, A2, A3.
              </p>

              {seatAdminError && (
                <div className="mb-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded">
                  {seatAdminError}
                </div>
              )}
              {seatAdminMessage && (
                <div className="mb-4 bg-green-100 border border-green-300 text-green-700 px-4 py-2 rounded">
                  {seatAdminMessage}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3">Left Side Controls</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddRightSeat('left')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition"
                    >
                      Add Column to the Last Seat
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddLastSeatPerSide('left')}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg transition"
                    >
                      Add Row
                    </button>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3">Right Side Controls</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddRightSeat('right')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition"
                    >
                      Add Column to the Last Seat
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddLastSeatPerSide('right')}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg transition"
                    >
                      Add Row
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Insert Seat at Position</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Use this to add a seat in a missing spot on an existing row (example: add A2 when A1 and A3 exist).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Detected Side</label>
                    <div className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-700">
                      {detectRowSide(insertSeatRow) || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Row (A-Z)</label>
                    <input
                      value={insertSeatRow}
                      maxLength={1}
                      onChange={(e) => setInsertSeatRow(e.target.value.toUpperCase())}
                      placeholder="A"
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Column (1-99)</label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={insertSeatColumn}
                      onChange={(e) => setInsertSeatColumn(e.target.value)}
                      placeholder="2"
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end">
                    <button
                      type="button"
                      onClick={handleInsertSeatAtPosition}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition"
                    >
                      Insert Seat
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold mb-4">Left Side Seats</h3>
                {seatAdminLoading ? (
                  <p className="text-gray-500">Loading seats...</p>
                ) : leftSeatRows.length === 0 ? (
                  <p className="text-gray-500">No seats on left side.</p>
                ) : (
                  <div className="space-y-3">
                    {leftSeatRows.map((row) => (
                      <div key={`left-row-${row.row}`} className="flex items-center gap-2 flex-wrap">
                        {row.seats.map((seat) => (
                          <button
                            key={seat.id}
                            type="button"
                            title={`Delete ${seat.id}`}
                            onClick={() => handleDeleteSeatCatalogItem(seat.id)}
                            className="w-10 h-10 rounded border-2 border-blue-700 bg-white text-xs font-bold text-blue-900 hover:bg-red-50 hover:border-red-500 hover:text-red-700 transition"
                          >
                            {seat.id}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold mb-4">Right Side Seats</h3>
                {seatAdminLoading ? (
                  <p className="text-gray-500">Loading seats...</p>
                ) : rightSeatRows.length === 0 ? (
                  <p className="text-gray-500">No seats on right side.</p>
                ) : (
                  <div className="space-y-3">
                    {rightSeatRows.map((row) => (
                      <div key={`right-row-${row.row}`} className="flex items-center gap-2 flex-wrap">
                        {row.seats.map((seat) => (
                          <button
                            key={seat.id}
                            type="button"
                            title={`Delete ${seat.id}`}
                            onClick={() => handleDeleteSeatCatalogItem(seat.id)}
                            className="w-10 h-10 rounded border-2 border-blue-700 bg-white text-xs font-bold text-blue-900 hover:bg-red-50 hover:border-red-500 hover:text-red-700 transition"
                          >
                            {seat.id}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h3 className="text-xl font-bold mb-4">Block Seat For Time Period</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Seat</label>
                  <select
                    value={newBlockSeatId}
                    onChange={(e) => setNewBlockSeatId(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select seat</option>
                    {seatCatalogAdmin.map((seat) => (
                      <option key={seat.id} value={seat.id}>{seat.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newBlockStartTime}
                    onChange={(e) => setNewBlockStartTime(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">End Time</label>
                  <input
                    type="time"
                    value={newBlockEndTime}
                    onChange={(e) => setNewBlockEndTime(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleCreateSeatBlock}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg transition"
                  >
                    Block Seat
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-semibold mb-1">Reason (Optional)</label>
                <input
                  value={newBlockReason}
                  onChange={(e) => setNewBlockReason(e.target.value)}
                  placeholder="e.g. maintenance"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Seat Blocks On {blockDate || 'Selected Date'}</h3>
              {seatAdminLoading ? (
                <p className="text-gray-500">Loading blocks...</p>
              ) : seatBlocksAdmin.length === 0 ? (
                <p className="text-gray-500">No blocks for this date.</p>
              ) : (
                <div className="space-y-2">
                  {seatBlocksAdmin.map((block) => (
                    <div key={block.id} className="border border-gray-100 rounded px-3 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        {(() => {
                          const startLabel = formatClockTime(block.startTime, block.date, 'Invalid');
                          const endLabel = formatClockTime(block.endTime, block.date, 'Invalid');
                          return (
                            <p className="font-medium">
                              {block.seatId} {startLabel} - {endLabel}
                            </p>
                          );
                        })()}
                        {block.reason && <p className="text-sm text-gray-600">{block.reason}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSeatBlock(block.id)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition"
                      >
                        Remove Block
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </main>
    </div>
  );
}