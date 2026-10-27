import React, { useState, useEffect } from 'react';
import {
  getDashboardStats,
  getMyBookings,
  processCheckIn,
  processCheckOut,
  updateGroomingStatus,
  addCareActivity,
  getCareLogs,
  getBookingCareLogs,
  getRevenueReport,
  exportRevenueCSV,
  exportBookingsCSV
} from '../services/api';
import { formatINR, formatDateIN } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  CheckSquare,
  LogOut as CheckOutIcon,
  Scissors,
  ClipboardList,
  DollarSign,
  Search,
  AlertTriangle,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';

export default function StaffDashboard() {
  const { user, role } = useAuth();
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [careLogs, setCareLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  // Selected Booking Modal / Care Activity State
  const [careModalBooking, setCareModalBooking] = useState(null);
  const [careModalLogs, setCareModalLogs] = useState([]);
  const [careType, setCareType] = useState('Feeding');
  const [careNotes, setCareNotes] = useState('');
  const [careIsOwnerVisible, setCareIsOwnerVisible] = useState(true);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      getDashboardStats().catch(() => ({ success: false })),
      getMyBookings().catch(() => ({ success: false })),
      getRevenueReport().catch(() => ({ success: false })),
      getCareLogs().catch(() => ({ success: false }))
    ]).then(([statsRes, bookRes, revRes, careRes]) => {
      if (statsRes.success) setStats(statsRes.data);
      if (bookRes.success) setBookings(bookRes.data);
      if (revRes.success) setRevenue(revRes.data);
      if (careRes.success) setCareLogs(careRes.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCheckIn = async (booking) => {
    if (!window.confirm(`Confirm Check-in for ${booking.pet_name} (Booking #${booking.booking_number})?`)) return;
    setActionMessage('');
    setActionError('');
    try {
      const res = await processCheckIn(booking.id);
      if (res.success) {
        setActionMessage(res.message);
        loadData();
      }
    } catch (err) {
      setActionError(err.message || 'Check-in failed');
    }
  };

  const handleCheckOut = async (booking) => {
    const lateFee = prompt(`Enter any late checkout fee in INR (0 if on-time):`, '0');
    if (lateFee === null) return;
    setActionMessage('');
    setActionError('');
    try {
      const res = await processCheckOut(booking.id, { payment_method: 'Cash', late_fee: Number(lateFee) || 0 });
      if (res.success) {
        setActionMessage(res.message);
        loadData();
      }
    } catch (err) {
      setActionError(err.message || 'Check-out failed');
    }
  };

  const handleGroomingUpdate = async (id, status) => {
    const notes = prompt(`Optional groomer service notes for ${status}:`, '');
    setActionMessage('');
    setActionError('');
    try {
      const res = await updateGroomingStatus(id, status, notes || '');
      if (res.success) {
        setActionMessage(res.message);
        loadData();
      }
    } catch (err) {
      setActionError(err.message || 'Failed to update grooming status');
    }
  };

  const handleOpenCareModal = async (b) => {
    setCareModalBooking(b);
    setCareType('Feeding');
    setCareNotes('');
    setCareIsOwnerVisible(true);
    setCareModalLogs([]);
    try {
      const res = await getBookingCareLogs(b.id);
      if (res.success) setCareModalLogs(res.data);
    } catch {
      setCareModalLogs([]);
    }
  };

  const handleSaveCareActivity = async (e) => {
    e.preventDefault();
    if (!careModalBooking) return;
    try {
      const res = await addCareActivity(careModalBooking.id, {
        activity_type: careType,
        notes: careNotes,
        is_owner_visible: careIsOwnerVisible
      });
      if (res.success) {
        setActionMessage(`Care activity logged for ${careModalBooking.pet_name}.`);
        setCareNotes('');
        const refreshed = await getBookingCareLogs(careModalBooking.id).catch(() => null);
        if (refreshed && refreshed.success) {
          setCareModalLogs(refreshed.data);
        }
        loadData();
      }
    } catch (err) {
      setActionError(err.message || 'Failed to log care activity');
    }
  };

  const getActivityBadge = (type) => {
    switch (type) {
      case 'Feeding': return 'nb-badge-yellow';
      case 'Medication': return 'nb-badge-coral';
      case 'Walk': return 'nb-badge-mint';
      case 'Health Observation': return 'nb-badge-blue';
      default: return 'nb-badge-white';
    }
  };

  const filteredBookings = bookings.filter(b => {
    const matchSearch = (
      b.booking_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.pet_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.owner_name && b.owner_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.owner_phone && b.owner_phone.includes(searchQuery))
    );

    if (!matchSearch) return false;
    if (activeTab === 'BOARDING') return b.booking_type === 'BOARDING';
    if (activeTab === 'GROOMING') return b.booking_type === 'GROOMING';
    if (activeTab === 'ARRIVALS') return b.status === 'Confirmed';
    if (activeTab === 'CHECKED_IN') return b.status === 'Checked-in' || b.status === 'In Service';
    return true;
  });

  const filteredCareLogs = careLogs.filter(log => {
    const query = searchQuery.toLowerCase();
    return (
      (log.pet_name && log.pet_name.toLowerCase().includes(query)) ||
      (log.owner_name && log.owner_name.toLowerCase().includes(query)) ||
      (log.attendant_name && log.attendant_name.toLowerCase().includes(query)) ||
      (log.notes && log.notes.toLowerCase().includes(query)) ||
      (log.booking_number && log.booking_number.toLowerCase().includes(query)) ||
      (log.activity_type && log.activity_type.toLowerCase().includes(query))
    );
  });

  return (
    <div className="nb-container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <div className="nb-badge nb-badge-yellow" style={{ marginBottom: '0.4rem' }}>
            <Shield size={14} /> PBGMS Operational Hub
          </div>
          <h1 style={{ fontSize: '2.5rem' }}>Staff & Administration Console</h1>
          <p style={{ color: '#555' }}>
            Logged in as <strong>{user?.name}</strong> (Role: <span style={{ color: 'var(--nb-blue)' }}>{role.replace('_', ' ')}</span>)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {(role === 'ADMIN' || role === 'FRONT_DESK' || role === 'SYSTEM_ADMIN') && (
            <button
              onClick={() => exportBookingsCSV().catch(err => setActionError(err.message))}
              className="nb-btn nb-btn-white nb-btn-sm"
              title="Download bookings CSV report"
            >
              <Download size={15} /> Export Bookings CSV
            </button>
          )}
          {(role === 'ADMIN' || role === 'SYSTEM_ADMIN') && (
            <button
              onClick={() => exportRevenueCSV().catch(err => setActionError(err.message))}
              className="nb-btn nb-btn-mint nb-btn-sm"
              title="Download financial revenue CSV report"
            >
              <Download size={15} /> Export Revenue CSV
            </button>
          )}
        </div>
      </div>

      {actionMessage && <div className="nb-alert nb-alert-mint">{actionMessage}</div>}
      {actionError && <div className="nb-alert nb-alert-coral">{actionError}</div>}

      {/* ── Real Statistical Metrics (SRS Phase 10 & 14) ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
          <div className="nb-card nb-card-yellow">
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Active Boarded Pets</span>
            <strong style={{ display: 'block', fontSize: '2.2rem', fontFamily: 'var(--font-heading)', marginTop: '0.2rem' }}>
              {stats.active_checked_in || 0}
            </strong>
          </div>
          <div className="nb-card nb-card-mint">
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Today's Expected Arrivals</span>
            <strong style={{ display: 'block', fontSize: '2.2rem', fontFamily: 'var(--font-heading)', marginTop: '0.2rem' }}>
              {stats.today_arrivals || 0}
            </strong>
          </div>
          <div className="nb-card nb-card-coral" style={{ color: 'white' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'white' }}>Total Bookings</span>
            <strong style={{ display: 'block', fontSize: '2.2rem', fontFamily: 'var(--font-heading)', marginTop: '0.2rem', color: 'white' }}>
              {stats.total_bookings || 0}
            </strong>
          </div>
          {revenue && (
            <div className="nb-card" style={{ background: 'var(--nb-card)' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--nb-text-muted)' }}>Total Revenue (INR)</span>
              <strong style={{ display: 'block', fontSize: '1.8rem', fontFamily: 'var(--font-heading)', marginTop: '0.2rem', color: 'var(--nb-text)' }}>
                {formatINR(revenue.total_revenue || 0)}
              </strong>
            </div>
          )}
        </div>
      )}

      {/* ── Operational Filters & Search ── */}
      {/* ── Operational Filters & Search ── */}
      <div className="nb-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['ALL', 'ARRIVALS', 'CHECKED_IN', 'BOARDING', 'GROOMING', 'CARE_LOGS'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`nb-btn nb-btn-sm ${activeTab === tab ? '' : 'nb-btn-white'}`}
                style={{ background: activeTab === tab ? 'var(--nb-yellow)' : '' }}
              >
                {tab === 'CARE_LOGS' ? 'Shared Care Logs' : tab.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '320px' }}>
            <Search size={18} />
            <input
              type="text"
              placeholder={activeTab === 'CARE_LOGS' ? "Filter logs by pet, owner, staff, activity..." : "Search by Pet, Owner, Phone or #ID..."}
              className="nb-input"
              style={{ padding: '0.5rem 0.85rem' }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Tab Views: Operations Table or Care Logs Table ── */}
      {activeTab === 'CARE_LOGS' ? (
        <div className="nb-table-container">
          <table className="nb-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Pet & Owner</th>
                <th>Booking #</th>
                <th>Activity Type</th>
                <th>Care Notes & Observations</th>
                <th>Staff Attendant</th>
                <th>Portal Visibility</th>
              </tr>
            </thead>
            <tbody>
              {filteredCareLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                    No care activity records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredCareLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                      <strong>{formatDateIN(log.logged_at)}</strong>
                      <span style={{ display: 'block', color: '#666', fontSize: '0.78rem' }}>
                        {new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td>
                      <strong>{log.pet_name}</strong>
                      <span style={{ display: 'block', fontSize: '0.8rem', color: '#666' }}>
                        {log.pet_breed || log.pet_species} • Owner: {log.owner_name || 'Registered Customer'}
                      </span>
                    </td>
                    <td>
                      {log.booking_number ? (
                        <span className="nb-badge nb-badge-white" style={{ fontSize: '0.75rem' }}>
                          #{log.booking_number}
                        </span>
                      ) : (
                        <span style={{ color: '#888', fontSize: '0.8rem' }}>Direct Pet Log</span>
                      )}
                    </td>
                    <td>
                      <span className={`nb-badge ${getActivityBadge(log.activity_type)}`} style={{ fontSize: '0.75rem' }}>
                        {log.activity_type}
                      </span>
                    </td>
                    <td style={{ maxWidth: '320px', fontSize: '0.88rem' }}>
                      {log.notes}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{log.attendant_name || 'Staff Member'}</span>
                      {log.attendant_role && (
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#666' }}>
                          ({log.attendant_role.replace('_', ' ')})
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`nb-badge ${log.is_owner_visible ? 'nb-badge-mint' : 'nb-badge-coral'}`} style={{ fontSize: '0.72rem' }}>
                        {log.is_owner_visible ? 'Owner Visible' : 'Staff Internal'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="nb-table-container">
          <table className="nb-table">
            <thead>
              <tr>
                <th>Booking #</th>
                <th>Guest & Owner</th>
                <th>Medical Alerts</th>
                <th>Service / Room</th>
                <th>Schedule</th>
              <th>Status</th>
              <th>Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  No matching operational records found.
                </td>
              </tr>
            ) : (
              filteredBookings.map(b => (
                <tr key={b.id}>
                  <td>
                    <strong style={{ fontFamily: 'var(--font-heading)' }}>#{b.booking_number}</strong>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#666' }}>{b.booking_type}</span>
                  </td>
                  <td>
                    <strong>{b.pet_name}</strong> ({b.pet_species})
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#666' }}>
                      {b.owner_name} ({b.owner_phone})
                    </span>
                  </td>
                  <td>
                    {b.allergies ? (
                      <span className="nb-badge nb-badge-coral" style={{ fontSize: '0.72rem' }}>
                        <AlertTriangle size={12} /> {b.allergies}
                      </span>
                    ) : (
                      <span style={{ color: '#888', fontSize: '0.8rem' }}>None</span>
                    )}
                  </td>
                  <td>
                    {b.booking_type === 'BOARDING'
                      ? `${b.room_type || 'Kennel'} (Rm #${b.room_number || 'TBD'})`
                      : (b.service_name || 'Grooming')}
                  </td>
                  <td>
                    {formatDateIN(b.start_date)} {b.start_time ? `@ ${b.start_time}` : ''}
                  </td>
                  <td>
                    <span className={`nb-badge ${b.status === 'Checked-in' || b.status === 'In Service' ? 'nb-badge-mint' : b.status === 'Confirmed' ? 'nb-badge-yellow' : 'nb-badge-white'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td>
                    <strong>{formatINR(b.remaining_balance)}</strong>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {/* Front Desk Check-in Action */}
                      {b.status === 'Confirmed' && ['ADMIN', 'FRONT_DESK'].includes(role) && (
                        <button onClick={() => handleCheckIn(b)} className="nb-btn nb-btn-sm nb-btn-mint" title="Check-in Pet">
                          <CheckSquare size={14} /> Check In
                        </button>
                      )}

                      {/* Front Desk Check-out Action */}
                      {b.status === 'Checked-in' && ['ADMIN', 'FRONT_DESK'].includes(role) && (
                        <button onClick={() => handleCheckOut(b)} className="nb-btn nb-btn-sm nb-btn-coral" title="Complete Checkout & Settle Balance">
                          <CheckOutIcon size={14} /> Check Out
                        </button>
                      )}

                      {/* Groomer Actions */}
                      {b.booking_type === 'GROOMING' && b.status === 'Confirmed' && ['ADMIN', 'GROOMER', 'FRONT_DESK'].includes(role) && (
                        <button onClick={() => handleGroomingUpdate(b.id, 'In Service')} className="nb-btn nb-btn-sm nb-btn-yellow">
                          <Scissors size={14} /> Start Service
                        </button>
                      )}
                      {b.booking_type === 'GROOMING' && b.status === 'In Service' && ['ADMIN', 'GROOMER', 'FRONT_DESK'].includes(role) && (
                        <button onClick={() => handleGroomingUpdate(b.id, 'Completed')} className="nb-btn nb-btn-sm nb-btn-mint">
                          Complete Groom
                        </button>
                      )}

                      {/* Daily Care Log Action for Attendant, Front Desk, Groomer, Admin */}
                      {['Checked-in', 'In Service', 'Confirmed'].includes(b.status) && (
                        <button onClick={() => handleOpenCareModal(b)} className="nb-btn nb-btn-sm nb-btn-white" title="Record Feeding, Medication, Walk or Observations">
                          <ClipboardList size={14} /> Care Log
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* ── Daily Care Activity Modal with Live History ── */}
      {careModalBooking && (
        <div className="nb-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="nb-card nb-modal-content" style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--nb-card)' }}>
            <h3 style={{ marginBottom: '0.35rem' }}>Daily Care Log for {careModalBooking.pet_name}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--nb-text-muted)', marginBottom: '1rem' }}>
              Record feeding, medication administration, or behavioral updates.
            </p>

            {/* Existing Logs History */}
            <div style={{ marginBottom: '1.25rem', background: 'var(--nb-bg)', border: '1.5px solid var(--nb-border-color)', borderRadius: '6px', padding: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase' }}>
                  Care Log History ({careModalLogs.length})
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--nb-text-muted)' }}>Booking #{careModalBooking.booking_number}</span>
              </div>
              {careModalLogs.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--nb-text-muted)', fontStyle: 'italic', margin: 0 }}>
                  No care activities recorded yet for this stay. Use the form below to add the first log.
                </p>
              ) : (
                <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {careModalLogs.map(l => (
                    <div key={l.id} style={{ background: 'var(--nb-card)', border: '1px solid var(--nb-border-color)', borderRadius: '4px', padding: '0.5rem', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <span className={`nb-badge ${getActivityBadge(l.activity_type)}`} style={{ fontSize: '0.68rem' }}>
                          {l.activity_type}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#666' }}>
                          {formatDateIN(l.logged_at)} • {l.attendant_name || 'Staff'}
                        </span>
                      </div>
                      <div>{l.notes}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveCareActivity}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="nb-label">Activity Type</label>
                <select
                  className="nb-select"
                  value={careType}
                  onChange={e => setCareType(e.target.value)}
                >
                  <option value="Feeding">Feeding (Completed Schedule)</option>
                  <option value="Medication">Medication Dispensed</option>
                  <option value="Walk">Outdoor Walk & Play</option>
                  <option value="Health Observation">Health & Temperament Note</option>
                  <option value="Grooming Note">Grooming & Hygiene Note</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="nb-label">Care Notes & Observations</label>
                <textarea
                  className="nb-textarea"
                  rows={3}
                  required
                  style={{ resize: 'none' }}
                  value={careNotes}
                  onChange={e => setCareNotes(e.target.value)}
                  placeholder="e.g. Simba was fed at 10:30 AM. Water bowl refilled. No issues observed."
                />
              </div>

              <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <input
                  type="checkbox"
                  id="careOwnerVisible"
                  checked={careIsOwnerVisible}
                  onChange={e => setCareIsOwnerVisible(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--nb-coral)' }}
                />
                <label htmlFor="careOwnerVisible" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                  Share this update with pet owner in their portal
                </label>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setCareModalBooking(null)} className="nb-btn nb-btn-white">
                  Cancel
                </button>
                <button type="submit" className="nb-btn nb-btn-coral">
                  Save Activity Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
