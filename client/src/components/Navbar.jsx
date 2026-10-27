import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  PawPrint,
  User,
  Calendar,
  LogOut,
  Shield,
  Scissors,
  Home as HomeIcon,
  Sun,
  Moon,
  ClipboardList
} from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, logout, role } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header style={{
      background: 'var(--nb-header-bg)',
      borderBottom: 'var(--nb-border)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: 'var(--nb-shadow)'
    }}>
      <div className="nb-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '74px' }}>
        
        {/* Brand Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
          <div style={{
            background: 'var(--nb-yellow)',
            border: '2px solid var(--nb-border-color)',
            boxShadow: '2px 2px 0px var(--nb-border-color)',
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
              color: 'var(--nb-text)',
              letterSpacing: '-0.03em'
            }}>
              PBGMS<span style={{ color: 'var(--nb-coral)' }}>.IN</span>
            </span>
            <span style={{
              display: 'block',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: 'var(--nb-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginTop: '-3px'
            }}>
              Pet Boarding & Grooming
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.15rem' }}>
          <Link to="/" style={{ fontWeight: 700, color: 'var(--nb-text)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <HomeIcon size={16} /> Home
          </Link>

          {/* Public or Pet Owner Booking Links */}
          {(!isAuthenticated || role === 'PET_OWNER') && (
            <>
              <Link to="/boarding/book" style={{ fontWeight: 700, color: 'var(--nb-text)' }}>
                Boarding Stay
              </Link>
              <Link to="/grooming/book" style={{ fontWeight: 700, color: 'var(--nb-text)' }}>
                Grooming Spa
              </Link>
            </>
          )}

          {isAuthenticated ? (
            <>
              {/* Pet Owner Specific Navigation */}
              {role === 'PET_OWNER' && (
                <>
                  <Link to="/my-pets" style={{ fontWeight: 700, color: 'var(--nb-text)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <PawPrint size={16} /> My Pets
                  </Link>
                  <Link to="/my-bookings" style={{ fontWeight: 700, color: 'var(--nb-text)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Calendar size={16} /> My Bookings
                  </Link>
                </>
              )}

              {/* Front Desk Staff Exclusive Navigation */}
              {role === 'FRONT_DESK' && (
                <Link to="/front-desk" className="nb-badge nb-badge-yellow" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', textDecoration: 'none' }}>
                  <Shield size={14} /> Front Desk Console
                </Link>
              )}

              {/* Groomer Staff Exclusive Navigation */}
              {role === 'GROOMER' && (
                <Link to="/groomer" className="nb-badge nb-badge-mint" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', textDecoration: 'none' }}>
                  <Scissors size={14} /> Groomer Studio
                </Link>
              )}

              {/* Boarding Attendant Console Navigation */}
              {role === 'BOARDING_ATTENDANT' && (
                <Link to="/staff/dashboard" className="nb-badge nb-badge-yellow" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', textDecoration: 'none' }}>
                  <ClipboardList size={14} /> Attendant Console
                </Link>
              )}

              {/* Administrator & System Admin Navigation */}
              {['ADMIN', 'SYSTEM_ADMIN'].includes(role) && (
                <>
                  <Link to="/admin/dashboard" className="nb-badge nb-badge-yellow" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', textDecoration: 'none' }}>
                    <Shield size={14} /> Admin Console
                  </Link>
                  <Link to="/front-desk" style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--nb-text)' }}>
                    Front Desk
                  </Link>
                  <Link to="/groomer" style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--nb-text)' }}>
                    Groomer
                  </Link>
                </>
              )}

              {/* User Identity Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginLeft: '0.25rem' }}>
                <span className="nb-badge nb-badge-mint">
                  <User size={12} /> {user?.name ? user.name.split(' ')[0] : 'User'}
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
              <Link to="/register" className="nb-btn nb-btn-sm" style={{ background: 'var(--nb-yellow)', color: '#171717' }}>
                Register Free
              </Link>
            </div>
          )}

          {/* Theme Toggle Button (Light / Dark Mode) */}
          <button
            onClick={toggleTheme}
            id="theme-toggle-btn"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="nb-btn nb-btn-white nb-btn-sm"
            style={{
              padding: '0.4rem 0.65rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            {theme === 'dark' ? (
              <Sun size={16} color="var(--nb-yellow)" strokeWidth={2.5} />
            ) : (
              <Moon size={16} color="#171717" strokeWidth={2.5} />
            )}
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </span>
          </button>
        </nav>

      </div>
    </header>
  );
}
