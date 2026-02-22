import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { seatsAPI, feedbackAPI, notificationAPI } from '../utils/api';
import SeatBooking from '../components/SeatBooking';
import { logoutUser } from '../utils/auth';
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

const TERMINAL_BOOKING_STATUSES = new Set(['cancelled', 'rejected', 'attended', 'absent', 'missed']);

export default function TeacherDashboard({ user, userName }) {
  const [bookings, setBookings] = useState([]);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [classError, setClassError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [activeSection, setActiveSection] = useState('home');
  const [pendingCancelId, setPendingCancelId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      await fetchBookings();
      await fetchClasses();
      await fetchNotifications();
    };
    load();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await seatsAPI.getMySeats();
      setBookings(response.data.data || []);
    } catch (err) {
      setError('Failed to load bookings');
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await seatsAPI.getMyFixedSchedule();
      setClasses(response.data.data || []);
    } catch (err) {
      setClassError('Failed to load assigned class schedule');
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await notificationAPI.getMine(20);
      setNotifications(response.data.data || []);
    } catch (err) {
      setNotifications([]);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      await seatsAPI.cancelSeatBooking(bookingId);
      await fetchBookings();
      setPendingCancelId(null);
    } catch (err) {
      setError('Failed to cancel booking');
      setPendingCancelId(null);
    }
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

  const getAttendanceDeadline = (booking) => {
    const start = toDate(booking?.startTime);
    if (!start) return null;
    const stored = toDate(booking?.attendanceDeadlineAt);
    if (stored) return stored;
    return new Date(start.getTime() + 15 * 60 * 1000);
  };

  const canConfirmAttendance = (booking) => {
    const status = String(booking?.status || '').toLowerCase();
    if (status !== 'approved') return false;
    const now = new Date();
    const start = toDate(booking?.startTime);
    const deadline = getAttendanceDeadline(booking);
    if (!start || !deadline) return false;
    return now >= start && now <= deadline;
  };

  const handleConfirmAttendance = async (bookingId) => {
    try {
      await seatsAPI.confirmAttendance(bookingId);
      await fetchBookings();
      await fetchNotifications();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to confirm attendance');
    }
  };

  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) {
      setFeedbackStatus('Please enter your feedback.');
      return;
    }

    feedbackAPI.submitFeedback(feedbackMessage.trim(), 'general', 'teacher-dashboard')
      .then(() => {
        setFeedbackMessage('');
        setFeedbackStatus('Thanks! Your feedback was submitted.');
      })
      .catch(() => {
        setFeedbackStatus('Failed to submit feedback. Please try again.');
      });
  };

  const classLookup = classes.reduce((map, entry) => {
    if (!entry || entry.active === false) return map;
    const key = `${entry.dayOfWeek}|${entry.startTime}|${entry.endTime}`;
    if (!map[key]) map[key] = [];
    map[key].push(entry);
    return map;
  }, {});

  return (
    <div
      className="-m-6 h-[calc(100vh-64px)] flex overflow-hidden bg-cover bg-center"
      style={{
        backgroundImage: `url(${backgroundLdc})`,
      }}
    >
      <aside className={`fixed left-0 top-16 bottom-0 w-64 bg-blue-700 text-white flex flex-col px-6 pt-6 pb-6 overflow-y-auto z-30 transform transition-transform duration-200 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-3 rounded-lg bg-white p-2">
          <img
            src={logoName}
            alt="Liceo logo and name"
            className="h-9 w-auto object-contain"
          />
        </div>
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-sm text-blue-100 mb-8">
          {userName || user?.displayName || user?.name || 'Teacher'}
        </p>

        <nav className="space-y-3">
          {['home', 'booking', 'classes', 'feedback'].map((section) => (
            <button
              key={section}
              onClick={() => {
                setActiveSection(section);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-2 rounded transition ${
                activeSection === section
                  ? 'bg-blue-600'
                  : 'hover:bg-blue-600'
              }`}
            >
              {section === 'home' && 'Home'}
              {section === 'booking' && 'Booking'}
              {section === 'classes' && 'Class Schedule'}
              {section === 'feedback' && 'Feedback'}
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

      <main className="ml-0 md:ml-64 flex-1 h-full overflow-y-auto p-4 md:p-8">
        <div className="mb-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            {mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
          </button>
        </div>
        {activeSection === 'home' && (
          <section className="mb-12">
            <h1 className="text-3xl font-bold mb-2">
              Welcome, {userName || user?.displayName || user?.name || 'Teacher'}.
            </h1>
            <p className="text-gray-600 mb-6">
              Here is a quick summary of your schedule.
            </p>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <StatCard label="Total Bookings" value={bookings.length} />
              <StatCard
                label="Upcoming"
                value={bookings.filter(
                  (b) =>
                    !TERMINAL_BOOKING_STATUSES.has(String(b?.status || '').toLowerCase())
                    && new Date(b.startTime) > new Date()
                ).length}
              />
              <StatCard
                label="Today"
                value={bookings.filter(
                  (b) =>
                    b.date ===
                    new Date().toISOString().split('T')[0]
                ).length}
              />
            </div>

            <StatCard label="Assigned Class Slots" value={classes.length} />

            <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
              <h2 className="text-xl font-bold mb-2">Notifications</h2>
              {notifications.length === 0 ? (
                <p className="text-gray-600">No new notifications yet.</p>
              ) : (
                <div className="space-y-2">
                  {notifications.map((entry) => (
                    <div
                      key={entry.id}
                      className={`border rounded px-3 py-2 ${
                        entry.severity === 'warning'
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <p className="text-sm font-semibold">{entry.title || 'Notification'}</p>
                      <p className="text-sm text-gray-700">{entry.message || '-'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
              <h3 className="text-xl font-bold mb-3">My Bookings</h3>
              {bookings.length === 0 ? (
                <p className="text-gray-600">No bookings yet.</p>
              ) : (
                <div className="space-y-3">
                  {bookings.map((booking) => {
                    const start = toDate(booking.startTime);
                    const end = toDate(booking.endTime);
                    const seats = Array.isArray(booking.seats)
                      ? booking.seats
                      : booking.seat
                        ? [booking.seat]
                        : [];
                    const status = String(booking.status || 'pending').toLowerCase();
                    const canCancel = !TERMINAL_BOOKING_STATUSES.has(status);
                    const canConfirm = canConfirmAttendance(booking);

                    return (
                      <div key={booking.id} className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {booking.date || '-'}{' '}
                            {start ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            {' - '}
                            {end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </p>
                          <p className="text-sm text-gray-600">Seat: {seats.length > 0 ? seats.join(', ') : '-'}</p>
                          <p className="text-xs text-gray-500 capitalize">Status: {status}</p>
                        </div>

                        <div className="flex gap-2">
                          {canConfirm && (
                            <button
                              type="button"
                              onClick={() => handleConfirmAttendance(booking.id)}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition"
                            >
                              Confirm Attendance
                            </button>
                          )}
                          {canCancel && (
                            <button
                              type="button"
                              onClick={() => setPendingCancelId(booking.id)}
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {activeSection === 'booking' && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Booking</h2>
            <SeatBooking
              userName={userName || user?.displayName || user?.name || 'Teacher'}
              onBookingCreated={fetchBookings}
              hideAcademicFields
            />
          </section>
        )}

        {pendingCancelId && (
          <div className="fixed inset-0 z-30 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-bold mb-2">Cancel Booking</h3>
              <p className="text-sm text-gray-600 mb-4">Are you sure you want to cancel this booking?</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingCancelId(null)}
                  className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-800"
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={() => handleCancelBooking(pendingCancelId)}
                  className="px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-white"
                >
                  Confirm Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'classes' && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Class Schedule</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Schedule is managed by admin. Teachers have read-only access.
            </p>

            {classError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {classError}
              </div>
            )}

            {classes.length === 0 ? (
              <p className="text-gray-500">No admin-assigned classes yet.</p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
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
                          const entries = classLookup[key] || [];
                          const entry = entries[0] || null;
                          const displayText = entry
                            ? (entry.label || [entry.gradeLevel, entry.section, entry.teacherName].filter(Boolean).join(' - ') || 'Occupied')
                            : 'Available';

                          return (
                            <td key={key} className="px-3 py-2 align-top">
                              <div
                                className={`w-full min-h-[64px] text-left border rounded px-2 py-2 ${
                                  entry
                                    ? 'border-amber-300 bg-amber-50'
                                    : 'border-gray-200 bg-white'
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
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeSection === 'feedback' && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Feedback</h2>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <form
                onSubmit={handleFeedbackSubmit}
                className="space-y-4"
              >
                <textarea
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  rows={4}
                  className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-400"
                  placeholder="Tell us about your experience..."
                />
                {feedbackStatus && (
                  <p className="text-sm text-blue-600">{feedbackStatus}</p>
                )}
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                >
                  Submit Feedback
                </button>
              </form>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}