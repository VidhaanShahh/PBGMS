import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PawPrint, UserCheck, ShieldAlert } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [notificationPref, setNotificationPref] = useState('both');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please provide a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        notification_pref: notificationPref
      });
      navigate('/my-pets');
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your information and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nb-container" style={{ padding: '4rem 1.5rem', display: 'flex', justifyContent: 'center' }}>
      <div className="nb-card" style={{ maxWidth: '480px', width: '100%', background: '#FFFFFF' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            display: 'inline-flex',
            background: 'var(--nb-mint)',
            border: '2px solid #171717',
            padding: '0.65rem',
            borderRadius: '10px',
            marginBottom: '0.75rem',
            boxShadow: '3px 3px 0px #171717'
          }}>
            <PawPrint size={32} color="#171717" />
          </div>
          <h1 style={{ fontSize: '2rem' }}>Create Pet Owner Account</h1>
          <p style={{ color: '#555', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Register your profile to manage pet records and reserve boarding or grooming.
          </p>
        </div>

        {error && (
          <div className="nb-alert nb-alert-coral" style={{ marginBottom: '1.25rem' }}>
            <ShieldAlert size={18} />
            <div style={{ fontSize: '0.88rem' }}>{error}</div>
          </div>
        )}

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label className="nb-label">Full Name *</label>
            <input
              type="text"
              required
              className="nb-input"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="nb-label">Email Address *</label>
            <input
              type="email"
              required
              className="nb-input"
              placeholder="name@domain.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="nb-label">Indian Phone (+91) *</label>
            <input
              type="tel"
              required
              className="nb-input"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="nb-label">Password * (Min 6 chars)</label>
            <input
              type="password"
              required
              className="nb-input"
              placeholder="Create strong password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="nb-label">Notification Preference</label>
            <select
              className="nb-select"
              value={notificationPref}
              onChange={e => setNotificationPref(e.target.value)}
            >
              <option value="both">Both Email & SMS</option>
              <option value="email">Email Only</option>
              <option value="sms">SMS Only</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="nb-btn nb-btn-coral"
            style={{ width: '100%', padding: '0.85rem', fontSize: '1.05rem', marginTop: '0.5rem' }}
          >
            {loading ? 'Creating Account...' : 'Complete Registration'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: 700, color: 'var(--nb-blue)', textDecoration: 'underline' }}>
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}
