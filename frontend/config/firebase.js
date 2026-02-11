import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA5uQ-_8kGdt-uAgVbm90oHYwpWp7LlVo0",
  authDomain: "computer-lab-booking-sys-6573e.firebaseapp.com",
  databaseURL: "https://computer-lab-booking-sys-6573e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "computer-lab-booking-sys-6573e",
  storageBucket: "computer-lab-booking-sys-6573e.firebasestorage.app",
  messagingSenderId: "534452807104",
  appId: "1:534452807104:web:7840bc547a117c9ebf1425",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
