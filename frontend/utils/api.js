import axios from 'axios';

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const API_URL = rawApiUrl || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL.replace(/\/+$/, ''),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('firebaseToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// AUTH API
export const authAPI = {
  requestRegistration: (email, password, name, role) =>
    api.post('/auth/request', { email, password, name, role }),
  register: (email, password, name, role) =>
    api.post('/auth/register', { email, password, name, role }),
  login: (email) => api.post('/auth/login', { email }),
  verify: () => api.get('/auth/verify-token'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  getPendingUsers: () => api.get('/auth/pending'),
  approveUser: (email) => api.put(`/auth/approve/${encodeURIComponent(email)}`),
  rejectUser: (email) => api.delete(`/auth/reject/${encodeURIComponent(email)}`),
};

// SEATS (BOOKING) API
export const seatsAPI = {
  createSeatBooking: (payload) => api.post('/seats', payload),
  getMySeats: () => api.get('/seats/mine'),
  getSeatById: (id) => api.get(`/seats/${id}`),
  cancelSeatBooking: (id) => api.patch(`/seats/${id}/cancel`),
  confirmAttendance: (id) => api.patch(`/seats/${id}/confirm-attendance`),
  getAllSeats: (date) => api.get('/seats', { params: { date } }),
  getAllSeatsAdmin: () => api.get('/seats/all'),
  getSeatAvailability: (date, startTime, endTime) => api.get('/seats/availability', { params: { date, startTime, endTime } }),
  getSeatCatalog: () => api.get('/seats/catalog'),
  getFixedSchedule: () => api.get('/seats/fixed-schedule'),
  getMyFixedSchedule: () => api.get('/seats/fixed-schedule/mine'),
  upsertFixedScheduleEntry: (payload) => api.post('/seats/fixed-schedule', payload),
  deleteFixedScheduleEntry: (id) => api.delete(`/seats/fixed-schedule/${id}`),
  upsertSeatCatalogItem: (row, column, side) => api.put('/seats/catalog', { row, column, side }),
  deleteSeatCatalogItem: (seatId) => api.delete(`/seats/catalog/${encodeURIComponent(seatId)}`),
  getSeatBlocks: (date) => api.get('/seats/blocks', { params: { date } }),
  createSeatBlock: (payload) => api.post('/seats/blocks', payload),
  deleteSeatBlock: (id) => api.delete(`/seats/blocks/${id}`),
  getSubjects: () => api.get('/subjects'),
};

// CLASSES API
export const classAPI = {
  createClass: (className, startTime, endTime, date, capacity) =>
    api.post('/classes', { className, startTime, endTime, date, capacity }),
  getMyClasses: () => api.get('/classes/my-classes'),
  getClassById: (id) => api.get(`/classes/${id}`),
  updateClass: (id, data) => api.put(`/classes/${id}`, data),
  deleteClass: (id) => api.delete(`/classes/${id}`),
  getClassesByDate: (date) => api.get('/classes', { params: { date } }),
};

// REPORTS API
export const reportAPI = {
  getDailyReport: (date) => api.get('/reports/daily', { params: { date } }),
  getWeeklyReport: (startDate, endDate) =>
    api.get('/reports/weekly', { params: { startDate, endDate } }),
  getMonthlyReport: (month, year) =>
    api.get('/reports/monthly', { params: { month, year } }),
};

// ATTENDANCE API
export const attendanceAPI = {
  getByDate: (date) => api.get('/seats', { params: { date } }),
  mark: (bookingId, status, remarks = '') =>
    api.patch(`/seats/${bookingId}/attendance`, { status, remarks }),
};

// NOTIFICATIONS API
export const notificationAPI = {
  getMine: (limit = 50) => api.get('/notifications/mine', { params: { limit } }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
};

// FEEDBACK API
export const feedbackAPI = {
  submitFeedback: (message, category, source) =>
    api.post('/feedback', { message, category, source }),
  getFeedback: (limit = 50) => api.get('/feedback', { params: { limit } }),
};

export default api;