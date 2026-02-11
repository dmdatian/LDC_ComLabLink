import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { seatsAPI, feedbackAPI } from '../utils/api';
import SeatBooking from '../components/SeatBooking';
import { logoutUser } from '../utils/auth';
import logoName from '../assets/logo_name.png';

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

export default function TeacherDashboard({ user, userName }) {
  const [bookings, setBookings] = useState([]);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [classError, setClassError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [activeSection, setActiveSection] = useState('home');
  const navigate = useNavigate();

  useEffect(() => {
    fetchBookings();
    fetchClasses();
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

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
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
    <div className="fixed inset-0 flex overflow-hidden">
      <aside className="fixed left-0 inset-y-0 w-64 bg-blue-700 text-white flex flex-col px-6 pt-6 pb-6 overflow-y-auto">
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
              onClick={() => setActiveSection(section)}
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

      <main className="ml-64 flex-1 h-full overflow-y-auto p-8 bg-white-100">
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
                  (b) => new Date(b.startTime) > new Date()
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
              <p className="text-gray-600">No new notifications yet.</p>
            </div>
          </section>
        )}

        {activeSection === 'booking' && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Booking</h2>
            <SeatBooking
              userName={userName || user?.displayName || user?.name || 'Teacher'}
              onBookingCreated={fetchBookings}
            />
          </section>
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
              <div className="overflow-x-auto border border-blue-200 rounded-lg shadow-sm">
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-blue-600 text-white">
                    <tr>
                      <th className="text-left font-semibold px-3 py-2 border-b border-blue-500 w-36">Time</th>
                      {FIXED_SCHEDULE_DAYS.map((day) => (
                        <th key={day.dayOfWeek} className="text-left font-semibold px-3 py-2 border-b border-blue-500">
                          {day.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FIXED_SCHEDULE_TIME_SLOTS.map((slot) => (
                      <tr key={`${slot.startTime}-${slot.endTime}`} className="border-b border-blue-100 even:bg-blue-50/30">
                        <td className="px-3 py-2 font-medium text-slate-700 bg-slate-50">{slot.label}</td>
                        {FIXED_SCHEDULE_DAYS.map((day) => {
                          const key = `${day.dayOfWeek}|${slot.startTime}|${slot.endTime}`;
                          const entries = classLookup[key] || [];
                          const entry = entries[0] || null;
                          return (
                            <td key={key} className="px-3 py-2 align-top">
                              {entry ? (
                                <div className="w-full min-h-[74px] border border-emerald-200 bg-emerald-50 rounded px-2 py-2 text-[11px] leading-4">
                                  <p className="truncate"><span className="font-semibold text-emerald-800">Grade:</span> {entry.gradeLevel || entry.gradeLevelId || '-'}</p>
                                  <p className="truncate"><span className="font-semibold text-emerald-800">Section:</span> {entry.section || entry.sectionId || '-'}</p>
                                  <p className="truncate"><span className="font-semibold text-emerald-800">Teacher:</span> {entry.teacherName || '-'}</p>
                                </div>
                              ) : (
                                <div className="w-full min-h-[74px] border border-gray-200 bg-white rounded px-2 py-2 text-[11px] text-gray-400">
                                  <p>Grade: -</p>
                                  <p>Section: -</p>
                                  <p>Teacher: -</p>
                                </div>
                              )}
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
