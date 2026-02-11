import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './config/firebase';
import { updateProfile as updateFirebaseProfile } from 'firebase/auth';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';
import BookingPage from './pages/BookingPage';
import Navbar from './components/Navbar';
import { authAPI } from './utils/api';
import { logoutUser } from './utils/auth';
import './styles/index.css'; // 👈 IMPORTANT

function App() {
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [accountStatus, setAccountStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const token = await currentUser.getIdToken();
          localStorage.setItem('firebaseToken', token);
          
          const response = await authAPI.verify();
          const role = response.data.data.role;
          const status = response.data.data.status || 'approved';
          const verifiedName = response.data.data.name;
          const emailLocal = currentUser.email?.split('@')[0];
          const displayName = currentUser.displayName;
          const effectiveName =
            (verifiedName && verifiedName !== emailLocal ? verifiedName : null) ||
            displayName ||
            verifiedName ||
            emailLocal ||
            'User';
          const effectiveStatus =
            role && role.toLowerCase() === 'admin' ? 'approved' : status;
          setUserRole(role);
          setAccountStatus(effectiveStatus);
          setUserName(effectiveName);
          if (effectiveName && !displayName && currentUser) {
            try {
              await updateFirebaseProfile(currentUser, { displayName: effectiveName });
            } catch (profileErr) {
              // ignore profile update errors
            }
          }
        } catch (error) {
          console.error('Error verifying user:', error);
          await logoutUser();
          setUser(null);
          setUserName('');
          setUserRole(null);
          setAccountStatus(null);
        }
      } else {
        setUser(null);
        setUserName('');
        setUserRole(null);
        setAccountStatus(null);
        localStorage.removeItem('firebaseToken');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl font-bold">Loading...</div>
      </div>
    );
  }

  const normalizedRole = userRole ? userRole.toLowerCase() : null;
  const PendingRole = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-2xl font-semibold text-slate-800">Please wait...</div>
    </div>
  );

  const DashboardRoute = () => {
    if (!user) return <Navigate to="/login" />;
    if (!normalizedRole) return <PendingRole />;

    if (normalizedRole === 'student') return <StudentDashboard user={user} userName={userName} />;
    if (normalizedRole === 'teacher') return <TeacherDashboard user={user} userName={userName} />;
    if (normalizedRole === 'admin') return <AdminDashboard user={user} userName={userName} />;

    return <PendingRole />;
  };

  const BookingRoute = () => {
    if (!user) return <Navigate to="/login" />;
    if (!normalizedRole || normalizedRole !== 'student') return <Navigate to="/" />;
    return <BookingPage user={user} />;
  };

  return (
    <Router>
      <div className="min-h-screen">
        {user && <Navbar user={user} userName={userName} />}

        <main className="app-main">
          <Routes>
            {/* Public Route */}
            <Route 
              path="/login" 
              element={user ? <Navigate to="/" /> : <LoginPage />} 
            />

            {/* Protected Routes */}
            <Route path="/" element={<DashboardRoute />} />
            <Route path="/student" element={<DashboardRoute />} />
            <Route path="/teacher" element={<DashboardRoute />} />
            <Route path="/admin" element={<DashboardRoute />} />
            <Route path="/booking" element={<BookingRoute />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
