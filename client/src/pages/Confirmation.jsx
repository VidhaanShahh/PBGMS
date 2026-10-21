import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAppointmentById } from '../services/api';
import { CheckCircle2, Calendar, FileText, ArrowLeft, Printer } from 'lucide-react';

export default function Confirmation() {
  const { appointmentId } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await getAppointmentById(appointmentId);
        if (res.success && res.appointment) {
          setBooking(res.appointment);
        } else {
          setError('Booking confirmation could not be found.');
        }
      } catch (err) {
        setError(err.message || 'Error fetching confirmation.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [appointmentId]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading booking confirmation...</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <div className="alert alert-error">{error}</div>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '3.5rem 1.5rem', maxWidth: '800px' }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <CheckCircle2 size={56} style={{ color: 'var(--success)', margin: '0 auto 1rem' }} />
        <h1 style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>Booking Confirmed!</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>
          Thank you, <strong>{booking.customer_name}</strong>. Your pet care appointment is officially reserved.
        </p>
      </div>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ background: 'var(--primary-light)', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Booking Reference</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', color: 'var(--secondary)' }}>
            #{String(booking.id).padStart(6, '0')}
          </span>
        </div>

        <div style={{ padding: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
            {/* Service & Schedule */}
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem' }}>
                🛎️ Service Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.95rem' }}>
                <div><strong>Service:</strong> {booking.service_name}</div>
                <div><strong>Category:</strong> {booking.category}</div>
                <div><strong>Appointment Date:</strong> <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{booking.appointment_date}</span></div>
                <div><strong>Status:</strong> <span className="badge badge-confirmed">{booking.booking_status}</span></div>
              </div>
            </div>

            {/* Pet & Owner */}
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem' }}>
                🐾 Pet & Owner Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.95rem' }}>
                <div><strong>Pet:</strong> {booking.pet_name} ({booking.breed}, {booking.age})</div>
                <div><strong>Owner:</strong> {booking.customer_name}</div>
                <div><strong>Email:</strong> {booking.customer_email}</div>
                <div><strong>Phone:</strong> {booking.customer_phone}</div>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>💳 Payment Record</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.92rem' }}>
              <div><strong>Status:</strong> <span className="badge badge-completed">{booking.payment_status || 'Paid'}</span></div>
              <div><strong>Method:</strong> {booking.payment_method || 'Card (Demo)'}</div>
              <div><strong>Amount Paid:</strong> LKR {Number(booking.amount || booking.service_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div><strong>Transaction Ref:</strong> {booking.transaction_reference || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '1.25rem 2rem', background: '#fafafa', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" className="btn btn-secondary btn-sm">
            <ArrowLeft size={16} /> Return to Homepage
          </Link>
          <button onClick={() => window.print()} className="btn btn-primary btn-sm">
            <Printer size={16} /> Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
