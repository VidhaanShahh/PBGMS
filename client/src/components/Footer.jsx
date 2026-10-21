import React from 'react';
import { PawPrint, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{
      background: '#171717',
      color: '#FFFFFF',
      borderTop: '3px solid #171717',
      padding: '3rem 0 2rem 0',
      marginTop: 'auto'
    }}>
      <div className="nb-container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2.5rem', marginBottom: '2.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ background: 'var(--nb-yellow)', padding: '0.35rem', borderRadius: '6px' }}>
                <PawPrint size={20} color="#171717" />
              </div>
              <h3 style={{ color: '#FFFFFF', fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }}>
                PBGMS<span style={{ color: 'var(--nb-coral)' }}>.IN</span>
              </h3>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#B0A89C', lineHeight: '1.6' }}>
              Pet Boarding and Grooming Management System Release 1.0. Certified facilities, vaccine compliance, and 24/7 attentive attendant care in India.
            </p>
          </div>

          <div>
            <h4 style={{ color: 'var(--nb-yellow)', fontSize: '0.95rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Services & Policies
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.88rem' }}>
              <li><a href="/boarding/book" style={{ color: '#E0DDD5' }}>Luxury Boarding Suites</a></li>
              <li><a href="/grooming/book" style={{ color: '#E0DDD5' }}>Master Grooming Spa</a></li>
              <li><a href="/my-pets" style={{ color: '#E0DDD5' }}>Vaccination Records</a></li>
              <li><a href="/my-bookings" style={{ color: '#E0DDD5' }}>48-Hour Refund Policy</a></li>
            </ul>
          </div>

          <div>
            <h4 style={{ color: 'var(--nb-yellow)', fontSize: '0.95rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Facility Working Hours
            </h4>
            <p style={{ fontSize: '0.88rem', color: '#E0DDD5', marginBottom: '0.4rem' }}>
              <strong>Monday – Saturday:</strong> 8:00 AM – 7:00 PM IST
            </p>
            <p style={{ fontSize: '0.88rem', color: '#E0DDD5', marginBottom: '0.4rem' }}>
              <strong>Sunday (Check-in/out):</strong> 9:00 AM – 4:00 PM IST
            </p>
            <p style={{ fontSize: '0.82rem', color: '#999', marginTop: '0.5rem' }}>
              Location: Mumbai & Bengaluru Centers • Contact: +91 98765 43210
            </p>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid #333333',
          paddingTop: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.82rem',
          color: '#888'
        }}>
          <p>© {new Date().getFullYear()} PBGMS India. All transactions denominated in Indian Rupees (₹).</p>
          <p>Compliant with IEEE 830 PBGMS Specifications & PCI-DSS Guidelines.</p>
        </div>
      </div>
    </footer>
  );
}
