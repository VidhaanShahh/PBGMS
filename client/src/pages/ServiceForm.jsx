import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getServiceById, createService, updateService } from '../services/api';
import { ArrowLeft, Save } from 'lucide-react';

export default function ServiceForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    service_name: '',
    category: 'Grooming',
    target_pet_type: 'Dog',
    description: '',
    price: '',
    image: ''
  });

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit) {
      async function load() {
        try {
          setLoading(true);
          const res = await getServiceById(id);
          if (res.success && res.service) {
            setFormData({
              service_name: res.service.service_name || '',
              category: res.service.category || 'Grooming',
              target_pet_type: res.service.target_pet_type || 'Dog',
              description: res.service.description || '',
              price: res.service.price || '',
              image: res.service.image || ''
            });
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
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.service_name.trim() || !formData.description.trim() || formData.price === '') {
      setError('Please fill in all mandatory fields.');
      return;
    }

    try {
      setSubmitting(true);
      if (isEdit) {
        await updateService(id, formData);
      } else {
        await createService(formData);
      }
      navigate('/admin/services');
    } catch (err) {
      setError(err.message || 'Failed to save service.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading service details...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: '750px' }}>
      <Link to="/admin/services" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontWeight: 500 }}>
        <ArrowLeft size={16} /> Back to Services
      </Link>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '2.5rem', boxShadow: 'var(--shadow-sm)' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
          {isEdit ? 'Edit Service' : 'Add New Service'}
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.75rem' }}>
          Configure service details, pricing, and assigned pet category.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="service_name">Service Name <span className="required">*</span></label>
            <input
              type="text"
              id="service_name"
              name="service_name"
              className="form-control"
              placeholder="e.g. Full Bath & Haircut"
              value={formData.service_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="category">Category <span className="required">*</span></label>
              <select
                id="category"
                name="category"
                className="form-select"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="Grooming">Grooming</option>
                <option value="Veterinary">Veterinary</option>
                <option value="Boarding">Boarding</option>
                <option value="Training">Training</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="target_pet_type">Target Pet Type <span className="required">*</span></label>
              <select
                id="target_pet_type"
                name="target_pet_type"
                className="form-select"
                value={formData.target_pet_type}
                onChange={handleChange}
                required
              >
                <option value="Dog">Dog</option>
                <option value="Cat">Cat</option>
                <option value="Bird">Bird</option>
                <option value="Rabbit">Rabbit</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">Description <span className="required">*</span></label>
            <textarea
              id="description"
              name="description"
              className="form-textarea"
              rows={4}
              style={{ resize: 'none' }}
              placeholder="Describe what is included in this treatment session..."
              value={formData.description}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="price">Price (LKR) <span className="required">*</span></label>
              <input
                type="number"
                step="0.01"
                id="price"
                name="price"
                className="form-control"
                placeholder="3500.00"
                value={formData.price}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="image">Image File / Asset Path</label>
              <input
                type="text"
                id="image"
                name="image"
                className="form-control"
                placeholder="dog-grooming.jpg"
                value={formData.image}
                onChange={handleChange}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: '1.25rem', padding: '0.85rem' }}
            disabled={submitting}
          >
            <Save size={16} /> {submitting ? 'Saving Service...' : isEdit ? 'Update Service' : 'Create Service'}
          </button>
        </form>
      </div>
    </div>
  );
}
