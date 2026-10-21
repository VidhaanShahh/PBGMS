import React, { useState, useEffect } from 'react';
import { getAppointments, updateAppointmentStatus } from '../services/api';
import { Calendar, Filter, CheckCircle2, Clock, XCircle } from 'lucide-react';

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async (filter) => {
    try {
      setLoading(true);
      setError('');
      const res = await getAppointments(filter);
      if (res.success) {
        setAppointments(res.appointments || []);
      }
    } catch (err) {
      setError(err.message || 'Error loading appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(statusFilter);
  }, [statusFilter]);

  const handleStatusChange = async (id, newStatus) => {
    setError('');
    setSuccess('');
    try {
      const res = await updateAppointmentStatus(id, newStatus);
      if (res.success) {
        setSuccess(`Appointment #${id} updated to ${newStatus}.`);
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, booking_status: newStatus } : a))
        );
      }
    } catch (err) {
      setError(err.message || 'Failed to update appointment status.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Confirmed':
        return <span className="badge badge-confirmed">Confirmed</span>;
      case 'Completed':
        return <span className="badge badge-completed">Completed</span>;
      case 'Cancelled':
        return <span className="badge badge-cancelled">Cancelled</span>;
      default:
        return <span className="badge badge-pending">Pending</span>;
    }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem' }}>Appointment Bookings</h1>
          <p style={{ color: 'var(--text-muted)' }}>Review and manage customer bookings, payments, and schedules.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label htmlFor="filterStatus" style={{ fontSize: '0.9rem', fontWeight: 600 }}>Filter Status:</label>
          <select
            id="filterStatus"
            className="form-select"
            style={{ width: 'auto' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
          Loading appointments...
        </div>
      ) : appointments.length === 0 ? (
        <div style={{ background: '#fff', padding: '3rem', textAlign: 'center', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)' }}>No appointments found matching this filter.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Client & Contact</th>
                <th>Pet & Breed</th>
                <th>Service</th>
                <th>Date</th>
                <th>Payment</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id}>
                  <td><strong>#{String(a.id).padStart(4, '0')}</strong></td>
                  <td>
                    <div><strong>{a.customer_name}</strong></div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{a.customer_email}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{a.customer_phone}</div>
                  </td>
                  <td>
                    <div><strong>{a.pet_name}</strong></div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{a.breed} ({a.age})</div>
                  </td>
                  <td>
                    <div>{a.service_name}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
                      LKR {Number(a.service_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td>
                    <strong>{a.appointment_date}</strong>
                  </td>
                  <td>
                    <span className={`badge ${a.payment_status === 'Paid' ? 'badge-completed' : 'badge-pending'}`}>
                      {a.payment_status || 'Pending'}
                    </span>
                    {a.payment_method && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {a.payment_method}
                      </div>
                    )}
                  </td>
                  <td>
                    {getStatusBadge(a.booking_status)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <select
                      className="form-select"
                      style={{ fontSize: '0.85rem', padding: '0.3rem 0.5rem', width: 'auto', display: 'inline-block' }}
                      value={a.booking_status}
                      onChange={(e) => handleStatusChange(a.id, e.target.value)}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
