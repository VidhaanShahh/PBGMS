import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyPets, getRooms, checkBoardingAvailability, bookBoarding } from '../services/api';
import { formatINR } from '../utils/formatters';
import { Calendar, ShieldAlert, CheckCircle, Info, Home as HomeIcon } from 'lucide-react';

export default function BookBoarding() {
  const navigate = useNavigate();
  const [pets, setPets] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('UPI');

  const [loading, setLoading] = useState(true);
  const [checkingRooms, setCheckingRooms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addonOptions = [
    { name: 'Extra 45-min Play Session', price: 350 },
    { name: 'Medication Administration Protocol', price: 250 },
    { name: 'Gourmet Organic Meal Topper', price: 200 },
    { name: 'Daily HD Video Update to Owner', price: 300 }
  ];

  useEffect(() => {
    Promise.all([getMyPets(), getRooms()])
      .then(([petRes, roomRes]) => {
        if (petRes.success) {
          setPets(petRes.data);
          if (petRes.data.length > 0) setSelectedPetId(petRes.data[0].id);
        }
        if (roomRes.success) {
          setRooms(roomRes.data);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Recalculate room availability on date changes
  useEffect(() => {
    if (startDate && endDate && new Date(endDate) > new Date(startDate)) {
      setCheckingRooms(true);
      checkBoardingAvailability({ start_date: startDate, end_date: endDate })
        .then(res => {
          if (res.success) {
            setAvailableRooms(res.data);
            if (res.data.length > 0) {
              setSelectedRoomId(res.data[0].id);
            } else {
              setSelectedRoomId('');
            }
          }
        })
        .catch(console.error)
        .finally(() => setCheckingRooms(false));
    } else {
      setAvailableRooms([]);
    }
  }, [startDate, endDate]);

  const selectedPet = pets.find(p => Number(p.id) === Number(selectedPetId));
  const selectedRoom = (availableRooms.length > 0 ? availableRooms : rooms).find(r => Number(r.id) === Number(selectedRoomId));

  // Calculate pricing
  const nights = (startDate && endDate && new Date(endDate) > new Date(startDate))
    ? Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)))
    : 0;

  const roomTotal = selectedRoom ? nights * selectedRoom.daily_rate : 0;
  const addonsTotal = selectedAddons.reduce((acc, curr) => acc + curr.price, 0);
  const grandTotal = roomTotal + addonsTotal;
  const depositDue = grandTotal * 0.20; // BR-6 default 20%

  const toggleAddon = (addon) => {
    if (selectedAddons.some(a => a.name === addon.name)) {
      setSelectedAddons(selectedAddons.filter(a => a.name !== addon.name));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedPet) {
      setError('Please add or select a pet first.');
      return;
    }

    if (!selectedPet.has_active_vaccine) {
      setError('Vaccination Notice: This pet does not have active core vaccination on file. Boarding booking is blocked until vaccination is logged.');
      return;
    }

    if (!selectedRoomId) {
      setError('Please select an available room/kennel.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        pet_id: selectedPetId,
        room_id: selectedRoomId,
        start_date: startDate,
        end_date: endDate,
        special_instructions: specialInstructions,
        addons: selectedAddons,
        payment_method: paymentMethod
      };

      const res = await bookBoarding(payload);
      if (res.success) {
        navigate(`/my-bookings?confirmed=${res.data.booking_number}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to complete boarding booking.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="nb-container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>Loading booking engine...</div>;
  }

  return (
    <div className="nb-container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div className="nb-badge nb-badge-coral" style={{ marginBottom: '0.4rem' }}>Boarding Reservation Engine</div>
        <h1 style={{ fontSize: '2.5rem' }}>Reserve a Boarding Stay</h1>
        <p style={{ color: '#555', marginTop: '0.25rem' }}>
          Select your registered pet, stay dates, preferred suite, and confirm with transparent 20% online deposit in INR.
        </p>
      </div>

      {error && (
        <div className="nb-alert nb-alert-coral" style={{ marginBottom: '1.5rem' }}>
          <ShieldAlert size={20} />
          <div>{error}</div>
        </div>
      )}

      {pets.length === 0 ? (
        <div className="nb-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3>No registered pets found!</h3>
          <p style={{ margin: '1rem 0' }}>You must add a pet with active vaccination records before booking boarding.</p>
          <button onClick={() => navigate('/my-pets')} className="nb-btn nb-btn-coral">
            Go to My Pets to Add Pet
          </button>
        </div>
      ) : (
        <form onSubmit={handleBookingSubmit} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2.5rem' }}>
          {/* Left Form Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Step 1: Pet Selection & Vaccine Status */}
            <div className="nb-card">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>1. Select Boarding Guest</h3>
              <label className="nb-label">Registered Pet *</label>
              <select
                className="nb-select"
                value={selectedPetId}
                onChange={e => setSelectedPetId(e.target.value)}
              >
                {pets.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.species} - {p.breed}) {p.has_active_vaccine ? '✓ Vaccine OK' : '⚠ Vaccine Overdue'}
                  </option>
                ))}
              </select>

              {selectedPet && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: selectedPet.has_active_vaccine ? '#EAFBF2' : '#FEECEB', border: '1.5px solid #171717', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: selectedPet.has_active_vaccine ? '#196E3F' : '#BA2D21' }}>
                    {selectedPet.has_active_vaccine
                      ? '✓ Core vaccinations verified. Pet is eligible for boarding.'
                      : '⚠ Ineligible: An active core vaccination is required before boarding. Please update vaccination records.'}
                  </span>
                </div>
              )}
            </div>

            {/* Step 2: Dates */}
            <div className="nb-card">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>2. Stay Dates (Max 12 Months)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="nb-label">Check-in Date *</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="nb-input"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="nb-label">Check-out Date *</label>
                  <input
                    type="date"
                    required
                    min={startDate || new Date().toISOString().split('T')[0]}
                    className="nb-input"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              {nights > 0 && (
                <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>
                  Stay duration: <span style={{ color: 'var(--nb-blue)' }}>{nights} night(s)</span>
                </p>
              )}
            </div>

            {/* Step 3: Room Selection */}
            <div className="nb-card">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>3. Select Room / Kennel</h3>
              {checkingRooms ? (
                <p style={{ fontSize: '0.9rem', color: '#666' }}>Checking real-time availability in database...</p>
              ) : availableRooms.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                  {availableRooms.map(r => (
                    <label
                      key={r.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        border: selectedRoomId === String(r.id) ? '2.5px solid #171717' : '1.5px solid #DDD',
                        background: selectedRoomId === String(r.id) ? 'var(--nb-yellow)' : '#FFF',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <input
                          type="radio"
                          name="room_id"
                          value={r.id}
                          checked={selectedRoomId === String(r.id)}
                          onChange={e => setSelectedRoomId(e.target.value)}
                        />
                        <div>
                          <strong>{r.room_type}</strong> (Room #{r.room_number})
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#555' }}>Capacity: {r.capacity} pet(s)</span>
                        </div>
                      </div>
                      <span style={{ fontWeight: 800 }}>{formatINR(r.daily_rate)} / night</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.88rem', color: '#666' }}>
                  {startDate && endDate ? 'No rooms available for the selected dates. Try altering dates.' : 'Select check-in and check-out dates above to inspect availability.'}
                </p>
              )}
            </div>

            {/* Step 4: Add-on Services */}
            <div className="nb-card">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>4. Optional Add-on Services</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {addonOptions.map((addon, idx) => {
                  const isChecked = selectedAddons.some(a => a.name === addon.name);
                  return (
                    <label
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        background: isChecked ? '#FFFBE6' : '#FAF8F4',
                        border: '1.5px solid #171717',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleAddon(addon)}
                        />
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{addon.name}</span>
                      </div>
                      <span style={{ fontWeight: 700 }}>+{formatINR(addon.price)}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Step 5: Special Care Instructions */}
            <div className="nb-card">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>5. Booking Care Instructions</h3>
              <textarea
                className="nb-textarea"
                rows={3}
                style={{ resize: 'none' }}
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="Specific feeding schedule, favorite toy notes, or pickup notes for this stay"
              />
            </div>
          </div>

          {/* Right Summary Column */}
          <div>
            <div className="nb-card" style={{ position: 'sticky', top: '100px', background: '#FFFFFF' }}>
              <div className="nb-badge nb-badge-mint" style={{ marginBottom: '1rem' }}>Price & Settlement Summary</div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1.25rem' }}>Reservation Total</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.92rem', marginBottom: '1.25rem', borderBottom: '2px dashed #E0DCD3', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Nights:</span>
                  <strong>{nights}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Base Room Rate:</span>
                  <strong>{formatINR(roomTotal)}</strong>
                </div>
                {addonsTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Selected Addons:</span>
                    <strong>+{formatINR(addonsTotal)}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 800, marginTop: '0.5rem' }}>
                  <span>Grand Total:</span>
                  <span>{formatINR(grandTotal)}</span>
                </div>
              </div>

              {/* Deposit Policy BR-6 */}
              <div style={{ background: '#FFF9DB', border: '1.5px solid #171717', borderRadius: '6px', padding: '0.85rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.95rem' }}>
                  <span>20% Online Deposit (Due Now):</span>
                  <span style={{ color: '#995B00' }}>{formatINR(depositDue)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#555', marginTop: '0.35rem' }}>
                  <span>Remaining at Check-out:</span>
                  <span>{formatINR(grandTotal - depositDue)}</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="nb-label">Deposit Payment Method</label>
                <select
                  className="nb-select"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
                  <option value="Credit Card">Credit Card (Visa / Mastercard / RuPay)</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Net Banking">Net Banking</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedRoomId || nights === 0}
                className="nb-btn nb-btn-coral"
                style={{ width: '100%', padding: '0.85rem', fontSize: '1.05rem' }}
              >
                {submitting ? 'Processing...' : `Confirm & Pay Deposit ${formatINR(depositDue)}`}
              </button>

              <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.75rem', textAlign: 'center' }}>
                Fully refundable if cancelled 48 hours before check-in.
              </p>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
