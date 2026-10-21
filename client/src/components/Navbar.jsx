import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PawPrint, User, Calendar, LogOut, Shield, Scissors, Home as HomeIcon, Menu, X, PlusCircle } from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, logout, role } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isStaff = ['ADMIN', 'SYSTEM_ADMIN', 'FRONT_DESK', 'GROOMER', 'BOARDING_ATTENDANT'].includes(role);

  return (
    <header style={{
      background: '#FFFFFF',
      borderBottom: '2.5px solid #171717',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 4px 0px #171717'
    }}>
      <div className="nb-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '74px' }}>
        
        {/* Brand Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
          <div style={{
            background: 'var(--nb-yellow)',
            border: '2px solid #171717',
            boxShadow: '2px 2px 0px #171717',
            borderRadius: '8px',
            padding: '0.45rem',
            display: 'flex'
          }}>
            <PawPrint size={24} color="#171717" strokeWidth={2.5} />
          </div>
          <div>
            <span style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: '1.35rem',
              color: '#171717',
              letterSpacing: '-0.03em'
            }}>
              PBGMS<span style={{ color: 'var(--nb-coral)' }}>.IN</span>
            </span>
            <span style={{
              display: 'block',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginTop: '-3px'
            }}>
              Pet Boarding & Grooming
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <Link to="/" style={{ fontWeight: 700, color: '#171717', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <HomeIcon size={16} /> Home
          </Link>
          <Link to="/boarding/book" style={{ fontWeight: 700, color: '#171717' }}>
            Boarding Stay
          </Link>
          <Link to="/grooming/book" style={{ fontWeight: 700, color: '#171717' }}>
            Grooming Spa
          </Link>

          {isAuthenticated ? (
            <>
              {/* Pet Owner Links */}
              {role === 'PET_OWNER' && (
                <>
                  <Link to="/my-pets" style={{ fontWeight: 700, color: '#171717', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <PawPrint size={16} /> My Pets
                  </Link>
                  <Link to="/my-bookings" style={{ fontWeight: 700, color: '#171717', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Calendar size={16} /> My Bookings
                  </Link>
                </>
              )}

              {/* Staff / Admin Operations link */}
              {isStaff && (
                <Link to="/staff/dashboard" className="nb-badge nb-badge-yellow" style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}>
                  <Shield size={14} /> Staff Ops ({role.replace('_', ' ')})
                </Link>
              )}

              {/* User Dropdown / Logout */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '0.5rem' }}>
                <span className="nb-badge nb-badge-mint">
                  <User size={12} /> {user.name.split(' ')[0]}
                </span>
                <button onClick={handleLogout} className="nb-btn nb-btn-white nb-btn-sm" title="Log Out">
                  <LogOut size={14} /> Exit
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Link to="/login" className="nb-btn nb-btn-white nb-btn-sm">
                Log In
              </Link>
              <Link to="/register" className="nb-btn nb-btn-sm" style={{ background: 'var(--nb-yellow)' }}>
                Register Free
              </Link>
            </div>
          )}
        </nav>

      </div>
    </header>
  );
}
