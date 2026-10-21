import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAppointmentById, processPayment } from '../services/api';
import { CreditCard, CheckCircle, ShieldCheck, AlertCircle } from 'lucide-react';

export default function Payment() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [paymentMethod, setPaymentMethod] = useState('');
  const [cardData, setCardData] = useState({
    card_name: '',
    card_number: '',
    card_expiry: '',
    card_cvv: ''
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await getAppointmentById(appointmentId);
        if (res.success && res.appointment) {
          if (res.appointment.payment_status === 'Paid') {
            navigate(`/confirmation/${appointmentId}`);
            return;
          }
          setAppointment(res.appointment);
        } else {
          setError('Appointment could not be found.');
        }
      } catch (err) {
        setError(err.message || 'Error fetching appointment details.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [appointmentId, navigate]);

  const handleCardChange = (e) => {
    setCardData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!paymentMethod) {
      setError('Please select a payment method.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await processPayment({
        appointment_id: Number(appointmentId),
        payment_method: paymentMethod,
        ...cardData
      });

      if (res.success) {
        navigate(`/confirmation/${appointmentId}`);
      } else {
        setError(res.message || 'Payment processing failed.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during payment processing.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading appointment details...</p>
      </div>
    );
  }

  if (error && !appointment) {
    return (
      <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <div className="alert alert-error" style={{ maxWidth: '600px', margin: '0 auto' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '3.5rem 1.5rem', maxWidth: '850px' }}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '2.5rem', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <CreditCard size={28} className="text-primary" />
            <h1 style={{ fontSize: '1.75rem' }}>Checkout & Payment</h1>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>Complete your booking for <strong>{appointment.service_name}</strong>.</p>
        </div>

        <div className="alert alert-info">
          <ShieldCheck size={20} />
          <div>
            <strong>Simulated Demo Payment:</strong> This environment simulates checkout. No real card will be charged.
          </div>
        </div>

        {/* Booking Summary Box */}
        <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Booking Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.95rem' }}>
            <div><strong>Client:</strong> {appointment.customer_name}</div>
            <div><strong>Pet:</strong> {appointment.pet_name} ({appointment.breed})</div>
            <div><strong>Date:</strong> {appointment.appointment_date}</div>
            <div><strong>Amount:</strong> <span style={{ color: 'var(--primary)', fontWeight: 700 }}>LKR {Number(appointment.service_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="payment_method">Payment Method <span className="required">*</span></label>
            <select
              id="payment_method"
              name="payment_method"
              className="form-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              required
            >
              <option value="">— Select Payment Method —</option>
              <option value="Credit Card">Credit Card (Demo)</option>
              <option value="Debit Card">Debit Card (Demo)</option>
              <option value="Cash on Arrival">Cash on Arrival</option>
              <option value="Bank Transfer">Bank Transfer (Demo)</option>
            </select>
          </div>

          {['Credit Card', 'Debit Card'].includes(paymentMethod) && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', background: '#fafafa', marginBottom: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Enter Card Information</h4>

              <div className="form-group">
                <label className="form-label" htmlFor="card_name">Name on Card <span className="required">*</span></label>
                <input
                  type="text"
                  id="card_name"
                  name="card_name"
                  className="form-control"
                  placeholder="e.g. Kasun Silva"
                  value={cardData.card_name}
                  onChange={handleCardChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="card_number">Card Number <span className="required">*</span></label>
                <input
                  type="text"
                  id="card_number"
                  name="card_number"
                  className="form-control"
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  value={cardData.card_number}
                  onChange={handleCardChange}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="card_expiry">Expiry Date <span className="required">*</span></label>
                  <input
                    type="text"
                    id="card_expiry"
                    name="card_expiry"
                    className="form-control"
                    placeholder="MM/YY"
                    maxLength={5}
                    value={cardData.card_expiry}
                    onChange={handleCardChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="card_cvv">CVV <span className="required">*</span></label>
                  <input
                    type="password"
                    id="card_cvv"
                    name="card_cvv"
                    className="form-control"
                    placeholder="123"
                    maxLength={4}
                    value={cardData.card_cvv}
                    onChange={handleCardChange}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-success btn-full"
            style={{ padding: '0.85rem', fontSize: '1.05rem', marginTop: '1rem' }}
            disabled={submitting}
          >
            {submitting ? 'Processing Payment...' : `Pay LKR ${Number(appointment.service_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </button>
        </form>
      </div>
    </div>
  );
}
