import React, { useEffect, useMemo, useState } from 'react';
import { seatsAPI } from '../utils/api';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import './SeatBooking.css';

const parseTime = (timeStr) => {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h + m / 60;
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

const toTimeFloat = (value) => {
  const date = toDate(value);
  if (!date) return null;
  return date.getHours() + date.getMinutes() / 60;
};

const normalizeSeatCatalog = (catalog) => {
  return (Array.isArray(catalog) ? catalog : [])
    .map((seat) => {
      const rawId = String(seat?.id || '').trim().toUpperCase();
      const idMatch = rawId.match(/^([A-Z])(\d+)$/);

      let row = String(seat?.row || '').trim().toUpperCase();
      let column = Number(seat?.column);

      if (idMatch) {
        row = idMatch[1];
        column = Number(idMatch[2]);
      }

      if (!/^[A-Z]$/.test(row)) return null;
      if (!Number.isInteger(column) || column < 1) return null;

      const id = `${row}${column}`;
      return {
        ...seat,
        id,
        row,
        column,
        side: String(seat?.side || '').toLowerCase() === 'right' ? 'right' : 'left',
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.row).localeCompare(String(b.row)) || Number(a.column) - Number(b.column));
};

const BOOKING_START_TIME_OPTIONS = [
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '10:15', label: '10:15 AM' },
  { value: '11:15', label: '11:15 AM' },
  { value: '12:15', label: '12:15 PM' },
  { value: '12:45', label: '12:45 PM' },
  { value: '13:45', label: '1:45 PM' },
  { value: '14:45', label: '2:45 PM' },
  { value: '15:00', label: '3:00 PM' },
];

const BOOKING_END_TIME_OPTIONS = [
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '10:15', label: '10:15 AM' },
  { value: '11:15', label: '11:15 AM' },
  { value: '12:15', label: '12:15 PM' },
  { value: '12:45', label: '12:45 PM' },
  { value: '13:45', label: '1:45 PM' },
  { value: '14:45', label: '2:45 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
];

const ACTIVE_BOOKING_STATUSES = new Set(['pending', 'approved']);
const isActiveBookingStatus = (status) => ACTIVE_BOOKING_STATUSES.has(String(status || '').toLowerCase());
const isWeekendDate = (dateKey) => {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const utcDate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const day = utcDate.getUTCDay();
  return day === 0 || day === 6;
};

export default function SeatBooking({ userName, onBookingCreated, hideAcademicFields = false }) {
  const toLocalDateKey = (dateObj = new Date()) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // STATE: form + availability
  const [name, setName] = useState(userName || '');
  const [selectedSeat, setSelectedSeat] = useState('');
  const [bookedSeats, setBookedSeats] = useState([]);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [subject, setSubject] = useState(''); // Added missing state
  const [subjectsList, setSubjectsList] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [sections, setSections] = useState([]);
  const [seatCatalog, setSeatCatalog] = useState([]);
  const [, setSeatBlocks] = useState([]);
  const [gradeLevelId, setGradeLevelId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isFixedScheduleBlocked, setIsFixedScheduleBlocked] = useState(false);

  // Set initial name
  useEffect(() => {
    setName(userName || '');
  }, [userName]);

  // Fetch subjects from backend via seatsAPI
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await seatsAPI.getSubjects();
        if (res.data.success) setSubjectsList(res.data.subjects);
      } catch (err) {
        console.error('Failed to fetch subjects', err);
        setSubjectsList([]);
      }
    };
    fetchSubjects();
  }, []);

  useEffect(() => {
    const fetchAcademicData = async () => {
      try {
        const [gradeSnap, sectionSnap] = await Promise.all([
          getDocs(collection(db, 'gradeLevels')),
          getDocs(collection(db, 'sections')),
        ]);

        const gradeData = gradeSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((item) => item.active !== false)
          .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));

        const sectionData = sectionSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((item) => item.active !== false)
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

        setGradeLevels(gradeData);
        setSections(sectionData);
      } catch (err) {
        console.error('Failed to fetch grade levels/sections', err);
      }
    };

    fetchAcademicData();
  }, []);

  useEffect(() => {
    const fetchSeatCatalog = async () => {
      try {
        const res = await seatsAPI.getSeatCatalog();
        setSeatCatalog(normalizeSeatCatalog(res.data.data || []));
      } catch (err) {
        console.error('Failed to fetch seat catalog', err);
        setSeatCatalog([]);
      }
    };

    fetchSeatCatalog();
  }, []);

  // Parse selected time range
  const selectedRange = useMemo(() => ({
    start: parseTime(startTime),
    end: parseTime(endTime),
  }), [startTime, endTime]);

  const filteredSections = useMemo(
    () => sections.filter((item) => item.gradeLevelId === gradeLevelId),
    [sections, gradeLevelId]
  );

  const leftSeats = useMemo(
    () => seatCatalog
      .filter((seat) => (seat.side || '').toLowerCase() === 'left')
      .sort((a, b) => String(a.row || '').localeCompare(String(b.row || '')) || Number(a.column || 0) - Number(b.column || 0)),
    [seatCatalog]
  );

  const rightSeats = useMemo(
    () => seatCatalog
      .filter((seat) => (seat.side || '').toLowerCase() === 'right')
      .sort((a, b) => String(a.row || '').localeCompare(String(b.row || '')) || Number(a.column || 0) - Number(b.column || 0)),
    [seatCatalog]
  );

  const groupSeatsByRow = (seats) => {
    const grouped = seats.reduce((acc, seat) => {
      const rowKey = String(seat.row || '').toUpperCase();
      if (!acc[rowKey]) acc[rowKey] = [];
      acc[rowKey].push(seat);
      return acc;
    }, {});

    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((row) => ({
        row,
        seats: grouped[row].sort((a, b) => Number(a.column || 0) - Number(b.column || 0)),
      }));
  };

  const leftSeatRows = useMemo(() => groupSeatsByRow(leftSeats), [leftSeats]);
  const rightSeatRows = useMemo(() => groupSeatsByRow(rightSeats), [rightSeats]);
  const endTimeOptions = useMemo(
    () => BOOKING_END_TIME_OPTIONS.filter((option) => !startTime || option.value > startTime),
    [startTime]
  );

  useEffect(() => {
    if (endTime && startTime && endTime <= startTime) {
      setEndTime('');
    }
  }, [startTime, endTime]);

  // Fetch booked seats and check conflicts
  const fetchSeats = async () => {
    if (!date || selectedRange.start == null || selectedRange.end == null) return;

    try {
      const res = await seatsAPI.getSeatAvailability(date, startTime, endTime);
      const data = res.data.data || {};
      const bookings = data.bookings || [];
      const classes = data.classes || [];
      const catalog = normalizeSeatCatalog(data.seats || []);
      const blocks = data.seatBlocks || [];
      const fixedScheduleBlocks = data.fixedScheduleBlocks || [];
      const booked = [];
      const blockedByAdmin = [];

      setSeatCatalog(catalog);
      setSeatBlocks(blocks);
      setIsFixedScheduleBlocked(false);

      // Check class conflicts
      const classConflict = classes.some((cls) => {
        const bookedStart = toTimeFloat(cls.startTime);
        const bookedEnd = toTimeFloat(cls.endTime);
        if (bookedStart == null || bookedEnd == null) return false;
        return selectedRange.start < bookedEnd && selectedRange.end > bookedStart;
      });

      if (classConflict) {
        setBookedSeats([]);
        setStatusMessage('Class is scheduled during this time. Booking will be rejected.');
        return;
      }

      const fixedScheduleConflict = fixedScheduleBlocks.find((block) => {
        // Prefer stored HH:mm values to avoid timezone shifts from Date serialization.
        const blockStart = parseTime(block.startTime) ?? toTimeFloat(block.startDateTime || `${date}T${block.startTime}:00`);
        const blockEnd = parseTime(block.endTime) ?? toTimeFloat(block.endDateTime || `${date}T${block.endTime}:00`);
        if (blockStart == null || blockEnd == null) return false;
        return selectedRange.start < blockEnd && selectedRange.end > blockStart;
      });

      if (fixedScheduleConflict) {
        setIsFixedScheduleBlocked(true);
        setBookedSeats(catalog.map((seat) => seat.id));
        setStatusMessage('Time slot is occupied by fixed schedule. Select other time.');
        return;
      }

      // Check seat bookings
      bookings.forEach((booking) => {
        const status = (booking.status || '').toLowerCase();
        if (!isActiveBookingStatus(status)) return;

        const bookedStart = toTimeFloat(booking.startTime);
        const bookedEnd = toTimeFloat(booking.endTime);
        if (bookedStart == null || bookedEnd == null) return;

        if (selectedRange.start < bookedEnd && selectedRange.end > bookedStart) {
          const seats = Array.isArray(booking.seats)
            ? booking.seats
            : booking.seat
              ? [booking.seat]
              : [];
          booked.push(...seats);
        }
      });

      blocks.forEach((block) => {
        const blockStart = toTimeFloat(block.startTime);
        const blockEnd = toTimeFloat(block.endTime);
        if (blockStart == null || blockEnd == null) return;

        if (selectedRange.start < blockEnd && selectedRange.end > blockStart && block.seatId) {
          blockedByAdmin.push(block.seatId);
        }
      });

      setBookedSeats([...new Set([...booked, ...blockedByAdmin])]);
      setStatusMessage('');
    } catch (err) {
      setBookedSeats([]);
      setIsFixedScheduleBlocked(false);
    }
  };

  // Fetch seats whenever date/time changes
  useEffect(() => {
    fetchSeats();
  }, [date, startTime, endTime]);

  // Toggle seat selection
  const toggleSeat = (seat) => {
    if (bookedSeats.includes(seat)) return;
    setSelectedSeat((prev) => (prev === seat ? '' : seat));
  };

  // Handle booking submission
  const handleBooking = async () => {
    setIsFixedScheduleBlocked(false);
    const trimmedName = name.trim();
    const trimmedPurpose = purpose.trim();
    const trimmedSubject = subject.trim();
    const selectedGrade = gradeLevels.find((item) => item.id === gradeLevelId);
    const selectedSection = sections.find((item) => item.id === sectionId);
    const needsAcademicFields = !hideAcademicFields;

    if (!trimmedName || !selectedSeat || !date || !startTime || !endTime || !trimmedPurpose || !trimmedSubject) {
      setStatusMessage('Please fill all required fields and select a seat.');
      return;
    }

    if (needsAcademicFields && (!selectedGrade || !selectedSection)) {
      setStatusMessage('Please fill all required fields and select a seat.');
      return;
    }

    if (startTime >= endTime) {
      setStatusMessage('End Time must be after Start Time.');
      return;
    }

    const now = new Date();
    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);

    if (isWeekendDate(date)) {
      setStatusMessage('Weekend booking is not allowed. Please select Monday to Friday.');
      return;
    }

    if (startDateTime < now) {
      setStatusMessage('Cannot book past date/time.');
      return;
    }

    try {
      const myBookingsResponse = await seatsAPI.getMySeats();
      const myBookings = Array.isArray(myBookingsResponse?.data?.data) ? myBookingsResponse.data.data : [];

      const dailyBookingsCount = myBookings.filter((booking) => {
        if (!isActiveBookingStatus(booking?.status)) return false;
        return booking?.date === date;
      }).length;

      if (dailyBookingsCount >= 2) {
        setStatusMessage('Booking limit reached. You can only create up to 2 bookings per day.');
        return;
      }

      const createResponse = await seatsAPI.createSeatBooking({
        name: trimmedName,
        seats: [selectedSeat],
        date,
        startTime: `${date}T${startTime}:00`,
        endTime: `${date}T${endTime}:00`,
        purpose: trimmedPurpose,
        subject: trimmedSubject,
        gradeLevelId: selectedGrade?.id || null,
        gradeLevel: selectedGrade?.name || selectedGrade?.id || null,
        sectionId: selectedSection?.id || null,
        section: selectedSection?.name || selectedSection?.id || null,
      });

      if (createResponse?.data?.success === false) {
        throw new Error(createResponse?.data?.message || 'Booking failed. Please try again.');
      }

      setStatusMessage('Booking successful!');
      setSelectedSeat('');
      setPurpose('');
      setSubject('');
      setGradeLevelId('');
      setSectionId('');
      fetchSeats();
      if (onBookingCreated) onBookingCreated();
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Booking failed. Please try again.';
      const details = err.response?.data?.error;
      if (Array.isArray(details) && details.length > 0) {
        setStatusMessage(`${message}: ${details.join(', ')}`);
      } else {
        setStatusMessage(message);
      }
    }
  };

  // Render individual seat button
  const renderSeat = (seat) => {
    const seatId = seat.id || `${seat.row}${seat.column}`;
    const isBooked = bookedSeats.includes(seatId);
    const isSelected = selectedSeat === seatId;

    return (
      <button
        key={seatId}
        className={`seat ${isSelected ? 'selected' : ''} ${isBooked ? 'booked' : ''}`}
        disabled={isBooked}
        onClick={() => toggleSeat(seatId)}
        type="button"
      >
        {seatId}
      </button>
    );
  };

  return (
    <div className="seat-booking">
      <h2>Seat Booking</h2>
      {statusMessage && (
        <p className={`status-message ${isFixedScheduleBlocked ? 'fixed-schedule-alert' : ''}`}>
          {statusMessage}
        </p>
      )}

      <div className="seat-sections">
        <div className="section">
          <div className="seats-grid first-half">
            {leftSeatRows.map((row) => (
              <div key={`left-${row.row}`} className="seats-row">
                {row.seats.map(renderSeat)}
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="seats-grid second-half">
            {rightSeatRows.map((row) => (
              <div key={`right-${row.row}`} className="seats-row">
                {row.seats.map(renderSeat)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="form-grid">
        <div className="full-span">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label>Date</label>
          <input
            type="date"
            value={date}
            min={toLocalDateKey()}
            onChange={(e) => {
              const nextDate = e.target.value;
              setDate(nextDate);
              if (isWeekendDate(nextDate)) {
                setStatusMessage('Weekend booking is not allowed. Please select Monday to Friday.');
              } else if (statusMessage.includes('Weekend booking is not allowed')) {
                setStatusMessage('');
              }
            }}
          />
        </div>

        <div>
          <label>Purpose</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </div>

        {!hideAcademicFields && (
          <>
            <div>
              <label>Grade Level</label>
              <select
                value={gradeLevelId}
                onChange={(e) => {
                  setGradeLevelId(e.target.value);
                  setSectionId('');
                }}
                required
              >
                <option value="">Select grade level</option>
                {gradeLevels.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name || grade.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Section</label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                disabled={!gradeLevelId}
                required
              >
                <option value="">{gradeLevelId ? 'Select section' : 'Select grade level first'}</option>
                {filteredSections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || item.id}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div>
          <label>Start Time</label>
          <select
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          >
            <option value="">Select start time</option>
            {BOOKING_START_TIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>End Time</label>
          <select
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          >
            <option value="">Select end time</option>
            {endTimeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="full-span">
          <label>Subject</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          >
            <option value="">Select a subject</option>
            {subjectsList.map(subj => (
              <option key={subj} value={subj}>{subj}</option>
            ))}
          </select>
        </div>
      </div>

      <button className="book-btn" onClick={handleBooking} type="button">
        Book Now
      </button>
    </div>
  );
}