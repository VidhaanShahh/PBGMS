import React, { useState, useEffect } from 'react';
import {
  getFrontDeskStats,
  getFrontDeskBookings,
  processFrontDeskCheckIn,
  processFrontDeskCheckOut,
  getFrontDeskCustomers,
  getGroomingCoordination,
  handoverGrooming,
  getRooms,
  cancelBooking,
  getCareLogs
} from '../services/api';
import { formatINR, formatDateIN } from '../utils/formatters';
import {
  Shield,
  CheckSquare,
  LogOut as CheckOutIcon,
  Search,
  AlertTriangle,
  Calendar,
  Clock,
  User,
  PawPrint,
  DollarSign,
  ClipboardList,
  Eye,
  RefreshCw,
  Scissors,
  CheckCircle2
} from 'lucide-react';

export default function FrontDeskPortal() {
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('OPERATIONS');
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  // Operations tab data
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Customer Directory
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');

  // Grooming Coordination
  const [groomingList, setGroomingList] = useState([]);

  // Care Logs
  const [careLogs, setCareLogs] = useState([]);

  // Check-In Modal
  const [checkInModalBooking, setCheckInModalBooking] = useState(null);
  const [checkInRoomId, setCheckInRoomId] = useState('');
  const [arrivalObservations, setArrivalObservations] = useState('');
  const [belongings, setBelongings] = useState('');

  // Check-Out Modal
  const [checkOutModalBooking, setCheckOutModalBooking] = useState(null);
  const [lateFee, setLateFee] = useState(0);
  const [settlementMethod, setSettlementMethod] = useState('Cash');
  const [handoverNotes, setHandoverNotes] = useState('');

  const loadData = () => {
    setLoading(true);
    setActionMessage('');
    setActionError('');

    Promise.all([
      getFrontDeskStats().catch(() => ({ success: false })),
      getFrontDeskBookings().catch(() => ({ success: false })),
      getRooms().catch(() => ({ success: false })),
      getFrontDeskCustomers().catch(() => ({ success: false })),
      getGroomingCoordination().catch(() => ({ success: false })),
      getCareLogs({ limit: 50 }).catch(() => ({ success: false }))
    ]).then(([statsRes, bookRes, roomRes, custRes, groomRes, careRes]) => {
      if (statsRes.success) setStats(statsRes.data);
      if (bookRes.success) setBookings(bookRes.data);
      if (roomRes.success) setRooms(roomRes.data);
      if (custRes.success) setCustomers(custRes.data);
      if (groomRes.success) setGroomingList(groomRes.data);
      if (careRes.success) setCareLogs(careRes.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Check-in submit
  const handleCheckInSubmit = async (e) => {
    e.preventDefault();
    setActionMessage('');
    setActionError('');
    try {
      const res = await processFrontDeskCheckIn({
        booking_id: checkInModalBooking.id,
        room_id: checkInRoomId ? Number(checkInRoomId) : checkInModalBooking.room_id,
        arrival_observations: arrivalObservations,
        belongings: belongings
      });
      if (res.success) {
        setActionMessage(res.message);
        setCheckInModalBooking(null);
        loadData();
      }
    } catch (err) {
      setActionError(err.message || 'Check-in failed');
    }
  };

  // Check-out submit
  const handleCheckOutSubmit = async (e) => {
    e.preventDefault();
    setActionMessage('');
    setActionError('');
    try {
      const res = await processFrontDeskCheckOut({
        booking_id: checkOutModalBooking.id,
        late_fee: Number(lateFee) || 0,
        payment_method: settlementMethod,
        handover_notes: handoverNotes
      });
      if (res.success) {
        setActionMessage(res.message);
        setCheckOutModalBooking(null);
        loadData();
      }
    } catch (err) {
      setActionError(err.message || 'Check-out failed');
    }
  };

  // Grooming Handover (Collection by owner)
  const handleGroomingHandover = async (bookingId) => {
    if (!window.confirm('Confirm pet handover to owner? This will mark the grooming session as Collected.')) return;
    try {
      const res = await handoverGrooming({ booking_id: bookingId });
      if (res.success) {
        setActionMessage(res.message);
        loadData();
      }
    } catch (err) {
      setActionError(err.message || 'Handover failed');
    }
  };

  const handleCancelBooking = async (id, num) => {
    if (!window.confirm(`Are you sure you want to cancel booking #${num}?`)) return;
    try {
      const res = await cancelBooking(id);
      if (res.success) {
        setActionMessage(`Booking #${num} cancelled. Refund: ₹${(res.refund_issued || 0).toFixed(2)}.`);
        loadData();
      }
    } catch (err) {
      setActionError(err.message || 'Failed to cancel booking');
    }
  };

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = !searchQuery ||
      b.booking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.pet_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.owner_phone?.includes(searchQuery);

    const matchesType = typeFilter === 'ALL' || b.booking_type === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const arrivalsList = bookings.filter(b => b.booking_type === 'BOARDING' && b.status === 'Confirmed');
  const departuresList = bookings.filter(b => b.booking_type === 'BOARDING' && b.status === 'Checked-in');

  return (
    <div className="nb-container" style={{ padding: '2.5rem 1.5rem' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div className="nb-badge nb-badge-yellow" style={{ marginBottom: '0.4rem' }}>
            <Shield size={14} /> Front Desk Console
          </div>
          <h1 style={{ fontSize: '2.4rem' }}>Guest Operations & Reception</h1>
          <p style={{ color: '#666', fontSize: '0.95rem' }}>
            Manage boarding arrivals, departures, customer directory, and service handovers.
          </p>
        </div>
        <button onClick={loadData} className="nb-btn nb-btn-white nb-btn-sm" title="Refresh Live Records">
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      {actionMessage && <div className="nb-alert nb-alert-mint" style={{ marginBottom: '1.5rem' }}>{actionMessage}</div>}
      {actionError && <div className="nb-alert nb-alert-coral" style={{ marginBottom: '1.5rem' }}>{actionError}</div>}

      {/* ── Operational Metric Cards (Real Database Queries) ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="nb-card nb-card-yellow" style={{ padding: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Boarding Arrivals</span>
            <strong style={{ display: 'block', fontSize: '1.9rem', fontFamily: 'var(--font-heading)', marginTop: '0.2rem' }}>
              {stats.today_arrivals}
            </strong>
            <span style={{ fontSize: '0.72rem', color: '#444' }}>Awaiting Check-in</span>
          </div>

          <div className="nb-card nb-card-mint" style={{ padding: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Boarding Departures</span>
            <strong style={{ display: 'block', fontSize: '1.9rem', fontFamily: 'var(--font-heading)', marginTop: '0.2rem' }}>
              {stats.today_departures}
            </strong>
            <span style={{ fontSize: '0.72rem', color: '#444' }}>Due for Check-out</span>
          </div>

          <div className="nb-card" style={{ padding: '1.25rem', background: '#FFFFFF' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#666' }}>In-House Guests</span>
            <strong style={{ display: 'block', fontSize: '1.9rem', fontFamily: 'var(--font-heading)', marginTop: '0.2rem', color: '#171717' }}>
              {stats.in_house_guests}
            </strong>
            <span style={{ fontSize: '0.72rem', color: '#666' }}>Boarding & Spa</span>
          </div>

          <div className="nb-card" style={{ padding: '1.25rem', background: '#FFFFFF' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#666' }}>Grooming Today</span>
            <strong style={{ display: 'block', fontSize: '1.9rem', fontFamily: 'var(--font-heading)', marginTop: '0.2rem', color: '#171717' }}>
              {stats.grooming_today}
            </strong>
            <span style={{ fontSize: '0.72rem', color: '#666' }}>Spa Appointments</span>
          </div>

          <div className="nb-card nb-card-coral" style={{ padding: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Ready for Pickup</span>
            <strong style={{ display: 'block', fontSize: '1.9rem', fontFamily: 'var(--font-heading)', marginTop: '0.2rem' }}>
              {stats.ready_for_collection}
            </strong>
            <span style={{ fontSize: '0.72rem' }}>Awaiting Owner Collection</span>
          </div>

          <div className="nb-card" style={{ padding: '1.25rem', background: '#FFFFFF' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#666' }}>Outstanding Due</span>
            <strong style={{ display: 'block', fontSize: '1.4rem', fontFamily: 'var(--font-heading)', marginTop: '0.4rem', color: stats.outstanding_balances > 0 ? '#BA2D21' : '#196E3F' }}>
              {formatINR(stats.outstanding_balances)}
            </strong>
            <span style={{ fontSize: '0.72rem', color: '#666' }}>Unsettled Balances</span>
          </div>
        </div>
      )}

      {/* ── Navigation Tabs ── */}
      <div className="nb-card" style={{ marginBottom: '2rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'OPERATIONS', label: 'Check-In & Check-Out' },
            { id: 'GROOMING', label: 'Grooming Coordination' },
            { id: 'BOOKINGS', label: 'All Bookings Management' },
            { id: 'CUSTOMERS', label: 'Customer Directory' },
            { id: 'CARE_LOGS', label: 'Shared Care Logs' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`nb-btn nb-btn-sm ${activeTab === t.id ? '' : 'nb-btn-white'}`}
              style={{ background: activeTab === t.id ? 'var(--nb-yellow)' : '' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB 1: OPERATIONS (CHECK-IN / CHECK-OUT) ── */}
      {activeTab === 'OPERATIONS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Arrivals Section */}
          <div className="nb-card">
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckSquare size={20} color="#171717" /> Confirmed Arrivals Awaiting Check-In ({arrivalsList.length})
            </h3>
            {arrivalsList.length === 0 ? (
              <p style={{ color: '#666', padding: '1rem 0' }}>No pending boarding arrivals waiting for check-in.</p>
            ) : (
              <div className="nb-table-container">
                <table className="nb-table">
                  <thead>
                    <tr>
                      <th>Booking #</th>
                      <th>Guest & Pet</th>
                      <th>Dates</th>
                      <th>Assigned Suite</th>
                      <th>Allergies & Alerts</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arrivalsList.map(b => (
                      <tr key={b.id}>
                        <td><strong>#{b.booking_number}</strong></td>
                        <td>
                          <strong>{b.pet_name}</strong> ({b.pet_species} - {b.pet_breed})
                          <span style={{ display: 'block', fontSize: '0.78rem', color: '#666' }}>Owner: {b.owner_name} ({b.owner_phone})</span>
                        </td>
                        <td>{formatDateIN(b.start_date)} to {formatDateIN(b.end_date)}</td>
                        <td>{b.room_type || 'Standard'} (Rm #{b.room_number || 'TBD'})</td>
                        <td>
                          {b.allergies ? (
                            <span className="nb-badge nb-badge-coral" style={{ fontSize: '0.72rem' }}>
                              <AlertTriangle size={12} /> {b.allergies}
                            </span>
                          ) : <span style={{ color: '#888', fontSize: '0.8rem' }}>None</span>}
                        </td>
                        <td>
                          <button
                            onClick={() => {
                              setCheckInModalBooking(b);
                              setCheckInRoomId(b.room_id || '');
                              setArrivalObservations('');
                              setBelongings('');
                            }}
                            className="nb-btn nb-btn-sm nb-btn-mint"
                          >
                            <CheckSquare size={14} /> Complete Check-In
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Departures Section */}
          <div className="nb-card">
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckOutIcon size={20} color="#171717" /> In-House Boarding Guests Awaiting Check-Out ({departuresList.length})
            </h3>
            {departuresList.length === 0 ? (
              <p style={{ color: '#666', padding: '1rem 0' }}>No checked-in boarding guests currently in house.</p>
            ) : (
              <div className="nb-table-container">
                <table className="nb-table">
                  <thead>
                    <tr>
                      <th>Booking #</th>
                      <th>Guest & Pet</th>
                      <th>Stay Schedule</th>
                      <th>Room</th>
                      <th>Financial Balance</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departuresList.map(b => (
                      <tr key={b.id}>
                        <td><strong>#{b.booking_number}</strong></td>
                        <td>
                          <strong>{b.pet_name}</strong> ({b.pet_species})
                          <span style={{ display: 'block', fontSize: '0.78rem', color: '#666' }}>Owner: {b.owner_name} ({b.owner_phone})</span>
                        </td>
                        <td>In: {formatDateIN(b.start_date)} • Out: {formatDateIN(b.end_date)}</td>
                        <td>{b.room_type} (Rm #{b.room_number})</td>
                        <td>
                          <strong>{formatINR(b.remaining_balance)}</strong>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: b.remaining_balance === 0 ? '#196E3F' : '#BA2D21' }}>
                            {b.remaining_balance === 0 ? 'Paid in Full' : 'Balance Due'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => {
                              setCheckOutModalBooking(b);
                              setLateFee(0);
                              setSettlementMethod('Cash');
                              setHandoverNotes('');
                            }}
                            className="nb-btn nb-btn-sm nb-btn-coral"
                          >
                            <CheckOutIcon size={14} /> Process Check-Out
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: GROOMING COORDINATION ── */}
      {activeTab === 'GROOMING' && (
        <div className="nb-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem' }}>Grooming Appointments & Handover Queue</h3>
              <p style={{ fontSize: '0.88rem', color: '#666' }}>Track spa sessions in progress, check in arrivals, and coordinate pet collection.</p>
            </div>
          </div>

          <div className="nb-table-container">
            <table className="nb-table">
              <thead>
                <tr>
                  <th>Booking #</th>
                  <th>Customer & Pet</th>
                  <th>Service</th>
                  <th>Schedule</th>
                  <th>Groomer</th>
                  <th>Session Status</th>
                  <th>Handover Action</th>
                </tr>
              </thead>
              <tbody>
                {groomingList.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No grooming appointments found.</td>
                  </tr>
                ) : (
                  groomingList.map(g => (
                    <tr key={g.id}>
                      <td><strong>#{g.booking_number}</strong></td>
                      <td>
                        <strong>{g.pet_name}</strong> ({g.pet_species} - {g.pet_breed})
                        <span style={{ display: 'block', fontSize: '0.78rem', color: '#666' }}>{g.owner_name} ({g.owner_phone})</span>
                      </td>
                      <td>{g.service_name}</td>
                      <td>{formatDateIN(g.start_date)} @ {g.start_time}</td>
                      <td>{g.groomer_name || 'Unassigned'}</td>
                      <td>
                        <span className={`nb-badge ${
                          g.status === 'Ready for Collection' ? 'nb-badge-coral' :
                          g.status === 'In Service' ? 'nb-badge-mint' :
                          g.status === 'Completed' ? 'nb-badge-blue' :
                          'nb-badge-yellow'
                        }`}>
                          {g.status}
                        </span>
                        {g.handover_notes && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#555', marginTop: '0.2rem' }}>
                            Note: {g.handover_notes}
                          </span>
                        )}
                      </td>
                      <td>
                        {g.status === 'Ready for Collection' ? (
                          <button
                            onClick={() => handleGroomingHandover(g.id)}
                            className="nb-btn nb-btn-sm nb-btn-mint"
                            title="Owner has collected pet"
                          >
                            <CheckCircle2 size={14} /> Mark Collected
                          </button>
                        ) : g.status === 'Confirmed' ? (
                          <button
                            onClick={async () => {
                              try {
                                await processFrontDeskCheckIn({ booking_id: g.id });
                                setActionMessage(`Grooming guest #${g.booking_number} checked in.`);
                                loadData();
                              } catch (err) {
                                setActionError(err.message || 'Check-in failed');
                              }
                            }}
                            className="nb-btn nb-btn-sm nb-btn-white"
                          >
                            Check In Guest
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#666' }}>In Progress / Done</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: ALL BOOKINGS MANAGEMENT ── */}
      {activeTab === 'BOOKINGS' && (
        <div className="nb-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                className="nb-select"
                style={{ width: 'auto', padding: '0.45rem 0.85rem' }}
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
              >
                <option value="ALL">All Services</option>
                <option value="BOARDING">Boarding Stays</option>
                <option value="GROOMING">Grooming Spa</option>
              </select>

              <select
                className="nb-select"
                style={{ width: 'auto', padding: '0.45rem 0.85rem' }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Checked-in">Checked-in</option>
                <option value="In Service">In Service</option>
                <option value="Ready for Collection">Ready for Collection</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '300px' }}>
              <Search size={18} />
              <input
                type="text"
                placeholder="Search by #ID, Pet, Customer, Phone..."
                className="nb-input"
                style={{ padding: '0.45rem 0.85rem' }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="nb-table-container">
            <table className="nb-table">
              <thead>
                <tr>
                  <th>Booking #</th>
                  <th>Customer & Contact</th>
                  <th>Guest Pet</th>
                  <th>Service / Suite</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Financials</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>No matching bookings found.</td>
                  </tr>
                ) : (
                  filteredBookings.map(b => (
                    <tr key={b.id}>
                      <td>
                        <strong>#{b.booking_number}</strong>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#666' }}>{b.booking_type}</span>
                      </td>
                      <td>
                        <strong>{b.owner_name}</strong>
                        <span style={{ display: 'block', fontSize: '0.78rem', color: '#666' }}>{b.owner_phone}</span>
                      </td>
                      <td>
                        <strong>{b.pet_name}</strong> ({b.pet_species})
                        {b.allergies && (
                          <span className="nb-badge nb-badge-coral" style={{ fontSize: '0.7rem', display: 'inline-flex', marginTop: '0.2rem' }}>
                            Alert: {b.allergies}
                          </span>
                        )}
                      </td>
                      <td>
                        {b.booking_type === 'BOARDING'
                          ? `${b.room_type || 'Standard'} (Rm #${b.room_number || 'TBD'})`
                          : (b.service_name || 'Grooming')}
                      </td>
                      <td>{formatDateIN(b.start_date)} {b.start_time ? `@ ${b.start_time}` : ''}</td>
                      <td>
                        <span className={`nb-badge ${
                          b.status === 'Checked-in' || b.status === 'In Service' ? 'nb-badge-mint' :
                          b.status === 'Confirmed' ? 'nb-badge-yellow' :
                          b.status === 'Completed' ? 'nb-badge-blue' :
                          'nb-badge-white'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td>
                        <strong>{formatINR(b.total_price)}</strong>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: b.remaining_balance === 0 ? '#196E3F' : '#BA2D21' }}>
                          Due: {formatINR(b.remaining_balance)}
                        </span>
                      </td>
                      <td>
                        {['Confirmed', 'Pending'].includes(b.status) && (
                          <button
                            onClick={() => handleCancelBooking(b.id, b.booking_number)}
                            className="nb-btn nb-btn-sm nb-btn-white"
                            style={{ color: '#D32F2F', borderColor: '#D32F2F' }}
                            title="Cancel Booking"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: CUSTOMER DIRECTORY ── */}
      {activeTab === 'CUSTOMERS' && (
        <div className="nb-card" style={{ background: 'var(--nb-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem' }}>Customer & Pet Directory</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--nb-text-muted)' }}>Authorized operational search, pet profiles, and front-desk customer intake.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '260px' }}>
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search customers..."
                  className="nb-input"
                  style={{ padding: '0.45rem 0.85rem' }}
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="nb-table-container">
            <table className="nb-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Contact Info</th>
                  <th>Registered Pets</th>
                  <th>Total Bookings</th>
                  <th>Registered Since</th>
                </tr>
              </thead>
              <tbody>
                {customers
                  .filter(c => !customerSearch ||
                    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                    c.email?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                    c.phone?.includes(customerSearch)
                  )
                  .map(c => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>
                        <div>{c.email}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{c.phone || 'No phone'}</div>
                      </td>
                      <td>
                        {c.pets && c.pets.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {c.pets.map(p => (
                              <span key={p.id} className="nb-badge nb-badge-white" style={{ fontSize: '0.75rem' }}>
                                <PawPrint size={12} /> {p.name} ({p.species})
                              </span>
                            ))}
                          </div>
                        ) : <span style={{ color: '#888', fontSize: '0.8rem' }}>No pets registered</span>}
                      </td>
                      <td><strong>{c.booking_count}</strong> stays/spa</td>
                      <td>{formatDateIN(c.created_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 5: SHARED CARE LOGS ── */}
      {activeTab === 'CARE_LOGS' && (
        <div className="nb-card">
          <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Business-Wide Operational Care Logs</h3>
          <div className="nb-table-container">
            <table className="nb-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Guest Pet</th>
                  <th>Booking #</th>
                  <th>Activity Type</th>
                  <th>Observation & Notes</th>
                  <th>Recorded By</th>
                  <th>Visibility</th>
                </tr>
              </thead>
              <tbody>
                {careLogs.map(log => (
                  <tr key={log.id}>
                    <td>{formatDateIN(log.logged_at)}</td>
                    <td>
                      <strong>{log.pet_name}</strong>
                      <span style={{ display: 'block', fontSize: '0.78rem', color: '#666' }}>{log.pet_breed || log.pet_species}</span>
                    </td>
                    <td>#{log.booking_number || 'Direct'}</td>
                    <td>
                      <span className="nb-badge nb-badge-white" style={{ fontSize: '0.75rem' }}>{log.activity_type}</span>
                    </td>
                    <td style={{ maxWidth: '350px', fontSize: '0.88rem' }}>{log.notes}</td>
                    <td>{log.attendant_name || 'Staff'}</td>
                    <td>
                      <span className={`nb-badge ${log.is_owner_visible ? 'nb-badge-mint' : 'nb-badge-coral'}`} style={{ fontSize: '0.72rem' }}>
                        {log.is_owner_visible ? 'Owner Visible' : 'Staff Only'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Check-In Modal ── */}
      {checkInModalBooking && (
        <div className="nb-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="nb-card nb-modal-content" style={{ maxWidth: '540px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#FFFFFF' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>
              Check-In: {checkInModalBooking.pet_name}
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.25rem' }}>
              Booking #{checkInModalBooking.booking_number} • Owner: {checkInModalBooking.owner_name}
            </p>

            <form onSubmit={handleCheckInSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Assign Room / Kennel Suite
                </label>
                <select
                  className="nb-select"
                  value={checkInRoomId}
                  onChange={e => setCheckInRoomId(e.target.value)}
                  required={checkInModalBooking.booking_type === 'BOARDING'}
                >
                  <option value="">Select Room</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      Room #{r.room_number} ({r.room_type}) - ₹{r.daily_rate}/night
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Arrival Observations (Health & Temperament)
                </label>
                <textarea
                  className="nb-textarea"
                  style={{ resize: 'none' }}
                  rows={3}
                  placeholder="e.g. Energetic and alert. Coat clean. No visible scratches."
                  value={arrivalObservations}
                  onChange={e => setArrivalObservations(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Customer Belongings Handed Over
                </label>
                <input
                  type="text"
                  className="nb-input"
                  placeholder="e.g. Red collar, blue leash, favorite rubber bone"
                  value={belongings}
                  onChange={e => setBelongings(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setCheckInModalBooking(null)} className="nb-btn nb-btn-white">
                  Cancel
                </button>
                <button type="submit" className="nb-btn nb-btn-mint">
                  Confirm Check-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Check-Out Modal ── */}
      {checkOutModalBooking && (
        <div className="nb-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="nb-card nb-modal-content" style={{ maxWidth: '540px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#FFFFFF' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>
              Check-Out: {checkOutModalBooking.pet_name}
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.25rem' }}>
              Booking #{checkOutModalBooking.booking_number} • Total Price: {formatINR(checkOutModalBooking.total_price)}
            </p>

            <form onSubmit={handleCheckOutSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Late Checkout Fee (INR)
                </label>
                <input
                  type="number"
                  className="nb-input"
                  min="0"
                  value={lateFee}
                  onChange={e => setLateFee(e.target.value)}
                />
              </div>

              <div className="nb-card nb-card-yellow" style={{ padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>Original Total:</span>
                  <strong>{formatINR(checkOutModalBooking.total_price)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '0.3rem' }}>
                  <span>Paid So Far:</span>
                  <strong>{formatINR(checkOutModalBooking.paid_amount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', marginTop: '0.5rem', borderTop: '2px solid #171717', paddingTop: '0.5rem' }}>
                  <span>Final Balance Due:</span>
                  <strong>{formatINR(Math.max(0, (checkOutModalBooking.total_price + Number(lateFee || 0)) - checkOutModalBooking.paid_amount))}</strong>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Settlement Payment Method
                </label>
                <select
                  className="nb-select"
                  value={settlementMethod}
                  onChange={e => setSettlementMethod(e.target.value)}
                >
                  <option value="Cash">Cash on Departure</option>
                  <option value="UPI">UPI</option>
                  <option value="Credit Card">Credit / Debit Card</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Customer Handover Notes
                </label>
                <textarea
                  className="nb-textarea"
                  style={{ resize: 'none' }}
                  rows={3}
                  placeholder="e.g. Belongings returned in full. Customer satisfied with stay."
                  value={handoverNotes}
                  onChange={e => setHandoverNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setCheckOutModalBooking(null)} className="nb-btn nb-btn-white">
                  Cancel
                </button>
                <button type="submit" className="nb-btn nb-btn-coral">
                  Settle & Complete Check-Out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
