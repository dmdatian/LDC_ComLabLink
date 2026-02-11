import React, { useState } from 'react';
import { seatsAPI } from '../utils/api';

export default function BookingForm({ onBookingCreated }) {
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
      const myBookingsResponse = await seatsAPI.getMySeats();
      const myBookings = Array.isArray(myBookingsResponse?.data?.data) ? myBookingsResponse.data.data : [];
      const activeBookingsCount = myBookings.filter((booking) => {
        const status = String(booking?.status || '').toLowerCase();
        return status !== 'cancelled' && status !== 'rejected';
      }).length;

      if (activeBookingsCount >= 3) {
        setError('Booking limit reached. You can only have up to 3 active bookings.');
        return;
      }

      const dailyBookingsCount = myBookings.filter((booking) => {
        const status = String(booking?.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'rejected') return false;
        return booking?.date === date;
      }).length;

      if (dailyBookingsCount >= 1) {
        setError('Booking limit reached. You can only create one booking per day.');
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
              onChange={(e) => setDate(e.target.value)}
              required
              min={new Date().toISOString().split('T')[0]}
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
