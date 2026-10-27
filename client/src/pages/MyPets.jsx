import React, { useState, useEffect } from 'react';
import { getMyPets, addPet, updatePet, deletePet, addVaccination, getPetCareLogs, API_BASE } from '../services/api';
import { formatDateIN } from '../utils/formatters';
import { PawPrint, PlusCircle, Trash2, ShieldCheck, AlertCircle, Camera, Upload, Edit3, ClipboardList } from 'lucide-react';
import dogPlaceholder from '../assets/hero-dog.jpg';

export default function MyPets() {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [vaccinePetId, setVaccinePetId] = useState(null);
  const [uploadingPetId, setUploadingPetId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit Pet Behavior State
  const [editingPet, setEditingPet] = useState(null);
  const [behaviorData, setBehaviorData] = useState({
    behavioral_notes: '',
    feeding_instructions: '',
    allergies: '',
    weight: ''
  });

  // Care Log History State
  const [careLogPet, setCareLogPet] = useState(null);
  const [petCareLogs, setPetCareLogs] = useState([]);
  const [loadingCareLogs, setLoadingCareLogs] = useState(false);

  // New Pet Form State
  const [formData, setFormData] = useState({
    name: '',
    species: 'Dog',
    breed: '',
    dob: '',
    weight: '',
    sex: 'Male',
    feeding_instructions: '',
    medication_instructions: '',
    behavioral_notes: '',
    allergies: ''
  });

  // Vaccination Form State
  const [vacData, setVacData] = useState({
    vaccine_name: 'Rabies + DHPP 7-in-1',
    date_administered: new Date().toISOString().split('T')[0],
    expiration_date: ''
  });

  const loadPets = () => {
    setLoading(true);
    getMyPets()
      .then(res => {
        if (res.success) setPets(res.data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPets();
  }, []);

  const handleAddPet = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await addPet(formData);
      if (res.success) {
        setSuccess(`Pet "${formData.name}" registered successfully!`);
        setShowAddModal(false);
        setFormData({
          name: '',
          species: 'Dog',
          breed: '',
          dob: '',
          weight: '',
          sex: 'Male',
          feeding_instructions: '',
          medication_instructions: '',
          behavioral_notes: '',
          allergies: ''
        });
        loadPets();
      }
    } catch (err) {
      setError(err.message || 'Failed to add pet.');
    }
  };

  const handleDeletePet = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove ${name}'s profile?`)) return;
    setError('');
    setSuccess('');
    try {
      const res = await deletePet(id);
      if (res.success) {
        setSuccess(`Pet "${name}" removed.`);
        loadPets();
      }
    } catch (err) {
      setError(err.message || 'Cannot delete pet with active bookings.');
    }
  };

  const handleOpenEditBehavior = (pet) => {
    setEditingPet(pet);
    setError('');
    setSuccess('');
    setBehaviorData({
      behavioral_notes: pet.behavioral_notes || '',
      feeding_instructions: pet.feeding_instructions || '',
      allergies: pet.allergies || '',
      weight: pet.weight !== null && pet.weight !== undefined ? pet.weight : ''
    });
  };

  const handleSaveBehavior = async (e) => {
    e.preventDefault();
    if (!editingPet) return;
    setError('');
    setSuccess('');
    try {
      const res = await updatePet(editingPet.id, behaviorData);
      if (res.success) {
        setSuccess(`Behavioral profile updated for "${editingPet.name}".`);
        setEditingPet(null);
        loadPets();
      }
    } catch (err) {
      setError(err.message || 'Failed to update pet behavior.');
    }
  };

  const handleOpenCareLogs = async (pet) => {
    setCareLogPet(pet);
    setLoadingCareLogs(true);
    setPetCareLogs([]);
    try {
      const res = await getPetCareLogs(pet.id);
      if (res.success) {
        setPetCareLogs(res.data);
      }
    } catch {
      setPetCareLogs([]);
    } finally {
      setLoadingCareLogs(false);
    }
  };

  const handleAddVaccine = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await addVaccination(vaccinePetId, vacData);
      if (res.success) {
        setSuccess('Vaccination record logged successfully.');
        setVaccinePetId(null);
        loadPets();
      }
    } catch (err) {
      setError(err.message || 'Failed to add vaccine.');
    }
  };

  const handlePhotoUpload = async (petId, file) => {
    if (!file) return;
    setError('');
    setSuccess('');
    const form = new FormData();
    form.append('photo', file);

    const token = localStorage.getItem('pbgms_token') || localStorage.getItem('pcs_admin_token');
    try {
      const response = await fetch(`${API_BASE}/pets/${petId}/photo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Pet photograph updated successfully!');
        loadPets();
      } else {
        setError(data.message || 'Failed to upload photo.');
      }
    } catch (err) {
      setError('Network error during photo upload.');
    }
  };

  return (
    <div className="nb-container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <div className="nb-badge nb-badge-yellow" style={{ marginBottom: '0.4rem' }}>Owner Dashboard</div>
          <h1 style={{ fontSize: '2.4rem' }}>My Registered Pets</h1>
        </div>
        <button onClick={() => setShowAddModal(true)} className="nb-btn nb-btn-coral">
          <PlusCircle size={18} /> Add New Pet
        </button>
      </div>

      {error && <div className="nb-alert nb-alert-coral">{error}</div>}
      {success && <div className="nb-alert nb-alert-mint">{success}</div>}

      {loading ? (
        <div className="nb-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Loading pets...</p>
        </div>
      ) : pets.length === 0 ? (
        <div className="nb-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <PawPrint size={48} color="#171717" style={{ marginBottom: '1rem' }} />
          <h3>No Pets Registered Yet</h3>
          <p style={{ color: '#555', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            Add your furry companions to unlock boarding bookings and grooming reservations.
          </p>
          <button onClick={() => setShowAddModal(true)} className="nb-btn" style={{ background: 'var(--nb-yellow)' }}>
            Register First Pet
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '2rem' }}>
          {pets.map(pet => (
            <div key={pet.id} className="nb-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
              {/* Pet Photo Avatar & Basic Header */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{
                  position: 'relative',
                  width: '74px',
                  height: '74px',
                  borderRadius: '10px',
                  border: '2.5px solid #171717',
                  overflow: 'hidden',
                  background: '#F0EAD6',
                  boxShadow: '2px 2px 0px #171717',
                  flexShrink: 0
                }}>
                  <img
                    src={pet.photo || dogPlaceholder}
                    alt={pet.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <label
                    title="Upload new pet photo"
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'rgba(23,23,23,0.75)',
                      color: 'white',
                      textAlign: 'center',
                      fontSize: '0.65rem',
                      cursor: 'pointer',
                      padding: '2px 0'
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => e.target.files[0] && handlePhotoUpload(pet.id, e.target.files[0])}
                    />
                    Change
                  </label>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ fontSize: '1.45rem' }}>{pet.name}</h3>
                    <span className={`nb-badge ${pet.has_active_vaccine ? 'nb-badge-mint' : 'nb-badge-coral'}`} style={{ fontSize: '0.72rem' }}>
                      {pet.has_active_vaccine ? 'Vaccine OK' : 'Overdue'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.88rem', color: '#555', fontWeight: 600 }}>
                    {pet.breed} • {pet.species} ({pet.sex})
                  </span>
                </div>
              </div>

              {/* Pet Details Table */}
              <div style={{ background: '#FAF7F0', border: '1.5px solid #171717', borderRadius: '6px', padding: '0.85rem', marginBottom: '1rem', fontSize: '0.88rem' }}>
                <p><strong>Weight:</strong> {pet.weight ? `${pet.weight} kg` : 'Not specified'}</p>
                <p><strong>Feeding:</strong> {pet.feeding_instructions || 'Standard diet'}</p>
                <p><strong>Allergies:</strong> {pet.allergies || 'None reported'}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px dashed #DDD' }}>
                  <p style={{ margin: 0 }}><strong>Behavior:</strong> {pet.behavioral_notes || 'Friendly & gentle'}</p>
                  <button onClick={() => handleOpenEditBehavior(pet)} className="nb-btn nb-btn-sm nb-btn-white" style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }} title="Edit behavioral notes and temperament">
                    <Edit3 size={12} /> Edit Behavior
                  </button>
                </div>
              </div>

              {/* Vaccination list */}
              <div style={{ marginBottom: '1.5rem', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '0.85rem', textTransform: 'uppercase' }}>Vaccinations</strong>
                  <button onClick={() => setVaccinePetId(pet.id)} className="nb-btn nb-btn-white nb-btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                    + Add Vaccine
                  </button>
                </div>
                {pet.vaccinations && pet.vaccinations.length > 0 ? (
                  <ul style={{ listStyle: 'none', fontSize: '0.82rem' }}>
                    {pet.vaccinations.map(v => (
                      <li key={v.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #DDD', padding: '0.25rem 0' }}>
                        <span>💉 {v.vaccine_name}</span>
                        <span>Exp: {formatDateIN(v.expiration_date)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: '#888' }}>No vaccine records. Add core vaccines for boarding eligibility.</p>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px dashed #DDD', paddingTop: '0.85rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => handleOpenCareLogs(pet)} className="nb-btn nb-btn-white nb-btn-sm" title="View Attendant Daily Care Logs">
                  <ClipboardList size={14} /> Care History
                </button>
                <button onClick={() => handleDeletePet(pet.id, pet.name)} className="nb-btn nb-btn-white nb-btn-sm" style={{ color: '#D32F2F', borderColor: '#D32F2F' }}>
                  <Trash2 size={14} /> Remove Pet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Pet Modal ── */}
      {showAddModal && (
        <div className="nb-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="nb-card nb-modal-content" style={{ maxWidth: '540px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--nb-card)' }}>
            <h2 style={{ marginBottom: '1.25rem' }}>Register New Pet Profile</h2>
            <form onSubmit={handleAddPet}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="nb-label">Pet Name *</label>
                  <input
                    type="text"
                    required
                    className="nb-input"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Leo"
                  />
                </div>
                <div>
                  <label className="nb-label">Species *</label>
                  <select
                    className="nb-select"
                    value={formData.species}
                    onChange={e => setFormData({ ...formData, species: e.target.value })}
                  >
                    <option value="Dog">Dog</option>
                    <option value="Cat">Cat</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="nb-label">Breed</label>
                  <input
                    type="text"
                    className="nb-input"
                    value={formData.breed}
                    onChange={e => setFormData({ ...formData, breed: e.target.value })}
                    placeholder="e.g. Beagle"
                  />
                </div>
                <div>
                  <label className="nb-label">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="nb-input"
                    value={formData.weight}
                    onChange={e => setFormData({ ...formData, weight: e.target.value })}
                    placeholder="e.g. 14.5"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="nb-label">Behavioral Notes & Temperament</label>
                <textarea
                  className="nb-textarea"
                  rows={2}
                  style={{ resize: 'none' }}
                  value={formData.behavioral_notes}
                  onChange={e => setFormData({ ...formData, behavioral_notes: e.target.value })}
                  placeholder="e.g. Loves squeaky toys, gentle with kids, energetic"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="nb-label">Feeding Instructions</label>
                <textarea
                  className="nb-textarea"
                  rows={2}
                  style={{ resize: 'none' }}
                  value={formData.feeding_instructions}
                  onChange={e => setFormData({ ...formData, feeding_instructions: e.target.value })}
                  placeholder="e.g. 1 cup dry kibble 8 AM & 6 PM"
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="nb-label">Medical Alerts & Allergies</label>
                <textarea
                  className="nb-textarea"
                  rows={2}
                  style={{ resize: 'none' }}
                  value={formData.allergies}
                  onChange={e => setFormData({ ...formData, allergies: e.target.value })}
                  placeholder="Critical allergies or medication needs"
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="nb-btn nb-btn-white">
                  Cancel
                </button>
                <button type="submit" className="nb-btn nb-btn-coral">
                  Save Pet Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Vaccine Modal ── */}
      {vaccinePetId && (
        <div className="nb-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="nb-card nb-modal-content" style={{ maxWidth: '440px', width: '100%', background: 'var(--nb-card)' }}>
            <h3 style={{ marginBottom: '1rem' }}>Record Pet Vaccination</h3>
            <form onSubmit={handleAddVaccine}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="nb-label">Vaccine Name *</label>
                <input
                  type="text"
                  required
                  className="nb-input"
                  value={vacData.vaccine_name}
                  onChange={e => setVacData({ ...vacData, vaccine_name: e.target.value })}
                  placeholder="e.g. Rabies, DHPP, FVRCP"
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="nb-label">Date Administered</label>
                <input
                  type="date"
                  required
                  className="nb-input"
                  value={vacData.date_administered}
                  onChange={e => setVacData({ ...vacData, date_administered: e.target.value })}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="nb-label">Expiration Date *</label>
                <input
                  type="date"
                  required
                  className="nb-input"
                  value={vacData.expiration_date}
                  onChange={e => setVacData({ ...vacData, expiration_date: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setVaccinePetId(null)} className="nb-btn nb-btn-white">
                  Cancel
                </button>
                <button type="submit" className="nb-btn" style={{ background: 'var(--nb-yellow)' }}>
                  Log Vaccination
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Pet Behavior & Care Notes Modal ── */}
      {editingPet && (
        <div className="nb-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="nb-card nb-modal-content" style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--nb-card)' }}>
            <h3 style={{ marginBottom: '0.4rem' }}>Edit Behavioral Profile for {editingPet.name}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--nb-text-muted)', marginBottom: '1.25rem' }}>
              Update temperament, reactions, feeding schedule, and medical notes for boarding and grooming staff.
            </p>
            <form onSubmit={handleSaveBehavior}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="nb-label">Behavioral Notes & Temperament</label>
                <textarea
                  className="nb-textarea"
                  rows={3}
                  style={{ resize: 'none' }}
                  value={behaviorData.behavioral_notes}
                  onChange={e => setBehaviorData({ ...behaviorData, behavioral_notes: e.target.value })}
                  placeholder="e.g. Loves squeaky toys, energetic, gets nervous during thunderstorms"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="nb-label">Feeding Instructions</label>
                <textarea
                  className="nb-textarea"
                  rows={2}
                  style={{ resize: 'none' }}
                  value={behaviorData.feeding_instructions}
                  onChange={e => setBehaviorData({ ...behaviorData, feeding_instructions: e.target.value })}
                  placeholder="e.g. 1 cup dry kibble 8 AM & 6 PM"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="nb-label">Medical Alerts & Allergies</label>
                <textarea
                  className="nb-textarea"
                  rows={2}
                  style={{ resize: 'none' }}
                  value={behaviorData.allergies}
                  onChange={e => setBehaviorData({ ...behaviorData, allergies: e.target.value })}
                  placeholder="Critical allergies or medication needs"
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="nb-label">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  className="nb-input"
                  value={behaviorData.weight}
                  onChange={e => setBehaviorData({ ...behaviorData, weight: e.target.value })}
                  placeholder="e.g. 14.5"
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditingPet(null)} className="nb-btn nb-btn-white">
                  Cancel
                </button>
                <button type="submit" className="nb-btn nb-btn-coral">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Pet Care Log History Modal (Owner Portal) ── */}
      {careLogPet && (
        <div className="nb-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="nb-card nb-modal-content" style={{ maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--nb-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <span className="nb-badge nb-badge-mint" style={{ marginBottom: '0.3rem' }}>Shared Care History</span>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Daily Care Records for {careLogPet.name}</h2>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>{careLogPet.breed} • {careLogPet.species} ({careLogPet.sex})</span>
              </div>
              <button onClick={() => setCareLogPet(null)} className="nb-btn nb-btn-sm nb-btn-white">
                Close
              </button>
            </div>

            {loadingCareLogs ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: '#666' }}>Loading care logs...</div>
            ) : petCareLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#FAF7F0', border: '1.5px solid #171717', borderRadius: '6px' }}>
                <ClipboardList size={40} color="#777" style={{ marginBottom: '0.75rem' }} />
                <h4>No Care Logs Recorded Yet</h4>
                <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.4rem', margin: 0 }}>
                  Daily feeding updates, walks, medication administration, and health notes logged by attendants during boarding and grooming visits will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {petCareLogs.map(log => (
                  <div key={log.id} style={{ background: '#FAF7F0', border: '1.5px solid #171717', borderRadius: '6px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span className={`nb-badge ${
                        log.activity_type === 'Feeding' ? 'nb-badge-yellow' :
                        log.activity_type === 'Medication' ? 'nb-badge-coral' :
                        log.activity_type === 'Walk' ? 'nb-badge-mint' : 'nb-badge-blue'
                      }`} style={{ fontSize: '0.75rem' }}>
                        {log.activity_type}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 600 }}>
                        {formatDateIN(log.logged_at)} • {new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.92rem', color: '#171717', marginBottom: '0.4rem', lineHeight: 1.4 }}>
                      {log.notes}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#777', borderTop: '1px dashed #DDD', paddingTop: '0.35rem' }}>
                      <span>Recorded by: <strong>{log.attendant_name || 'Staff Attendant'}</strong> {log.attendant_role ? `(${log.attendant_role.replace('_', ' ')})` : ''}</span>
                      {log.booking_number && <span>Booking #{log.booking_number}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
