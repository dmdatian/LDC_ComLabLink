import React, { useState } from 'react';
import { reportAPI } from '../utils/api';

export default function ReportViewer() {
  const [reportType, setReportType] = useState('daily');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateReport = async () => {
    setLoading(true);
    setError('');
    setReport(null);

    try {
      let response;
      if (reportType === 'daily') {
        response = await reportAPI.getDailyReport(date);
      } else if (reportType === 'weekly') {
        if (!startDate || !endDate) {
          setError('Please select start and end dates');
          setLoading(false);
          return;
        }
        response = await reportAPI.getWeeklyReport(startDate, endDate);
      } else {
        response = await reportAPI.getMonthlyReport(month, year);
      }
      setReport(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!report) return;

    let csv = '';
    if (reportType === 'daily' || reportType === 'weekly') {
      csv = 'Student,Date,Start Time,End Time,Status\n';
      report.bookings?.forEach(booking => {
        csv += `${booking.studentName},${booking.date},${new Date(booking.startTime).toLocaleTimeString()},${new Date(booking.endTime).toLocaleTimeString()},${booking.status}\n`;
      });
    } else {
      csv = 'Metric,Value\n';
      csv += `Total Bookings,${report.totalBookings}\n`;
      csv += `Approved,${report.approvedBookings}\n`;
      csv += `Attended,${report.attendedBookings}\n`;
    }

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', `report-${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Report Generator</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Report Type Selection */}
      <div className="mb-6">
        <label className="block text-gray-700 font-bold mb-2">Report Type</label>
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
        >
          <option value="daily">Daily Report</option>
          <option value="weekly">Weekly Report</option>
          <option value="monthly">Monthly Report</option>
        </select>
      </div>

      {/* Date Inputs */}
      {reportType === 'daily' && (
        <div className="mb-6">
          <label className="block text-gray-700 font-bold mb-2">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {reportType === 'weekly' && (
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-bold mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-bold mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {reportType === 'monthly' && (
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-bold mb-2">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-700 font-bold mb-2">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                {[...Array(5)].map((_, i) => (
                  <option key={i} value={new Date().getFullYear() - 2 + i}>
                    {new Date().getFullYear() - 2 + i}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={generateReport}
          disabled={loading}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
        {report && (
          <button
            onClick={downloadCSV}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition"
          >
            Download CSV
          </button>
        )}
      </div>

      {/* Report Display */}
      {report && (
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4">Report Results</h3>
          
          {reportType !== 'daily' && reportType !== 'weekly' ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold text-blue-600">{report.totalBookings}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">{report.approvedBookings}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Attended</p>
                <p className="text-2xl font-bold text-purple-600">{report.attendedBookings}</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-2 font-bold">Student</th>
                    <th className="px-4 py-2 font-bold">Date</th>
                    <th className="px-4 py-2 font-bold">Time</th>
                    <th className="px-4 py-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.bookings?.map((booking, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{booking.studentName}</td>
                      <td className="px-4 py-2">{booking.date}</td>
                      <td className="px-4 py-2">{new Date(booking.startTime).toLocaleTimeString()}</td>
                      <td className="px-4 py-2">{booking.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}