import React, { useState } from 'react';
import { seatsAPI } from '../utils/api';

const ACTIVE_BOOKING_STATUSES = new Set(['pending', 'approved']);
const isActiveBookingStatus = (status) => ACTIVE_BOOKING_STATUSES.has(String(status || '').toLowerCase());
const isWeekendDate = (dateKey) => {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const utcDate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const day = utcDate.getUTCDay();
  return day === 0 || day === 6;
};

export default function BookingForm({ onBookingCreated }) {
  const toLocalDateKey = (dateObj = new Date()) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isWeekendDate(date)) {
        setError('Weekend booking is not allowed. Please select Monday to Friday.');
        return;
      }

      const myBookingsResponse = await seatsAPI.getMySeats();
      const myBookings = Array.isArray(myBookingsResponse?.data?.data) ? myBookingsResponse.data.data : [];

      const dailyBookingsCount = myBookings.filter((booking) => {
        if (!isActiveBookingStatus(booking?.status)) return false;
        return booking?.date === date;
      }).length;

      if (dailyBookingsCount >= 2) {
        setError('Booking limit reached. You can only create up to 2 bookings per day.');
        return;
      }

      const response = await seatsAPI.createSeatBooking({ date, startTime, endTime });
      if (response?.data?.success === false) {
        throw new Error(response?.data?.message || 'Failed to create booking');
      }
      setSuccess('Booking created successfully!');
      setDate('');
      setStartTime('');
      setEndTime('');
      onBookingCreated();
    } catch (err) {
      if (err.response?.data?.error?.suggestedSlot) {
        const suggested = err.response.data.error.suggestedSlot;
        setError(`${err.response.data.message}\n\nSuggested slot: ${new Date(suggested.startTime).toLocaleString()} to ${new Date(suggested.endTime).toLocaleString()}`);
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to create booking');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
<div className="h-screen w-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-2xl font-bold mb-6 text-center">New Booking</h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 whitespace-pre-wrap">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setDate(nextDate);
                  if (isWeekendDate(nextDate)) {
                    setError('Weekend booking is not allowed. Please select Monday to Friday.');
                  } else if (error.includes('Weekend booking is not allowed')) {
                    setError('');
                  }
                }}
                required
                min={toLocalDateKey()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">End Time</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Booking'}
          </button>
        </form>
      </div>
    </div>
  );
}