import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getMyBookings, cancelBooking, getBookingCareLogs } from '../services/api';
import { formatINR, formatDateIN } from '../utils/formatters';
import { Calendar, CheckCircle2, Clock, XCircle, AlertCircle, FileText, ClipboardList } from 'lucide-react';

export default function MyBookings() {
  const [searchParams] = useSearchParams();
  const confirmedBookingNumber = searchParams.get('confirmed');

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [cancellingId, setCancellingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Care Logs Modal State
  const [activeCareModalBooking, setActiveCareModalBooking] = useState(null);
  const [bookingLogs, setBookingLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadBookings = () => {
    setLoading(true);
    getMyBookings()
      .then(res => {
        if (res.success) setBookings(res.data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleCancel = async (id, num) => {
    if (!window.confirm(`Are you sure you want to cancel booking #${num}? A cancellation fee may apply if cancelled within 48 hours of check-in.`)) {
      return;
    }
    setError('');
    setMessage('');
    try {
      const res = await cancelBooking(id);
      if (res.success) {
        setMessage(`Booking #${num} cancelled. Refund issued: ₹${(res.refund_issued || 0).toFixed(2)}.`);
        loadBookings();
      }
    } catch (err) {
      setError(err.message || 'Failed to cancel booking.');
    }
  };

  const handleViewCareLogs = async (b) => {
    setActiveCareModalBooking(b);
    setLoadingLogs(true);
    setBookingLogs([]);
    try {
      const res = await getBookingCareLogs(b.id);
      if (res.success) setBookingLogs(res.data);
    } catch {
      setBookingLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const filtered = bookings.filter(b => {
    if (filterType === 'ALL') return true;
    return b.booking_type === filterType;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Confirmed': return 'nb-badge-yellow';
      case 'Checked-in':
      case 'In Service': return 'nb-badge-mint';
      case 'Completed': return 'nb-badge-blue';
      case 'Cancelled': return 'nb-badge-coral';
      default: return 'nb-badge-white';
    }
  };

  return (
    <div className="nb-container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <div className="nb-badge nb-badge-mint" style={{ marginBottom: '0.4rem' }}>Booking Records</div>
          <h1 style={{ fontSize: '2.4rem' }}>My Reservations & History</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setFilterType('ALL')}
            className={`nb-btn nb-btn-sm ${filterType === 'ALL' ? '' : 'nb-btn-white'}`}
            style={{ background: filterType === 'ALL' ? 'var(--nb-yellow)' : '' }}
          >
            All Bookings
          </button>
          <button
            onClick={() => setFilterType('BOARDING')}
            className={`nb-btn nb-btn-sm ${filterType === 'BOARDING' ? '' : 'nb-btn-white'}`}
            style={{ background: filterType === 'BOARDING' ? 'var(--nb-yellow)' : '' }}
          >
            Boarding
          </button>
          <button
            onClick={() => setFilterType('GROOMING')}
            className={`nb-btn nb-btn-sm ${filterType === 'GROOMING' ? '' : 'nb-btn-white'}`}
            style={{ background: filterType === 'GROOMING' ? 'var(--nb-yellow)' : '' }}
          >
            Grooming
          </button>
        </div>
      </div>

      {confirmedBookingNumber && (
        <div className="nb-alert nb-alert-mint" style={{ marginBottom: '1.5rem' }}>
          <CheckCircle2 size={20} />
          <div>Success! Your reservation <strong>#{confirmedBookingNumber}</strong> has been recorded and confirmed.</div>
        </div>
      )}

      {message && <div className="nb-alert nb-alert-yellow">{message}</div>}
      {error && <div className="nb-alert nb-alert-coral">{error}</div>}

      {loading ? (
        <div className="nb-card" style={{ textAlign: 'center', padding: '3rem' }}>
          Loading your reservations...
        </div>
      ) : filtered.length === 0 ? (
        <div className="nb-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <Calendar size={48} color="#171717" style={{ marginBottom: '1rem' }} />
          <h3>No Bookings Found</h3>
          <p style={{ color: '#666', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            You do not currently have any {filterType !== 'ALL' ? filterType.toLowerCase() : ''} bookings registered.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/boarding/book" className="nb-btn nb-btn-coral">Book Boarding</Link>
            <Link to="/grooming/book" className="nb-btn" style={{ background: 'var(--nb-yellow)' }}>Reserve Grooming</Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {filtered.map(b => (
            <div key={b.id} className="nb-card" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1.5rem', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
                  <span className={`nb-badge ${getStatusBadge(b.status)}`}>{b.status}</span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.15rem' }}>
                    #{b.booking_number}
                  </span>
                  <span className="nb-badge nb-badge-white" style={{ fontSize: '0.7rem' }}>
                    {b.booking_type}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.3rem', marginTop: '0.25rem' }}>
                  {b.pet_name} ({b.pet_species} - {b.pet_breed})
                </h3>
                <p style={{ fontSize: '0.88rem', color: '#555', marginTop: '0.2rem' }}>
                  {b.booking_type === 'BOARDING'
                    ? `Suite: ${b.room_type || 'Standard'} (Room #${b.room_number || 'TBD'})`
                    : `Service: ${b.service_name || 'Grooming Treatment'}`}
                </p>

                {b.special_instructions && (
                  <p style={{ fontSize: '0.8rem', color: '#777', fontStyle: 'italic', marginTop: '0.25rem' }}>
                    Note: {b.special_instructions}
                  </p>
                )}
              </div>

              {/* Dates & Timing */}
              <div>
                <p style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', fontWeight: 700 }}>Schedule</p>
                <p style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.2rem' }}>
                  {formatDateIN(b.start_date)} {b.start_time ? `@ ${b.start_time}` : ''}
                </p>
                {b.end_date && (
                  <p style={{ fontSize: '0.88rem', color: '#444' }}>
                    to {formatDateIN(b.end_date)}
                  </p>
                )}
              </div>

              {/* Financial & Actions */}
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', fontWeight: 700 }}>Total (INR)</span>
                  <strong style={{ fontSize: '1.35rem', fontFamily: 'var(--font-heading)' }}>
                    {formatINR(b.total_price)}
                  </strong>
                </div>

                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: b.remaining_balance === 0 ? '#196E3F' : '#BA2D21' }}>
                  Paid: {formatINR(b.paid_amount)} | Due: {formatINR(b.remaining_balance)}
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                  {['Checked-in', 'In Service', 'Completed', 'Confirmed'].includes(b.status) && (
                    <button
                      onClick={() => handleViewCareLogs(b)}
                      className="nb-btn nb-btn-white nb-btn-sm"
                      title="View daily feeding, medication, and care activities"
                    >
                      <ClipboardList size={14} /> Care Logs
                    </button>
                  )}
                  {['Pending', 'Confirmed'].includes(b.status) && (
                    <button
                      onClick={() => handleCancel(b.id, b.booking_number)}
                      className="nb-btn nb-btn-white nb-btn-sm"
                      style={{ borderColor: '#D32F2F', color: '#D32F2F' }}
                    >
                      <XCircle size={14} /> Cancel Booking
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Booking Care Logs Modal ── */}
      {activeCareModalBooking && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="nb-card" style={{ maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <span className="nb-badge nb-badge-mint" style={{ marginBottom: '0.3rem' }}>Verified Care Logs</span>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Care Log for #{activeCareModalBooking.booking_number}</h2>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  {activeCareModalBooking.pet_name} ({activeCareModalBooking.pet_species})
                </span>
              </div>
              <button onClick={() => setActiveCareModalBooking(null)} className="nb-btn nb-btn-sm nb-btn-white">
                Close
              </button>
            </div>

            {loadingLogs ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: '#666' }}>Loading care logs...</div>
            ) : bookingLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#FAF7F0', border: '1.5px solid #171717', borderRadius: '6px' }}>
                <ClipboardList size={40} color="#777" style={{ marginBottom: '0.75rem' }} />
                <h4>No Care Activities Logged Yet</h4>
                <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.4rem', margin: 0 }}>
                  Daily feeding records, walks, medication, and care observations will appear here during this stay.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {bookingLogs.map(log => (
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
                      <span>Attendant: <strong>{log.attendant_name || 'Staff Member'}</strong> {log.attendant_role ? `(${log.attendant_role.replace('_', ' ')})` : ''}</span>
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
