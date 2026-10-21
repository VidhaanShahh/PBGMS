import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getMyPets, getServices, getGroomingSlots, bookGrooming } from '../services/api';
import { formatINR } from '../utils/formatters';
import { Scissors, Sparkles, Clock, Calendar, CheckCircle } from 'lucide-react';

export default function BookGrooming() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialServiceId = searchParams.get('service_id') || '';

  const [pets, setPets] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState(initialServiceId);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [groomers, setGroomers] = useState([]);
  const [selectedGroomerId, setSelectedGroomerId] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');

  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getMyPets(), getServices({ category: 'Grooming' })])
      .then(([petRes, svcRes]) => {
        if (petRes.success) {
          setPets(petRes.data);
          if (petRes.data.length > 0) setSelectedPetId(petRes.data[0].id);
        }
        if (svcRes.success) {
          setServices(svcRes.data);
          if (!selectedServiceId && svcRes.data.length > 0) {
            setSelectedServiceId(svcRes.data[0].id);
          }
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Fetch grooming slots dynamically based on date
  useEffect(() => {
    if (date) {
      setLoadingSlots(true);
      getGroomingSlots(date, selectedServiceId)
        .then(res => {
          if (res.success) {
            setSlots(res.available_slots);
            if (res.available_slots.length > 0) {
              setSelectedSlot(res.available_slots[0]);
            } else {
              setSelectedSlot('');
            }
            setGroomers(res.groomers || []);
            if (res.groomers && res.groomers.length > 0 && !selectedGroomerId) {
              setSelectedGroomerId(res.groomers[0].id);
            }
          }
        })
        .catch(console.error)
        .finally(() => setLoadingSlots(false));
    }
  }, [date, selectedServiceId]);

  const selectedService = services.find(s => Number(s.id) === Number(selectedServiceId));

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedPetId) {
      setError('Please select a pet.');
      return;
    }
    if (!selectedSlot) {
      setError('Please select an available grooming time slot.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        pet_id: selectedPetId,
        service_id: selectedServiceId,
        staff_id: selectedGroomerId || null,
        start_date: date,
        start_time: selectedSlot,
        special_instructions: specialInstructions,
        payment_method: paymentMethod
      };

      const res = await bookGrooming(payload);
      if (res.success) {
        navigate(`/my-bookings?confirmed=${res.data.booking_number}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to book grooming appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="nb-container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>Loading grooming options...</div>;
  }

  return (
    <div className="nb-container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div className="nb-badge nb-badge-mint" style={{ marginBottom: '0.4rem' }}>Grooming Scheduling Engine</div>
        <h1 style={{ fontSize: '2.5rem' }}>Schedule Master Grooming Spa</h1>
        <p style={{ color: '#555', marginTop: '0.25rem' }}>
          Real-time slot reservation based on groomer schedules, service durations, and transparent pricing in Indian Rupees.
        </p>
      </div>

      {error && <div className="nb-alert nb-alert-coral">{error}</div>}

      {pets.length === 0 ? (
        <div className="nb-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3>No Registered Pets</h3>
          <p style={{ margin: '1rem 0' }}>Please register a pet profile before scheduling an appointment.</p>
          <button onClick={() => navigate('/my-pets')} className="nb-btn nb-btn-coral">
            Add Pet Profile
          </button>
        </div>
      ) : (
        <form onSubmit={handleBookingSubmit} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Step 1: Pet & Service */}
            <div className="nb-card">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>1. Guest & Service Selection</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="nb-label">Pet *</label>
                  <select
                    className="nb-select"
                    value={selectedPetId}
                    onChange={e => setSelectedPetId(e.target.value)}
                  >
                    {pets.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.species})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="nb-label">Grooming Service *</label>
                  <select
                    className="nb-select"
                    value={selectedServiceId}
                    onChange={e => setSelectedServiceId(e.target.value)}
                  >
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.service_name} - {formatINR(s.price)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedService && (
                <p style={{ fontSize: '0.88rem', color: '#555', marginTop: '0.75rem', lineHeight: '1.5' }}>
                  {selectedService.description}
                </p>
              )}
            </div>

            {/* Step 2: Date & Available Slots */}
            <div className="nb-card">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>2. Choose Date & Time Slot</h3>
              <div style={{ marginBottom: '1rem' }}>
                <label className="nb-label">Appointment Date *</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="nb-input"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>

              <label className="nb-label">Available Time Slots</label>
              {loadingSlots ? (
                <p style={{ fontSize: '0.85rem', color: '#666' }}>Calculating groomer availability...</p>
              ) : slots.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {slots.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedSlot(s)}
                      style={{
                        padding: '0.65rem',
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        border: selectedSlot === s ? '2.5px solid #171717' : '1.5px solid #171717',
                        background: selectedSlot === s ? 'var(--nb-yellow)' : '#FFF',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        boxShadow: selectedSlot === s ? '3px 3px 0px #171717' : 'none'
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="nb-alert nb-alert-yellow">No available slots on this date. Please pick another date.</div>
              )}
            </div>

            {/* Step 3: Preferred Groomer */}
            <div className="nb-card">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>3. Preferred Master Groomer (Optional)</h3>
              <select
                className="nb-select"
                value={selectedGroomerId}
                onChange={e => setSelectedGroomerId(e.target.value)}
              >
                <option value="">Any Available Groomer</option>
                {groomers.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Step 4: Special Instructions */}
            <div className="nb-card">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>4. Styling & Temperament Notes</h3>
              <textarea
                className="nb-textarea"
                rows={2}
                style={{ resize: 'none' }}
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Sensitive paws, prefers gentle hand-drying, teddy cut requested"
              />
            </div>
          </div>

          {/* Right Summary */}
          <div>
            <div className="nb-card" style={{ position: 'sticky', top: '100px' }}>
              <div className="nb-badge nb-badge-yellow" style={{ marginBottom: '1rem' }}>Booking Summary</div>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Appointment Checkout</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem', marginBottom: '1rem', borderBottom: '2px dashed #DDD', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Service:</span>
                  <strong>{selectedService?.service_name || '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Date:</span>
                  <strong>{date}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Time Slot:</span>
                  <strong>{selectedSlot || 'Not Selected'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 800, marginTop: '0.5rem' }}>
                  <span>Amount Due:</span>
                  <span>{formatINR(selectedService?.price || 0)}</span>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="nb-label">Payment Option</label>
                <select
                  className="nb-select"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  <option value="UPI">UPI Instant (Google Pay, PhonePe)</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Pay in Person">Pay at Appointment (Front Desk)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedSlot}
                className="nb-btn nb-btn-coral"
                style={{ width: '100%', padding: '0.85rem' }}
              >
                {submitting ? 'Confirming...' : `Confirm Appointment (${formatINR(selectedService?.price || 0)})`}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
