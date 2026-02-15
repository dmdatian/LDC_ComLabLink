import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { seatsAPI, feedbackAPI, notificationAPI } from '../utils/api';
// BOOKING COMPONENT: add/replace your booking UI file here
import SeatBooking from '../components/SeatBooking';
import { logoutUser } from '../utils/auth';
import logoName from '../assets/logo_name.png';
import backgroundLdc from '../assets/background_ldc.jpg';

export default function StudentDashboard({ user, userName }) {
  // STATE: bookings + UI
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [activeSection, setActiveSection] = useState('home');
  const [pendingCancelId, setPendingCancelId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const toDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value.seconds) return new Date(value.seconds * 1000);
    if (value._seconds) return new Date(value._seconds * 1000);
    if (value.toDate) return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  // EFFECTS: initial data
  useEffect(() => {
    fetchBookings();
    fetchNotifications();
  }, []);

  // BOOKINGS API: fetch
  const fetchBookings = async () => {
    try {
      const response = await seatsAPI.getMySeats();
      setBookings(response.data.data || []);
    } catch (err) {
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
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

  // BOOKINGS API: cancel
  const handleCancelBooking = async (bookingId) => {
    try {
      await seatsAPI.cancelSeatBooking(bookingId);
      setBookings(bookings.filter(b => b.id !== bookingId));
      setPendingCancelId(null);
    } catch (err) {
      setError('Failed to cancel booking');
      setPendingCancelId(null);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  // FEEDBACK: submit
  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) {
      setFeedbackStatus('Please enter your feedback.');
      return;
    }

    feedbackAPI.submitFeedback(feedbackMessage.trim(), 'general', 'student-dashboard')
      .then(() => {
        setFeedbackMessage('');
        setFeedbackStatus('Thanks! Your feedback was submitted.');
      })
      .catch(() => {
        setFeedbackStatus('Failed to submit feedback. Please try again.');
      });
  };

  return (
    <div
      className="-m-6 h-[calc(100vh-64px)] flex overflow-hidden bg-cover bg-center"
      style={{
        backgroundImage: `url(${backgroundLdc})`,
      }}
    >
      
      {/* LEFT MENU */}
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
          {userName || user?.displayName || user?.name || 'Student'}
        </p>

        <nav className="space-y-3">
          <button
            onClick={() => {
              setActiveSection('home');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-2 rounded transition ${
              activeSection === 'home' ? 'bg-blue-600' : 'hover:bg-blue-600'
            }`}
          >
            Home
          </button>

          <button
            onClick={() => {
              setActiveSection('booking');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-2 rounded transition ${
              activeSection === 'booking' ? 'bg-blue-600' : 'hover:bg-blue-600'
            }`}
          >
            Booking
          </button>

          <button
            onClick={() => {
              setActiveSection('feedback');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-2 rounded transition ${
              activeSection === 'feedback' ? 'bg-blue-600' : 'hover:bg-blue-600'
            }`}
          >
            Feedback
          </button>
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
            {mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
          </button>
        </div>
        {/* HOME SECTION */}
        {activeSection === 'home' && (
          <section className="mb-10">
            <h1 className="text-3xl font-bold mb-2">
              Welcome, {userName || user?.displayName || user?.name || 'Student'}.
            </h1>
            <p className="text-gray-600 mb-6">Here is a quick summary of your account.</p>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

            {loading ? (
              <p className="text-gray-500">Loading summary...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-lg shadow-lg p-5">
                  <p className="text-sm text-gray-500">Total Bookings</p>
                  <p className="text-3xl font-bold">{bookings.length}</p>
                </div>
                <div className="bg-white rounded-lg shadow-lg p-5">
                  <p className="text-sm text-gray-500">Upcoming</p>
                  <p className="text-3xl font-bold">
                    {bookings.filter((booking) => {
                      const status = (booking.status || '').toLowerCase();
                      if (['cancelled', 'rejected'].includes(status)) return false;
                      const start = toDate(booking.startTime)
                        || (booking.date && booking.start
                          ? new Date(`${booking.date}T${booking.start}:00`)
                          : booking.date && booking.startTime
                            ? new Date(`${booking.date}T${booking.startTime}:00`)
                            : null);
                      return start ? start > new Date() : false;
                    }).length}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-lg p-5">
                  <p className="text-sm text-gray-500">Attended</p>
                  <p className="text-3xl font-bold">
                    {bookings.filter((booking) => booking.status === 'attended').length}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-2">Notification</h2>
              {notifications.length === 0 ? (
                <p className="text-gray-600">You have no new notifications right now.</p>
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
              <h2 className="text-xl font-bold mb-2">My Bookings</h2>
              {bookings.length === 0 ? (
                <p className="text-gray-600">No bookings yet.</p>
              ) : (
                <div className="space-y-3">
                  {bookings.map((booking) => {
                    const startDateTime = booking.startTime
                      ? toDate(booking.startTime)
                      : booking.date && (booking.start || booking.startTime)
                        ? new Date(`${booking.date}T${booking.start || booking.startTime}:00`)
                        : null;
                    const endDateTime = booking.endTime
                      ? toDate(booking.endTime)
                      : booking.date && (booking.end || booking.endTime)
                        ? new Date(`${booking.date}T${booking.end || booking.endTime}:00`)
                        : null;
                    const seats = Array.isArray(booking.seats)
                      ? booking.seats
                      : booking.seat
                        ? [booking.seat]
                        : [];
                    const status = String(booking.status || 'pending').toLowerCase();
                    const canCancel = !['cancelled', 'rejected', 'attended'].includes(status);

                    return (
                      <div key={booking.id} className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {booking.date || '-'}{' '}
                            {startDateTime ? startDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            {' - '}
                            {endDateTime ? endDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </p>
                          <p className="text-sm text-gray-600">Seat: {seats.length > 0 ? seats.join(', ') : '-'}</p>
                          <p className="text-xs text-gray-500 capitalize">Status: {status}</p>
                        </div>

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
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* BOOKING SECTION (seat booking UI) */}
        {activeSection === 'booking' && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Booking</h2>
            <SeatBooking
              userName={userName || user?.displayName || user?.name || 'Student'}
              onBookingCreated={fetchBookings}
            />
          </section>
        )}

        {/* FEEDBACK SECTION */}
        {activeSection === 'feedback' && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Feedback</h2>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Share your feedback
                  </label>
                  <textarea
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Tell us about your experience..."
                  />
                </div>
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