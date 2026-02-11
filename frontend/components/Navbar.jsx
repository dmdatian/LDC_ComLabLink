import React from 'react';

export default function Navbar({ user, userName }) {
  const displayName = userName || user?.displayName || user?.name || 'User';

  return (
    <nav className="bg-blue-200 text-slate-900 shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-8">
          <h1 className="text-2xl font-bold">ComLabLink</h1>
        </div>

        <div className="flex items-center space-x-6">
          <div className="text-sm">
            <p className="text-slate-700">Logged in as:</p>
            <p className="font-semibold">{displayName}</p>
          </div>
        </div>
      </div>
    </nav>
  );
}
