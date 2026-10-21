import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PawPrint, Lock, Mail, ShieldAlert } from 'lucide-react';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(identifier, password);
      if (res.user.role === 'PET_OWNER') {
        navigate('/my-pets');
      } else {
        navigate('/staff/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (email, pwd) => {
    setIdentifier(email);
    setPassword(pwd);
  };

  return (
    <div className="nb-container" style={{ padding: '4rem 1.5rem', display: 'flex', justifyContent: 'center' }}>
      <div className="nb-card" style={{ maxWidth: '480px', width: '100%', background: '#FFFFFF' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            display: 'inline-flex',
            background: 'var(--nb-yellow)',
            border: '2px solid #171717',
            padding: '0.65rem',
            borderRadius: '10px',
            marginBottom: '0.75rem',
            boxShadow: '3px 3px 0px #171717'
          }}>
            <PawPrint size={32} color="#171717" />
          </div>
          <h1 style={{ fontSize: '2rem' }}>Welcome to PBGMS</h1>
          <p style={{ color: '#555', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Sign in to access pet health profiles, reservations, or staff management.
          </p>
        </div>

        {error && (
          <div className="nb-alert nb-alert-coral" style={{ marginBottom: '1.25rem' }}>
            <ShieldAlert size={18} />
            <div style={{ fontSize: '0.88rem' }}>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label className="nb-label">Email or Username</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="text"
                required
                className="nb-input"
                placeholder="e.g. owner@pbgms.in or admin@pbgms.in"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="nb-label">Password</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="password"
                required
                className="nb-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.35rem' }}>
              For your security, your account will be temporarily locked after five consecutive unsuccessful login attempts.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="nb-btn nb-btn-coral"
            style={{ width: '100%', padding: '0.85rem', fontSize: '1.05rem', marginTop: '0.5rem' }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Quick Demo Credentials per SRS Role Support */}
        <div style={{ marginTop: '2rem', borderTop: '2px dashed #E0DCD3', paddingTop: '1.25rem' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#666', marginBottom: '0.65rem' }}>
            Quick Credentials (Password: admin123)
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            <button type="button" onClick={() => handleQuickFill('owner@pbgms.in', 'admin123')} className="nb-btn nb-btn-sm nb-btn-white" style={{ fontSize: '0.75rem' }}>
              Pet Owner
            </button>
            <button type="button" onClick={() => handleQuickFill('frontdesk@pbgms.in', 'admin123')} className="nb-btn nb-btn-sm nb-btn-white" style={{ fontSize: '0.75rem' }}>
              Front Desk
            </button>
            <button type="button" onClick={() => handleQuickFill('groomer@pbgms.in', 'admin123')} className="nb-btn nb-btn-sm nb-btn-white" style={{ fontSize: '0.75rem' }}>
              Groomer
            </button>
            <button type="button" onClick={() => handleQuickFill('admin@pbgms.in', 'admin123')} className="nb-btn nb-btn-sm nb-btn-white" style={{ fontSize: '0.75rem' }}>
              Admin
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
          Don't have an account yet?{' '}
          <Link to="/register" style={{ fontWeight: 700, color: 'var(--nb-blue)', textDecoration: 'underline' }}>
            Register Free
          </Link>
        </div>
      </div>
    </div>
  );
}
