import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getServices } from '../services/api';
import { formatINR } from '../utils/formatters';
import { PawPrint, ShieldCheck, Sparkles, Calendar, Clock, ArrowRight } from 'lucide-react';
import heroDogImg from '../assets/hero-dog.jpg';
import groomingImg from '../assets/dog-grooming.jpg';
import boardingImg from '../assets/pet-boarding.jpg';

export default function Home() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getServices()
      .then(res => {
        if (res.success && res.data) {
          setServices(res.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* ── Hero Section ── */}
      <section style={{
        background: 'var(--nb-yellow)',
        borderBottom: 'var(--nb-border-thick)',
        padding: '3.5rem 0 3.5rem 0',
        position: 'relative'
      }}>
        <div className="nb-container" style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '3rem', alignItems: 'center' }}>
          <div>
            <div className="nb-badge nb-badge-coral" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              🇮🇳 Premier Pet Boarding & Grooming in India
            </div>
            <h1 style={{ fontSize: '3.2rem', lineHeight: '1.12', marginBottom: '1.25rem' }}>
              Exceptional Boarding & Spa Grooming for Pets Who Deserve Royalty.
            </h1>
            <p style={{ fontSize: '1.15rem', fontWeight: 500, marginBottom: '2rem', maxWidth: '580px', color: '#2b2b2b' }}>
              Climate-controlled luxury suites, certified master groomers, daily exercise logs, and verified vaccination standards compliant with PBGMS specifications.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to="/boarding/book" className="nb-btn nb-btn-coral" style={{ fontSize: '1.05rem', padding: '0.85rem 1.75rem' }}>
                <Calendar size={18} /> Book Boarding Stay
              </Link>
              <Link to="/grooming/book" className="nb-btn nb-btn-white" style={{ fontSize: '1.05rem', padding: '0.85rem 1.75rem' }}>
                <Sparkles size={18} /> Reserve Grooming Spa
              </Link>
            </div>
          </div>

          {/* Hero Feature Card with High-Resolution Dog Image */}
          <div className="nb-card" style={{ background: 'var(--nb-card)', padding: '1rem', transform: 'rotate(1deg)' }}>
            <div style={{
              border: '2.5px solid #171717',
              borderRadius: '8px',
              overflow: 'hidden',
              marginBottom: '1rem',
              boxShadow: '3px 3px 0px #171717',
              height: '240px',
              background: '#F0ECE1'
            }}>
              <img
                src={heroDogImg}
                alt="Happy Golden Retriever dog in certified pet care facility"
                width="420"
                height="240"
                fetchPriority="high"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: 'var(--nb-mint)', border: '2px solid #171717', borderRadius: '6px', padding: '0.4rem' }}>
                <ShieldCheck size={22} color="#171717" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem' }}>Verified Pet Safety</h3>
                <p style={{ fontSize: '0.82rem', color: '#555' }}>Mandatory Core Vaccination Protocol</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ border: '2px solid #171717', background: '#F8F6F0', padding: '0.65rem', borderRadius: '6px' }}>
                <strong style={{ display: 'block', fontSize: '1.2rem', fontFamily: 'var(--font-heading)' }}>24/7</strong>
                <span style={{ fontSize: '0.75rem', color: '#555' }}>Attendant Care & Play</span>
              </div>
              <div style={{ border: '2px solid #171717', background: 'var(--nb-mint)', padding: '0.65rem', borderRadius: '6px' }}>
                <strong style={{ display: 'block', fontSize: '1.2rem', fontFamily: 'var(--font-heading)' }}>₹1,200</strong>
                <span style={{ fontSize: '0.75rem', color: '#171717' }}>Starting Room Rate</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Services Catalog with High Quality Pet Images ── */}
      <section className="nb-container" style={{ marginTop: '4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
          <div>
            <div className="nb-badge nb-badge-mint" style={{ marginBottom: '0.5rem' }}>Services Catalog</div>
            <h2 style={{ fontSize: '2.2rem' }}>Signature Boarding & Grooming Services</h2>
          </div>
          <Link to="/grooming/book" className="nb-btn nb-btn-white nb-btn-sm">
            View All Slots <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="nb-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ fontWeight: 700 }}>Loading services from database...</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '2rem' }}>
            {services.map(svc => {
              const cardImg = svc.category === 'Boarding' ? boardingImg : (svc.target_pet_type === 'Dog' ? groomingImg : heroDogImg);
              return (
                <div key={svc.id} className="nb-card nb-card-hover" style={{ display: 'flex', flexDirection: 'column', padding: '1rem' }}>
                  <div style={{
                    border: '2px solid #171717',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    height: '170px',
                    marginBottom: '1rem',
                    boxShadow: '2px 2px 0px #171717'
                  }}>
                    <img
                      src={cardImg}
                      alt={svc.service_name}
                      width="340"
                      height="170"
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <span className={`nb-badge ${svc.category === 'Boarding' ? 'nb-badge-yellow' : 'nb-badge-mint'}`}>
                      {svc.category} • {svc.target_pet_type}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 800,
                      fontSize: '1.4rem',
                      color: 'var(--nb-black)'
                    }}>
                      {formatINR(svc.price)}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{svc.service_name}</h3>
                  <p style={{ fontSize: '0.88rem', color: '#444', marginBottom: '1.25rem', flex: 1, lineHeight: '1.5' }}>
                    {svc.description}
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.85rem',
                    borderTop: '2px dashed #E0DCD3'
                  }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#666', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={15} /> {svc.duration_minutes || 60} mins
                    </span>
                    <Link
                      to={svc.category === 'Boarding' ? '/boarding/book' : `/grooming/book?service_id=${svc.id}`}
                      className="nb-btn nb-btn-sm"
                      style={{ background: 'var(--nb-yellow)' }}
                    >
                      Reserve Now
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Key Highlights Banner ── */}
      <section className="nb-container" style={{ marginTop: '4rem' }}>
        <div className="nb-card nb-card-coral" style={{ color: 'white' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
            <div>
              <h4 style={{ fontSize: '1.25rem', color: 'white', marginBottom: '0.5rem' }}>💰 Transparent INR Rates</h4>
              <p style={{ fontSize: '0.9rem', color: '#FFEBEA' }}>No hidden charges. Clear 20% online booking deposit and complete balance settlement at check-out.</p>
            </div>
            <div>
              <h4 style={{ fontSize: '1.25rem', color: 'white', marginBottom: '0.5rem' }}>🩺 Medical & Diet Tracking</h4>
              <p style={{ fontSize: '0.9rem', color: '#FFEBEA' }}>Custom feeding instructions, allergies, and medication regimes logged directly to attendants daily.</p>
            </div>
            <div>
              <h4 style={{ fontSize: '1.25rem', color: 'white', marginBottom: '0.5rem' }}>🕒 48-Hour Free Cancellation</h4>
              <p style={{ fontSize: '0.9rem', color: '#FFEBEA' }}>Plans change? Cancel eligible bookings 48 hours prior with immediate 100% deposit refund.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
