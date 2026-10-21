import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getServiceById, createAppointment } from '../services/api';
import { Calendar, User, Mail, Phone, Dog, ArrowRight, ArrowLeft } from 'lucide-react';

export default function Booking() {
  const { serviceId } = useParams();
  const navigate = useNavigate();

  const [service, setService] = useState(null);
  const [loadingService, setLoadingService] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    pet_name: '',
    breed: '',
    age: '',
    appointment_date: ''
  });

  useEffect(() => {
    async function load() {
      try {
        setLoadingService(true);
        const res = await getServiceById(serviceId);
        if (res.success && res.service) {
          setService(res.service);
        } else {
          setError('Selected service could not be loaded.');
        }
      } catch (err) {
        setError(err.message || 'Error loading service.');
      } finally {
        setLoadingService(false);
      }
    }
    load();
  }, [serviceId]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.customer_name || !formData.customer_email || !formData.customer_phone || !formData.pet_name || !formData.breed || !formData.age || !formData.appointment_date) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await createAppointment({
        service_id: Number(serviceId),
        ...formData
      });

      if (res.success && res.appointment) {
        // Redirect to simulated payment page matching PHP workflow
        navigate(`/payment/${res.appointment.id}`);
      } else {
        setError(res.message || 'Failed to submit booking.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during booking.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingService) {
    return (
      <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading booking details...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '900px' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontWeight: 500 }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '2.5rem', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
          <span style={{ fontSize: '1.75rem', display: 'block', marginBottom: '0.5rem' }}>📅</span>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Book {service ? service.service_name : 'Service'}</h1>
          <p style={{ color: 'var(--text-muted)' }}>Please fill in the owner and pet information to schedule your visit.</p>
          {service && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span className="badge badge-category">{service.category}</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>
                Total Fee: LKR {Number(service.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Owner Details */}
          <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} className="text-primary" /> Owner Information
          </h3>

          <div className="form-group">
            <label className="form-label" htmlFor="customer_name">Full Name <span className="required">*</span></label>
            <input
              type="text"
              id="customer_name"
              name="customer_name"
              className="form-control"
              placeholder="e.g. Kasun Silva"
              value={formData.customer_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="customer_email">Email Address <span className="required">*</span></label>
              <input
                type="email"
                id="customer_email"
                name="customer_email"
                className="form-control"
                placeholder="kasun@example.com"
                value={formData.customer_email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="customer_phone">Phone Number <span className="required">*</span></label>
              <input
                type="tel"
                id="customer_phone"
                name="customer_phone"
                className="form-control"
                placeholder="0712345678"
                value={formData.customer_phone}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Pet Details */}
          <h3 style={{ fontSize: '1.15rem', margin: '1.5rem 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Dog size={18} className="text-primary" /> Pet Information
          </h3>

          <div className="form-group">
            <label className="form-label" htmlFor="pet_name">Pet Name <span className="required">*</span></label>
            <input
              type="text"
              id="pet_name"
              name="pet_name"
              className="form-control"
              placeholder="e.g. Buddy"
              value={formData.pet_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="breed">Breed <span className="required">*</span></label>
              <input
                type="text"
                id="breed"
                name="breed"
                className="form-control"
                placeholder="e.g. Golden Retriever, Persian Cat"
                value={formData.breed}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="age">Age <span className="required">*</span></label>
              <input
                type="text"
                id="age"
                name="age"
                className="form-control"
                placeholder="e.g. 2 years, 6 months"
                value={formData.age}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Schedule */}
          <h3 style={{ fontSize: '1.15rem', margin: '1.5rem 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} className="text-primary" /> Select Date
          </h3>

          <div className="form-group">
            <label className="form-label" htmlFor="appointment_date">Appointment Date <span className="required">*</span></label>
            <input
              type="date"
              id="appointment_date"
              name="appointment_date"
              className="form-control"
              min={new Date().toISOString().split('T')[0]}
              value={formData.appointment_date}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: '1.5rem', padding: '0.85rem' }}
            disabled={submitting}
          >
            {submitting ? 'Creating Booking...' : 'Proceed to Payment'} <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
