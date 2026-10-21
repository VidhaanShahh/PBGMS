import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getServices, deleteService } from '../services/api';
import { Plus, Edit, Trash2, ArrowLeft, AlertCircle } from 'lucide-react';

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getServices();
      if (res.success) {
        setServices(res.services || []);
      }
    } catch (err) {
      setError(err.message || 'Error loading services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }
    setError('');
    setSuccess('');
    try {
      const res = await deleteService(id);
      if (res.success) {
        setSuccess('Service deleted successfully.');
        setServices((prev) => prev.filter((s) => s.id !== id));
      } else {
        setError(res.message || 'Failed to delete service.');
      }
    } catch (err) {
      setError(err.message || 'Failed to delete service.');
    }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem' }}>Manage Services</h1>
          <p style={{ color: 'var(--text-muted)' }}>Create, edit, and organize services available in the public catalog.</p>
        </div>
        <Link to="/admin/services/new" className="btn btn-primary">
          <Plus size={16} /> Add Service
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
          Loading service catalog...
        </div>
      ) : services.length === 0 ? (
        <div style={{ background: '#fff', padding: '3rem', textAlign: 'center', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)' }}>No services found.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Service Name</th>
                <th>Category</th>
                <th>Target Pet</th>
                <th>Price (LKR)</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr key={svc.id}>
                  <td style={{ width: '70px' }}>
                    <img
                      src={`/${svc.image || 'placeholder.svg'}`}
                      alt={svc.service_name}
                      style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                      onError={(e) => { e.target.src = '/placeholder.svg'; }}
                    />
                  </td>
                  <td>
                    <strong>{svc.service_name}</strong>
                  </td>
                  <td>
                    <span className="badge badge-category">{svc.category}</span>
                  </td>
                  <td>
                    <span className="badge badge-confirmed">{svc.target_pet_type}</span>
                  </td>
                  <td>
                    <strong style={{ color: 'var(--primary)' }}>
                      LKR {Number(svc.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <Link to={`/admin/services/edit/${svc.id}`} className="btn btn-secondary btn-sm" title="Edit Service">
                        <Edit size={14} /> Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(svc.id, svc.service_name)}
                        className="btn btn-danger btn-sm"
                        title="Delete Service"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
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
