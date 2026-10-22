import React, { useState, useEffect } from 'react';
import {
  getGroomerDashboard,
  getGroomingSession,
  startGroomingSession,
  updateGroomingChecklist,
  completeGroomingSession
} from '../services/api';
import { formatDateIN } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import {
  Scissors,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PawPrint,
  CheckSquare,
  Sparkles,
  ClipboardList,
  RefreshCw,
  Eye,
  HeartPulse
} from 'lucide-react';

export default function GroomerPortal() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  // Active Session Modal
  const [activeBooking, setActiveBooking] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [loadingSession, setLoadingSession] = useState(false);

  // Checklist Form State
  const [checklist, setChecklist] = useState({
    checklist_bathing: false,
    checklist_drying: false,
    checklist_brushing: false,
    checklist_nail_trimming: false,
    checklist_ear_cleaning: false,
    checklist_hair_trimming: false,
    checklist_coat_inspection: false,
    checklist_final_inspection: false,
    coat_condition: '',
    skin_condition: '',
    behavior_notes: '',
    incident_notes: '',
    products_used: '',
    recommendations: '',
    handover_notes: ''
  });

  const loadDashboard = () => {
    setLoading(true);
    setActionMessage('');
    setActionError('');
    getGroomerDashboard()
      .then(res => {
        if (res.success) setDashboardData(res.data);
      })
      .catch(err => setActionError(err.message || 'Failed to load groomer dashboard.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleOpenSession = async (booking) => {
    setActiveBooking(booking);
    setLoadingSession(true);
    setActionMessage('');
    setActionError('');
    try {
      const res = await getGroomingSession(booking.id);
      if (res.success) {
        setSessionData(res.session);
        setSessionHistory(res.history || []);
        if (res.session) {
          setChecklist({
            checklist_bathing: Boolean(res.session.checklist_bathing),
            checklist_drying: Boolean(res.session.checklist_drying),
            checklist_brushing: Boolean(res.session.checklist_brushing),
            checklist_nail_trimming: Boolean(res.session.checklist_nail_trimming),
            checklist_ear_cleaning: Boolean(res.session.checklist_ear_cleaning),
            checklist_hair_trimming: Boolean(res.session.checklist_hair_trimming),
            checklist_coat_inspection: Boolean(res.session.checklist_coat_inspection),
            checklist_final_inspection: Boolean(res.session.checklist_final_inspection),
            coat_condition: res.session.coat_condition || '',
            skin_condition: res.session.skin_condition || '',
            behavior_notes: res.session.behavior_notes || '',
            incident_notes: res.session.incident_notes || '',
            products_used: res.session.products_used || '',
            recommendations: res.session.recommendations || '',
            handover_notes: res.session.handover_notes || ''
          });
        }
      }
    } catch (err) {
      setActionError(err.message || 'Failed to load session details.');
    } finally {
      setLoadingSession(false);
    }
  };

  const handleStartSession = async () => {
    try {
      const res = await startGroomingSession(activeBooking.id);
      if (res.success) {
        setActionMessage(res.message);
        handleOpenSession(activeBooking);
        loadDashboard();
      }
    } catch (err) {
      setActionError(err.message || 'Failed to start session.');
    }
  };

  const handleSaveChecklist = async () => {
    try {
      const res = await updateGroomingChecklist(activeBooking.id, checklist);
      if (res.success) {
        setActionMessage('Grooming checklist and notes saved successfully.');
      }
    } catch (err) {
      setActionError(err.message || 'Failed to save checklist.');
    }
  };

  const handleCompleteSession = async () => {
    if (!window.confirm('Complete grooming session and notify Front Desk that the pet is Ready for Collection?')) return;
    try {
      await updateGroomingChecklist(activeBooking.id, checklist);
      const res = await completeGroomingSession(activeBooking.id, {
        handover_notes: checklist.handover_notes,
        recommendations: checklist.recommendations
      });
      if (res.success) {
        setActionMessage(res.message);
        setActiveBooking(null);
        loadDashboard();
      }
    } catch (err) {
      setActionError(err.message || 'Failed to complete session.');
    }
  };

  const todayList = dashboardData?.today_appointments || [];
  const upcomingList = dashboardData?.upcoming_appointments || [];
  const safetyList = dashboardData?.safety_alerts || [];

  return (
    <div className="nb-container" style={{ padding: '2.5rem 1.5rem' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div className="nb-badge nb-badge-mint" style={{ marginBottom: '0.4rem' }}>
            <Scissors size={14} /> Groomer Studio Portal
          </div>
          <h1 style={{ fontSize: '2.4rem' }}>Grooming Spa & Styling Studio</h1>
          <p style={{ color: '#666', fontSize: '0.95rem' }}>
            Logged in as <strong>{user?.name || 'Master Groomer'}</strong> • Service delivery, clinical observations, and pet care.
          </p>
        </div>
        <button onClick={loadDashboard} className="nb-btn nb-btn-white nb-btn-sm" title="Refresh Live Records">
          <RefreshCw size={14} /> Refresh Queue
        </button>
      </div>

      {actionMessage && <div className="nb-alert nb-alert-mint" style={{ marginBottom: '1.5rem' }}>{actionMessage}</div>}
      {actionError && <div className="nb-alert nb-alert-coral" style={{ marginBottom: '1.5rem' }}>{actionError}</div>}

      {/* ── Metric Cards ── */}
      {dashboardData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="nb-card nb-card-yellow" style={{ padding: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Today's Appts</span>
            <strong style={{ display: 'block', fontSize: '1.9rem', fontFamily: 'var(--font-heading)', marginTop: '0.2rem' }}>
              {dashboardData.today_total}
            </strong>
            <span style={{ fontSize: '0.72rem', color: '#444' }}>Scheduled for Today</span>
          </div>

          <div className="nb-card" style={{ padding: '1.25rem', background: '#FFFFFF' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#666' }}>Waiting in Lobby</span>
            <strong style={{ display: 'block', fontSize: '1.9rem', fontFamily: 'var(--font-heading)', marginTop: '0.2rem', color: '#171717' }}>
              {dashboardData.waiting_for_grooming}
            </strong>
            <span style={{ fontSize: '0.72rem', color: '#666' }}>Checked-in by Front Desk</span>
          </div>

          <div className="nb-card nb-card-mint" style={{ padding: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>In Service</span>
            <strong style={{ display: 'block', fontSize: '1.9rem', fontFamily: 'var(--font-heading)', marginTop: '0.2rem' }}>
              {dashboardData.in_service}
            </strong>
            <span style={{ fontSize: '0.72rem', color: '#444' }}>Active Spa Sessions</span>
          </div>

          <div className="nb-card nb-card-coral" style={{ padding: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Ready for Pickup</span>
            <strong style={{ display: 'block', fontSize: '1.9rem', fontFamily: 'var(--font-heading)', marginTop: '0.2rem' }}>
              {dashboardData.ready_for_collection}
            </strong>
            <span style={{ fontSize: '0.72rem' }}>Groom Completed</span>
          </div>

          <div className="nb-card" style={{ padding: '1.25rem', background: '#FFFFFF' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#BA2D21' }}>Safety Alerts</span>
            <strong style={{ display: 'block', fontSize: '1.9rem', fontFamily: 'var(--font-heading)', marginTop: '0.2rem', color: '#BA2D21' }}>
              {dashboardData.safety_alerts_count}
            </strong>
            <span style={{ fontSize: '0.72rem', color: '#666' }}>Allergies / Special Handling</span>
          </div>
        </div>
      )}

      {/* ── Safety Alerts Banner if any ── */}
      {safetyList.length > 0 && (
        <div className="nb-card nb-card-coral" style={{ marginBottom: '2rem', padding: '1rem 1.5rem' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', fontSize: '1.1rem' }}>
            <AlertTriangle size={18} /> Pet Safety Alerts for Today's Appointments
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem' }}>
            {safetyList.map(s => (
              <div key={s.id}>
                <strong>{s.pet_name}</strong> ({s.pet_breed}): {s.allergies ? `Allergies: ${s.allergies}. ` : ''}{s.behavioral_notes ? `Handling note: ${s.behavioral_notes}` : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Today's Grooming Queue ── */}
      <div className="nb-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={20} color="#171717" /> Today's Grooming Appointments Queue ({todayList.length})
        </h3>

        {todayList.length === 0 ? (
          <p style={{ color: '#666', padding: '1.5rem 0' }}>No grooming appointments scheduled for today.</p>
        ) : (
          <div className="nb-table-container">
            <table className="nb-table">
              <thead>
                <tr>
                  <th>Booking #</th>
                  <th>Guest Pet</th>
                  <th>Service Booked</th>
                  <th>Appointment Time</th>
                  <th>Status</th>
                  <th>Safety Alerts</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {todayList.map(b => (
                  <tr key={b.id}>
                    <td><strong>#{b.booking_number}</strong></td>
                    <td>
                      <strong>{b.pet_name}</strong> ({b.pet_species} - {b.pet_breed})
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#666' }}>Owner: {b.owner_name} ({b.owner_phone})</span>
                    </td>
                    <td>
                      <strong>{b.service_name}</strong>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#666' }}>{b.duration_minutes} mins</span>
                    </td>
                    <td>
                      <strong>{b.start_time || '09:00 AM'}</strong>
                    </td>
                    <td>
                      <span className={`nb-badge ${
                        b.status === 'Ready for Collection' ? 'nb-badge-coral' :
                        b.status === 'In Service' ? 'nb-badge-mint' :
                        b.status === 'Completed' ? 'nb-badge-blue' :
                        b.status === 'Checked-in' ? 'nb-badge-yellow' :
                        'nb-badge-white'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td>
                      {b.allergies ? (
                        <span className="nb-badge nb-badge-coral" style={{ fontSize: '0.72rem' }}>
                          <AlertTriangle size={12} /> {b.allergies}
                        </span>
                      ) : <span style={{ color: '#888', fontSize: '0.8rem' }}>None</span>}
                    </td>
                    <td>
                      <button
                        onClick={() => handleOpenSession(b)}
                        className="nb-btn nb-btn-sm nb-btn-yellow"
                        title="Open Grooming Checklist & Session"
                      >
                        <Scissors size={14} /> Open Session
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Upcoming Schedule Preview ── */}
      <div className="nb-card">
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={18} color="#171717" /> Upcoming Assigned Appointments
        </h3>
        {upcomingList.length === 0 ? (
          <p style={{ color: '#666', padding: '1rem 0' }}>No upcoming grooming appointments found in schedule.</p>
        ) : (
          <div className="nb-table-container">
            <table className="nb-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Booking #</th>
                  <th>Guest Pet</th>
                  <th>Service</th>
                  <th>Customer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingList.map(u => (
                  <tr key={u.id}>
                    <td><strong>{formatDateIN(u.start_date)}</strong> @ {u.start_time}</td>
                    <td>#{u.booking_number}</td>
                    <td>{u.pet_name} ({u.pet_breed})</td>
                    <td>{u.service_name} ({u.duration_minutes}m)</td>
                    <td>{u.owner_name}</td>
                    <td><span className="nb-badge nb-badge-white" style={{ fontSize: '0.72rem' }}>{u.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Grooming Session Execution Modal with Checklist ── */}
      {activeBooking && (
        <div className="nb-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="nb-card nb-modal-content" style={{ maxWidth: '680px', width: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid #171717', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <span className="nb-badge nb-badge-yellow" style={{ marginBottom: '0.3rem' }}>Grooming Session Engine</span>
                <h2 style={{ fontSize: '1.6rem', margin: 0 }}>{activeBooking.pet_name} — {activeBooking.service_name}</h2>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  Booking #{activeBooking.booking_number} • {activeBooking.pet_species} ({activeBooking.pet_breed}) • Status: <strong>{activeBooking.status}</strong>
                </span>
              </div>
              <button onClick={() => setActiveBooking(null)} className="nb-btn nb-btn-sm nb-btn-white">✕</button>
            </div>

            {loadingSession ? (
              <p style={{ textAlign: 'center', padding: '2rem' }}>Loading session checklist...</p>
            ) : (
              <div>
                {/* Pet Safety & Instructions Box */}
                <div style={{ background: '#FFF8E7', border: '2px solid #171717', borderRadius: '6px', padding: '0.85rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <div><strong>Allergies:</strong> {activeBooking.allergies || 'None reported'}</div>
                    <div><strong>Owner Instructions:</strong> {activeBooking.special_instructions || 'Standard styling requested'}</div>
                    <div><strong>Behavior Notes:</strong> {activeBooking.behavioral_notes || 'Friendly temperament'}</div>
                    <div><strong>Weight:</strong> {activeBooking.weight ? `${activeBooking.weight} kg` : 'Not recorded'}</div>
                  </div>
                </div>

                {/* Session Start / Progress Status */}
                {activeBooking.status === 'Confirmed' || activeBooking.status === 'Checked-in' ? (
                  <div style={{ textAlign: 'center', padding: '1rem', background: '#F4F0E8', border: '2px dashed #171717', borderRadius: '6px', marginBottom: '1.25rem' }}>
                    <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Pet is ready to begin grooming.</p>
                    <button onClick={handleStartSession} className="nb-btn nb-btn-mint">
                      <Scissors size={16} /> Start Grooming Session (Mark In Service)
                    </button>
                  </div>
                ) : null}

                {/* Interactive Checklist */}
                <h4 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckSquare size={16} /> Grooming Service Checklist
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  {[
                    { key: 'checklist_bathing', label: '1. Bathing & Cleansing' },
                    { key: 'checklist_drying', label: '2. High-Velocity / Warm Blow Dry' },
                    { key: 'checklist_brushing', label: '3. Coat Brushing & De-shedding' },
                    { key: 'checklist_nail_trimming', label: '4. Nail Dremel & Trimming' },
                    { key: 'checklist_ear_cleaning', label: '5. Ear Cleansing & Inspection' },
                    { key: 'checklist_hair_trimming', label: '6. Breed Haircut / Sanitary Trim' },
                    { key: 'checklist_coat_inspection', label: '7. Skin & Coat Health Check' },
                    { key: 'checklist_final_inspection', label: '8. Final Quality & Fragrance Check' }
                  ].map(item => (
                    <label
                      key={item.key}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.5rem 0.75rem', border: '1.5px solid #171717', borderRadius: '6px',
                        background: checklist[item.key] ? 'var(--nb-mint)' : '#FFFFFF', cursor: 'pointer',
                        fontSize: '0.85rem', fontWeight: 600
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checklist[item.key]}
                        onChange={e => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--nb-black)' }}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>

                {/* Clinical Grooming Observations */}
                <h4 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <HeartPulse size={16} /> Groomer Observations & Notes
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.2rem' }}>Coat Condition</label>
                    <input
                      type="text"
                      className="nb-input"
                      placeholder="e.g. Healthy, slight matting on ears"
                      value={checklist.coat_condition}
                      onChange={e => setChecklist(prev => ({ ...prev, coat_condition: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.2rem' }}>Skin Condition</label>
                    <input
                      type="text"
                      className="nb-input"
                      placeholder="e.g. Clean, no redness or parasites"
                      value={checklist.skin_condition}
                      onChange={e => setChecklist(prev => ({ ...prev, skin_condition: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.2rem' }}>Behavior During Grooming</label>
                  <textarea
                    className="nb-textarea"
                    style={{ resize: 'none' }}
                    rows={2}
                    placeholder="e.g. Very cooperative during bath. Slight paw sensitivity during nail trim."
                    value={checklist.behavior_notes}
                    onChange={e => setChecklist(prev => ({ ...prev, behavior_notes: e.target.value }))}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.2rem' }}>Recommendations for Pet Owner</label>
                  <input
                    type="text"
                    className="nb-input"
                    placeholder="e.g. Regular daily brushing recommended; book de-shedding spa in 4 weeks."
                    value={checklist.recommendations}
                    onChange={e => setChecklist(prev => ({ ...prev, recommendations: e.target.value }))}
                  />
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.2rem' }}>Front Desk Handover Note (Staff Internal)</label>
                  <input
                    type="text"
                    className="nb-input"
                    placeholder="e.g. All mats cleared. Tell owner to use conditioning spray."
                    value={checklist.handover_notes}
                    onChange={e => setChecklist(prev => ({ ...prev, handover_notes: e.target.value }))}
                  />
                </div>

                {/* Previous History Accordion */}
                {sessionHistory.length > 0 && (
                  <div style={{ background: '#F8F8F8', border: '1px solid #171717', borderRadius: '6px', padding: '0.75rem', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#666' }}>Previous Grooming Sessions</span>
                    {sessionHistory.map(h => (
                      <div key={h.id} style={{ fontSize: '0.82rem', marginTop: '0.35rem', borderBottom: '1px solid #E0E0E0', paddingBottom: '0.35rem' }}>
                        <strong>{formatDateIN(h.start_date)}</strong>: {h.service_name} by {h.groomer_name} — {h.behavior_notes || 'No behavioral notes recorded'}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #171717', paddingTop: '1rem' }}>
                  <button type="button" onClick={handleSaveChecklist} className="nb-btn nb-btn-white nb-btn-sm">
                    Save Progress
                  </button>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="button" onClick={() => setActiveBooking(null)} className="nb-btn nb-btn-white nb-btn-sm">
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={handleCompleteSession}
                      className="nb-btn nb-btn-coral"
                      disabled={activeBooking.status === 'Completed' || activeBooking.status === 'Ready for Collection'}
                    >
                      <CheckCircle2 size={16} /> Complete & Mark Ready for Collection
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
