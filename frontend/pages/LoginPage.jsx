import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, logoutUser } from '../utils/auth';
import { authAPI } from '../utils/api';
import logoName from '../assets/logo_name.png';
import backgroundLdc from '../assets/background_ldc.jpg';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await loginUser(email, password);
      if (result.success) {
        try {
          await authAPI.verify();
        } catch (verifyErr) {
          if (verifyErr?.response?.status === 403) {
            alert(verifyErr?.response?.data?.message || 'Account is inactive. Please contact admin.');
            await logoutUser();
            return;
          }
          await logoutUser();
          throw verifyErr;
        }

        navigate('/');
      } else {
        const msg = (result.error || '').toLowerCase();
        if (msg.includes('auth/user-not-found')) {
          setError('Email not found.');
        } else if (msg.includes('auth/user-disabled')) {
          setError('Account is inactive. Please contact admin.');
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
        setError('Email not found.');
        return;
      }

      if (msg.includes('auth/wrong-password')) {
        setError('Incorrect password.');
        return;
      }

      if (msg.includes('auth/user-disabled')) {
        setError('Account is inactive. Please contact admin.');
        return;
      }

      if (msg.includes('auth/invalid-email')) {
        setError('Invalid email address.');
        return;
      }

      const code = err?.response?.status;
      if (code === 403) {
        setError(err?.response?.data?.message || 'Account is inactive. Please contact admin.');
      } else if (code === 409) {
        alert('Account exists but is not registered in the system. Please contact admin.');
      } else {
        setError('Login failed');
      }
    } finally {
      setLoading(false);
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
              <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">Account Login</h2>

              {error && (
                <div className="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
                  {error}
                </div>
              )}
              <form onSubmit={handleLogin}>
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
                    minLength={1}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Login'}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}