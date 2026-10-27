import React, { useState, useEffect } from 'react';
import {
  getRevenueReport,
  getOccupancyReport,
  getDashboardStats,
  exportRevenueCSV,
  exportBookingsCSV,
  getServices,
  getServiceReviews
} from '../services/api';
import { formatINR, formatDateIN } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  Layers,
  FileSpreadsheet,
  Settings,
  Star,
  CheckCircle2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export default function AdminDashboard() {
  const { role, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [occupancy, setOccupancy] = useState(null);
  const [services, setServices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [configList, setConfigList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('OVERVIEW');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setActionMessage('');
    setActionError('');

    try {
      const [statsRes, revRes, occRes, servRes] = await Promise.all([
        getDashboardStats().catch(() => ({ success: false })),
        getRevenueReport().catch(() => ({ success: false })),
        getOccupancyReport().catch(() => ({ success: false })),
        getServices().catch(() => ({ success: false }))
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (revRes.success) setRevenue(revRes.data);
      if (occRes.success) setOccupancy(occRes.data);
      if (servRes.success) setServices(servRes.data);

      // Fetch staff accounts
      const token = localStorage.getItem('pbgms_token') || localStorage.getItem('pcs_admin_token');
      if (token) {
        const staffRes = await fetch('/api/auth/staff', {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()).catch(() => ({ success: false }));
        if (staffRes.success) setStaffList(staffRes.data);

        // If ADMIN or SYSTEM_ADMIN, also fetch business config
        const cfgRes = await fetch('/api/reports/config', {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()).catch(() => ({ success: false }));
        if (cfgRes.success) setConfigList(cfgRes.data);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to fetch administrative data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportRevenue = async () => {
    setExporting(true);
    try {
      await exportRevenueCSV();
      setActionMessage('Revenue report exported as CSV successfully.');
    } catch (err) {
      setActionError(err.message || 'Failed to export revenue CSV.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportBookings = async () => {
    setExporting(true);
    try {
      await exportBookingsCSV();
      setActionMessage('Bookings ledger exported as CSV successfully.');
    } catch (err) {
      setActionError(err.message || 'Failed to export bookings CSV.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="nb-container" style={{ padding: '2.5rem 1.5rem 4rem 1.5rem' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <span className="nb-badge nb-badge-yellow" style={{ fontSize: '0.85rem' }}>
              <Shield size={14} /> Executive Admin Console
            </span>
            <span className="nb-badge nb-badge-mint">
              {role === 'SYSTEM_ADMIN' ? 'System Administrator' : 'Branch Administrator'}
            </span>
          </div>
          <h1 style={{ fontSize: '2.25rem', letterSpacing: '-0.03em' }}>
            Operations & Revenue Governance
          </h1>
          <p style={{ color: 'var(--nb-text-muted)', fontSize: '0.95rem' }}>
            Authorized executive portal for live boarding occupancy, financial audit ledgers, service catalog, and staff management.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={loadData}
            className="nb-btn nb-btn-white nb-btn-sm"
            disabled={loading}
            title="Refresh All Records"
          >
            <RefreshCw size={14} className={loading ? 'nb-loading-pulse' : ''} /> Refresh Ledger
          </button>
          <button
            onClick={handleExportRevenue}
            className="nb-btn nb-btn-yellow nb-btn-sm"
            disabled={exporting}
          >
            <FileSpreadsheet size={14} /> Export Revenue CSV
          </button>
          <button
            onClick={handleExportBookings}
            className="nb-btn nb-btn-mint nb-btn-sm"
            disabled={exporting}
          >
            <FileSpreadsheet size={14} /> Export Bookings CSV
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="nb-alert nb-alert-mint" style={{ marginBottom: '1.5rem' }}>
          <CheckCircle2 size={18} /> {actionMessage}
        </div>
      )}

      {actionError && (
        <div className="nb-alert nb-alert-coral" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} /> {actionError}
        </div>
      )}

      {/* Primary KPI Grid (All Backend-Derived) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2.5rem'
      }}>
        <div className="nb-card nb-card-yellow">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Revenue (Audit)
              </p>
              <h2 style={{ fontSize: '2rem', marginTop: '0.35rem', color: '#171717' }}>
                {revenue ? formatINR(revenue.total_revenue) : '₹0'}
              </h2>
            </div>
            <DollarSign size={28} color="#171717" strokeWidth={2.5} />
          </div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#444', marginTop: '0.5rem' }}>
            Boarding: {revenue ? formatINR(revenue.boarding_revenue) : '₹0'} | Grooming: {revenue ? formatINR(revenue.grooming_revenue) : '₹0'}
          </p>
        </div>

        <div className="nb-card nb-card-mint">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Boarding Occupancy
              </p>
              <h2 style={{ fontSize: '2rem', marginTop: '0.35rem', color: '#171717' }}>
                {occupancy ? occupancy.occupancy_percentage : '0%'}
              </h2>
            </div>
            <TrendingUp size={28} color="#171717" strokeWidth={2.5} />
          </div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#222', marginTop: '0.5rem' }}>
            {occupancy ? `${occupancy.currently_occupied} of ${occupancy.total_capacity} kennels currently active` : 'Loading kennel data...'}
          </p>
        </div>

        <div className="nb-card" style={{ background: 'var(--nb-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--nb-text-muted)' }}>
                Registered Pet Owners
              </p>
              <h2 style={{ fontSize: '2rem', marginTop: '0.35rem', color: 'var(--nb-text)' }}>
                {stats ? stats.total_customers : 0}
              </h2>
            </div>
            <Users size={28} color="var(--nb-coral)" strokeWidth={2.5} />
          </div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--nb-text-muted)', marginTop: '0.5rem' }}>
            Total Pets Registered: {stats ? stats.total_pets : 0}
          </p>
        </div>

        <div className="nb-card" style={{ background: 'var(--nb-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--nb-text-muted)' }}>
                Total Bookings Ledger
              </p>
              <h2 style={{ fontSize: '2rem', marginTop: '0.35rem', color: 'var(--nb-text)' }}>
                {stats ? stats.total_bookings : 0}
              </h2>
            </div>
            <Calendar size={28} color="var(--nb-blue)" strokeWidth={2.5} />
          </div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--nb-text-muted)', marginTop: '0.5rem' }}>
            Today: {stats ? `${stats.today_arrivals} Arrivals / ${stats.today_departures} Departures` : '0/0'}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: 'var(--nb-border)', paddingBottom: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {[
          { id: 'OVERVIEW', label: 'Financial Audit & Ledgers', icon: DollarSign },
          { id: 'STAFF', label: 'Authorized Staff Directory', icon: Users },
          { id: 'SERVICES', label: 'Service Catalog & Pricing', icon: Layers },
          { id: 'CONFIG', label: 'Business & System Policies', icon: Settings }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nb-btn ${isActive ? 'nb-btn-black' : 'nb-btn-white'} nb-btn-sm`}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Financial Audit & Ledgers */}
      {activeTab === 'OVERVIEW' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem' }}>
          {/* Revenue by Settlement Method */}
          <div className="nb-card" style={{ background: 'var(--nb-card)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={18} color="var(--nb-coral)" /> Payment Settlement Breakdown
            </h3>
            {revenue?.by_method && revenue.by_method.length > 0 ? (
              <div className="nb-table-container">
                <table className="nb-table">
                  <thead>
                    <tr>
                      <th>Settlement Method</th>
                      <th>Transaction Count</th>
                      <th>Total Settled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.by_method.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700 }}>{item.payment_method}</td>
                        <td>{item.count}</td>
                        <td style={{ fontWeight: 800, color: 'var(--nb-text)' }}>{formatINR(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--nb-text-muted)', fontSize: '0.9rem' }}>No settlement transactions recorded yet.</p>
            )}
          </div>

          {/* Kennel Capacity & Room Types */}
          <div className="nb-card" style={{ background: 'var(--nb-card)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} color="var(--nb-blue)" /> Kennel Capacity by Type
            </h3>
            {occupancy?.room_types && occupancy.room_types.length > 0 ? (
              <div className="nb-table-container">
                <table className="nb-table">
                  <thead>
                    <tr>
                      <th>Room Type</th>
                      <th>Total Kennels</th>
                      <th>Maintenance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {occupancy.room_types.map((rt, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700 }}>{rt.room_type}</td>
                        <td>{rt.total_rooms}</td>
                        <td>
                          {rt.under_maintenance > 0 ? (
                            <span className="nb-badge nb-badge-coral" style={{ fontSize: '0.7rem' }}>
                              {rt.under_maintenance} Under Maint
                            </span>
                          ) : (
                            <span className="nb-badge nb-badge-mint" style={{ fontSize: '0.7rem' }}>All Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--nb-text-muted)', fontSize: '0.9rem' }}>No room data available.</p>
            )}
          </div>

          {/* Recent Financial Transactions Audit Ledger */}
          <div className="nb-card" style={{ gridColumn: '1 / -1', background: 'var(--nb-card)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={18} color="var(--nb-coral)" /> Recent Verified Payment Transactions (Live Backend Ledger)
            </h3>
            {revenue?.recent_transactions && revenue.recent_transactions.length > 0 ? (
              <div className="nb-table-container">
                <table className="nb-table">
                  <thead>
                    <tr>
                      <th>Transaction ID</th>
                      <th>Booking Ref</th>
                      <th>Service Type</th>
                      <th>Customer Name</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.recent_transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{tx.transaction_reference}</td>
                        <td style={{ fontWeight: 700 }}>{tx.booking_number}</td>
                        <td>
                          <span className={`nb-badge ${tx.booking_type === 'BOARDING' ? 'nb-badge-yellow' : 'nb-badge-mint'}`}>
                            {tx.booking_type}
                          </span>
                        </td>
                        <td>{tx.customer_name}</td>
                        <td>{tx.payment_method}</td>
                        <td>
                          <span className="nb-badge nb-badge-mint">{tx.payment_status}</span>
                        </td>
                        <td style={{ fontWeight: 800 }}>{formatINR(tx.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--nb-text-muted)', fontSize: '0.9rem' }}>No recent transactions found.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Staff Directory & RBAC Governance */}
      {activeTab === 'STAFF' && (
        <div className="nb-card" style={{ background: 'var(--nb-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem' }}>Staff Account Directory & Access Levels</h3>
              <p style={{ color: 'var(--nb-text-muted)', fontSize: '0.85rem' }}>
                Review active staff personnel, role classifications, and system privileges.
              </p>
            </div>
            <span className="nb-badge nb-badge-yellow">Total Staff: {staffList.length}</span>
          </div>

          <div className="nb-table-container">
            <table className="nb-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Phone Number</th>
                  <th>System Role</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map(st => (
                  <tr key={st.id}>
                    <td style={{ fontWeight: 700 }}>#{st.id}</td>
                    <td style={{ fontWeight: 700 }}>{st.name}</td>
                    <td>{st.email}</td>
                    <td>{st.phone || 'N/A'}</td>
                    <td>
                      <span className={`nb-badge ${
                        st.role === 'ADMIN' || st.role === 'SYSTEM_ADMIN' ? 'nb-badge-coral' :
                        st.role === 'GROOMER' ? 'nb-badge-mint' : 'nb-badge-yellow'
                      }`}>
                        {st.role}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDateIN(st.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Service Catalog & Pricing */}
      {activeTab === 'SERVICES' && (
        <div className="nb-card" style={{ background: 'var(--nb-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem' }}>Service Catalog & Price Governance</h3>
              <p style={{ color: 'var(--nb-text-muted)', fontSize: '0.85rem' }}>
                Standardized offerings for boarding, daycare, and specialized grooming spas.
              </p>
            </div>
            <span className="nb-badge nb-badge-mint">Services Active: {services.length}</span>
          </div>

          <div className="nb-table-container">
            <table className="nb-table">
              <thead>
                <tr>
                  <th>Service Name</th>
                  <th>Category</th>
                  <th>Target Species</th>
                  <th>Duration</th>
                  <th>Base Fee (INR)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {services.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700 }}>{s.service_name}</td>
                    <td>
                      <span className="nb-badge nb-badge-yellow">{s.category || 'Standard'}</span>
                    </td>
                    <td>{s.target_species || 'All Pets'}</td>
                    <td>{s.duration_minutes ? `${s.duration_minutes} mins` : 'Overnight'}</td>
                    <td style={{ fontWeight: 800 }}>{formatINR(s.base_price || s.price)}</td>
                    <td>
                      <span className="nb-badge nb-badge-mint">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Business Configuration & Policies */}
      {activeTab === 'CONFIG' && (
        <div className="nb-card" style={{ background: 'var(--nb-card)' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem' }}>System & Business Policies</h3>
            <p style={{ color: 'var(--nb-text-muted)', fontSize: '0.85rem' }}>
              Operational parameters stored in the backend database (deposit percentage, check-in cutoff, tax rate).
            </p>
          </div>

          {configList.length > 0 ? (
            <div className="nb-table-container">
              <table className="nb-table">
                <thead>
                  <tr>
                    <th>Config Key</th>
                    <th>Configured Value</th>
                    <th>Description</th>
                    <th>Access Role Required</th>
                  </tr>
                </thead>
                <tbody>
                  {configList.map(cfg => (
                    <tr key={cfg.key}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{cfg.key}</td>
                      <td style={{ fontWeight: 800, color: 'var(--nb-blue)' }}>{cfg.value}</td>
                      <td>{cfg.description || 'System operational parameter'}</td>
                      <td>
                        <span className="nb-badge nb-badge-yellow">ADMIN / SYSTEM_ADMIN</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--nb-text-muted)', fontSize: '0.9rem' }}>
              {role === 'SYSTEM_ADMIN' || role === 'ADMIN'
                ? 'Standard configurations loaded directly from system settings.'
                : 'Restricted to administrative staff.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
