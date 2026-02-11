require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  firebase: {
    apiKey: "AIzaSyA5uQ-_8kGdt-uAgVbm90oHYwpWp7LlVo0",
    authDomain: "computer-lab-booking-sys-6573e.firebaseapp.com",
    databaseURL: "https://computer-lab-booking-sys-6573e-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "computer-lab-booking-sys-6573e",
    storageBucket: "computer-lab-booking-sys-6573e.firebasestorage.app",
    messagingSenderId: "534452807104",
    appId: "1:534452807104:web:6a56174b7a51ff6dbf1425",
    measurementId: "G-LSKQVPYMQR"
  },
};