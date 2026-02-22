import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, logoutUser, resetUserPassword } from '../utils/auth';
import { authAPI } from '../utils/api';
import logoName from '../assets/logo_name.png';
import backgroundLdc from '../assets/background_ldc.jpg';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await loginUser(email, password);
      if (result.success) {
        try {
          const verifyResponse = await authAPI.verify();
          const status = verifyResponse?.data?.data?.status;
          if (status === 'pending') {
            alert('Please wait... Your account is pending approval.');
            await logoutUser();
            return;
          }
        } catch (verifyErr) {
          await logoutUser();
          throw verifyErr;
        }

        navigate('/');
      } else {
        const msg = (result.error || '').toLowerCase();
        if (msg.includes('auth/user-not-found')) {
          setError('Email not found.');
        } else if (msg.includes('auth/wrong-password')) {
          setError('Incorrect password.');
        } else if (msg.includes('auth/invalid-email')) {
          setError('Invalid email address.');
        } else {
          setError('Login failed.');
        }
      }
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('auth/user-not-found')) {
        try {
          const checkResponse = await authAPI.login(email);
          const status = checkResponse?.data?.data?.status;
          if (status === 'pending') {
            alert('Please wait... Your account is pending approval.');
            return;
          }
        } catch (checkErr) {
          const code = checkErr?.response?.status;
          if (code === 409) {
            alert('Account exists but is not registered in the system. Please contact admin.');
            return;
          }
        }

        setError('Email not found.');
        return;
      }

      if (msg.includes('auth/wrong-password')) {
        setError('Incorrect password.');
        return;
      }

      if (msg.includes('auth/invalid-email')) {
        setError('Invalid email address.');
        return;
      }

      const code = err?.response?.status;
      if (code === 409) {
        alert('Account exists but is not registered in the system. Please contact admin.');
      } else {
        setError('Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const normalizedRole = role.toLowerCase();
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const trimmedPassword = password.trim();

    try {
      if (!trimmedEmail || !trimmedName || !trimmedPassword) {
        setError('Please fill all required fields.');
        return;
      }

      if (trimmedPassword.length < 6) {
        setError('Password must be at least 6 characters (letters or numbers).');
        return;
      }

      if (!['student', 'teacher'].includes(normalizedRole)) {
        setError('Please select a role.');
        return;
      }

      await authAPI.requestRegistration(
        trimmedEmail,
        trimmedPassword,
        trimmedName,
        normalizedRole
      );

      alert('Account details sent! Wait for admin approval');
      setIsLogin(true);
      navigate('/login');

      // Clear fields
      setEmail('');
      setPassword('');
      setName('');
      setRole('');
    } catch (err) {
      const code = err?.response?.status;
      const message = (err?.response?.data?.message || '').toLowerCase();

      if (code === 409 && message.includes('pending request')) {
        alert('Account details sent! Wait for admin approval');
        setIsLogin(true);
        navigate('/login');
      } else if (code === 409) {
        alert('Email already in use. Please login or use another email.');
      } else if (message) {
        setError(err?.response?.data?.message);
      } else {
        setError('Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setSuccess('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email first.');
      return;
    }

    setResetLoading(true);
    try {
      const result = await resetUserPassword(trimmedEmail);
      if (result.success) {
        setSuccess('Password reset email sent. Check your inbox.');
        return;
      }

      const msg = (result.error || '').toLowerCase();
      if (msg.includes('auth/invalid-email')) {
        setError('Invalid email address.');
      } else if (msg.includes('auth/user-not-found')) {
        setError('Email not found.');
      } else {
        setError('Could not send reset email. Please try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };
  return (
    <div
      className="fixed inset-0 overflow-auto p-4 md:p-6"
      style={{
        backgroundImage: `url(${backgroundLdc})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="mx-auto flex min-h-full w-full items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl lg:grid lg:max-w-6xl lg:grid-cols-[1.2fr_0.9fr]">
          <section className="border-b border-slate-200 p-6 md:p-8 lg:border-b-0 lg:border-r">
          <div className="mb-10">
            <img
              src={logoName}
              alt="Liceo de Cabuyao logo and name"
              className="h-auto w-full max-w-[520px] object-contain"
            />
          </div>

          <div className="space-y-10 text-slate-900">
            <div>
              <h2 className="mb-3 text-3xl font-bold text-blue-950">Mission</h2>
              <p className="mb-3 text-lg leading-relaxed">
                As guided by the Holy Trinity and the life and teachings of St. John Paul II, we commit ourselves to:
              </p>
              <ul className="space-y-2 pl-6 text-lg leading-relaxed">
                <li className="list-disc">Be beloved disciples and loving missionaries of Christ.</li>
                <li className="list-disc">
                  Academic excellence by creating learning opportunities, fostering critical thinking skills and engaging social advocacies as lifelong learners.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="mb-3 text-3xl font-bold text-blue-950">Vision</h2>
              <p className="text-lg leading-relaxed">
                <span className="font-semibold text-blue-900">Liceo de Cabuyao</span> envisions to form and transform the community as catalyst of integral
                accompaniment and evangelization ready to meet the challenges of the time.
              </p>
            </div>
          </div>
        </section>

          <section className="flex w-full items-center justify-center p-6 md:p-8">
            <div className="mx-auto w-full max-w-md">
            <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
              {isLogin ? 'Account Login' : 'Create Account'}
            </h2>

            {error && (
              <div className="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 rounded border border-green-400 bg-green-100 px-4 py-3 text-green-700">
                {success}
              </div>
            )}

            <form onSubmit={isLogin ? handleLogin : handleRegister}>
              {!isLogin && (
                <div className="mb-4">
                  <label className="block text-gray-700 font-bold mb-2">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="Full name"
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="block text-gray-700 font-bold mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="your@email.com"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 font-bold mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isLogin ? 1 : 6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="••••••••"
                />
                {isLogin && (
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={loading || resetLoading}
                      className="text-sm text-blue-500 hover:text-blue-700 disabled:opacity-50"
                    >
                      {resetLoading ? 'Sending reset email...' : 'Forgot password?'}
                    </button>
                  </div>
                )}
              </div>

              {!isLogin && (
                <div className="mb-6">
                  <label className="block text-gray-700 font-bold mb-2">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select a role</option>
                    <option value="Student">Student</option>
                    <option value="Teacher">Teacher</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
              >
                {loading ? 'Loading...' : isLogin ? 'Login' : 'Register'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-700 mb-2">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
              </p>
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setSuccess('');
                }}
                className="text-blue-500 hover:text-blue-700 font-bold"
              >
                {isLogin ? 'Register' : 'Login'}
              </button>
            </div>
          </div>
          </section>
        </div>
      </div>
    </div>
  );
}