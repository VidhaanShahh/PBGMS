import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Scissors, CalendarCheck, CheckCircle2, Clock, Plus, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const { admin } = useAuth();
  const [stats, setStats] = useState({
    totalServices: 0,
    totalAppointments: 0,
    paidBookings: 0,
    pendingPayments: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const res = await getDashboardStats();
        if (res.success && res.stats) {
          setStats(res.stats);
        }
      } catch (err) {
        setError(err.message || 'Error loading dashboard statistics.');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Welcome back, <span style={{ color: 'var(--primary)' }}>{admin ? admin.username : 'Admin'}</span></h1>
          <p style={{ color: 'var(--text-muted)' }}>Overview of services, appointments, and payments.</p>
        </div>
        <Link to="/admin/services/new" className="btn btn-primary">
          <Plus size={16} /> Add New Service
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Stats Cards Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#eff6ff', color: 'var(--primary)' }}>
            <Scissors size={26} />
          </div>
          <div>
            <div className="stat-value">{stats.totalServices}</div>
            <div className="stat-label">Total Services</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
            <CalendarCheck size={26} />
          </div>
          <div>
            <div className="stat-value">{stats.totalAppointments}</div>
            <div className="stat-label">Appointments Booked</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#ecfdf5', color: 'var(--success)' }}>
            <CheckCircle2 size={26} />
          </div>
          <div>
            <div className="stat-value">{stats.paidBookings}</div>
            <div className="stat-label">Paid Bookings</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#fffbeb', color: 'var(--warning)' }}>
            <Clock size={26} />
          </div>
          <div>
            <div className="stat-value">{stats.pendingPayments}</div>
            <div className="stat-label">Pending Payments</div>
          </div>
        </div>
      </div>

      {/* Quick Actions & Navigation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '1.75rem', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>🛎️ Manage Services</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '1.25rem' }}>
            Add new treatments, edit pricing, update descriptions, and manage images.
          </p>
          <Link to="/admin/services" className="btn btn-secondary btn-sm">
            View All Services <ArrowRight size={14} />
          </Link>
        </div>

        <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '1.75rem', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>📅 Client Appointments</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '1.25rem' }}>
            Inspect incoming bookings, update booking statuses (Confirmed, Completed, Cancelled).
          </p>
          <Link to="/admin/appointments" className="btn btn-secondary btn-sm">
            Manage Appointments <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
