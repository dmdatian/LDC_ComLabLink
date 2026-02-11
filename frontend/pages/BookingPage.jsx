import React from 'react';
import BookingForm from '../components/BookingForm';

export default function BookingPage({ user }) {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-8 text-center">Create New Booking</h1>
        <BookingForm onBookingCreated={() => window.history.back()} />
      </div>
    </div>
  );
}