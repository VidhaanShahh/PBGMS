import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getServiceById } from '../services/api';
import { Calendar, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function ServiceDetails() {
  const { id } = useParams();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await getServiceById(id);
        if (res.success && res.service) {
          setService(res.service);
        } else {
          setError('Service not found.');
        }
      } catch (err) {
        setError(err.message || 'Error fetching service details.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading service details...</p>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <ShieldAlert size={48} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
        <h2>Service Not Found</h2>
        <p style={{ color: 'var(--text-muted)', margin: '0.75rem 0 1.5rem' }}>
          {error || 'The requested service does not exist.'}
        </p>
        <Link to="/" className="btn btn-primary">
          <ArrowLeft size={16} /> Back to Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '3.5rem 1.5rem' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontWeight: 500 }}>
        <ArrowLeft size={16} /> Back to all services
      </Link>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-md)', display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1.2fr' }}>
        <div style={{ height: '100%', minHeight: '350px', background: '#f1f5f9' }}>
          <img
            src={`/${service.image || 'placeholder.svg'}`}
            alt={service.service_name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.target.src = '/placeholder.svg'; }}
          />
        </div>

        <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <span className="badge badge-category">{service.category}</span>
              <span className="badge badge-confirmed">Target Pet: {service.target_pet_type}</span>
            </div>

            <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>{service.service_name}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: '1.7', marginBottom: '2rem' }}>
              {service.description}
            </p>

            <div style={{ background: 'var(--primary-light)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Session Pricing</span>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
                LKR {Number(service.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                All taxes and sanitization materials included.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link to={`/book/${service.id}`} className="btn btn-primary" style={{ padding: '0.85rem 2rem', fontSize: '1rem' }}>
              <Calendar size={18} /> Book Appointment
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
