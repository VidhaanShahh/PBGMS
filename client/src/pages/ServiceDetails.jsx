import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getServiceById, getServiceReviews } from '../services/api';
import { formatINR, formatDateIN } from '../utils/formatters';
import { Calendar, ArrowLeft, CheckCircle2, ShieldAlert, Star, Clock, Sparkles } from 'lucide-react';
import groomingImg from '../assets/dog-grooming.jpg';
import heroDogImg from '../assets/hero-dog.jpg';
import boardingImg from '../assets/pet-boarding.jpg';

export default function ServiceDetails() {
  const { id } = useParams();
  const [service, setService] = useState(null);
  const [reviewsData, setReviewsData] = useState({ reviews: [], average_rating: 0, total_reviews: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const [svcRes, revRes] = await Promise.all([
          getServiceById(id),
          getServiceReviews(id).catch(() => ({ success: false, reviews: [], average_rating: 0, total_reviews: 0 }))
        ]);

        if (svcRes.success && svcRes.service) {
          setService(svcRes.service);
        } else if (svcRes.success && svcRes.data) {
          setService(svcRes.data);
        } else {
          setError('Service not found.');
        }

        if (revRes.success) {
          setReviewsData({
            reviews: revRes.reviews || [],
            average_rating: revRes.average_rating || 0,
            total_reviews: revRes.total_reviews || 0,
            star_counts: revRes.star_counts || {}
          });
        }
      } catch (err) {
        setError(err.message || 'Error fetching service details.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="nb-container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: '#666' }}>Loading verified service details...</p>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="nb-container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <div className="nb-card" style={{ maxWidth: '500px', margin: '0 auto', background: '#FFFFFF' }}>
          <ShieldAlert size={48} style={{ color: 'var(--nb-coral)', margin: '0 auto 1rem' }} />
          <h2>Service Record Not Found</h2>
          <p style={{ color: '#666', margin: '0.75rem 0 1.5rem' }}>
            {error || 'The requested service does not exist in our authoritative catalog.'}
          </p>
          <Link to="/" className="nb-btn nb-btn-coral">
            <ArrowLeft size={16} /> Back to Catalog
          </Link>
        </div>
      </div>
    );
  }

  const headerImage = service.category === 'Boarding' ? boardingImg : (service.target_pet_type === 'Dog' ? groomingImg : heroDogImg);

  return (
    <div className="nb-container" style={{ padding: '3.5rem 1.5rem', maxWidth: '960px' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#171717', marginBottom: '1.5rem', fontWeight: 700, textDecoration: 'none' }}>
        <ArrowLeft size={16} /> Back to Services Catalog
      </Link>

      <div className="nb-card" style={{ background: '#FFFFFF', padding: '0', overflow: 'hidden', marginBottom: '2.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1.2fr' }}>
          <div style={{ height: '100%', minHeight: '340px', background: '#F8F6F0', borderRight: '2.5px solid #171717' }}>
            <img
              src={headerImage}
              alt={service.service_name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <span className="nb-badge nb-badge-yellow">{service.category}</span>
                <span className="nb-badge nb-badge-mint">Target: {service.target_pet_type}</span>
                {reviewsData.total_reviews > 0 && (
                  <span className="nb-badge nb-badge-coral" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Star size={12} fill="#FFFFFF" color="#FFFFFF" /> {reviewsData.average_rating.toFixed(1)} / 5 ({reviewsData.total_reviews} reviews)
                  </span>
                )}
              </div>

              <h1 style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>{service.service_name}</h1>
              <p style={{ color: '#444', fontSize: '1rem', lineHeight: '1.6', marginBottom: '1.75rem' }}>
                {service.description}
              </p>

              <div style={{ background: '#FFF9DB', border: '2px solid #171717', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.75rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#666', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Authoritative Session Rate</span>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#171717', fontFamily: 'var(--font-heading)' }}>
                  {formatINR(service.price)}
                </span>
                <span style={{ fontSize: '0.82rem', color: '#555', display: 'block', marginTop: '0.25rem' }}>
                  Includes 20% reservation deposit policy and full sanitization compliance.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Link
                to={service.category === 'Boarding' ? '/boarding/book' : `/grooming/book?service_id=${service.id}`}
                className="nb-btn nb-btn-coral"
                style={{ padding: '0.85rem 2rem', fontSize: '1.05rem' }}
              >
                <Calendar size={18} /> Book This Service
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Verified Customer Reviews Section ── */}
      <div className="nb-card" style={{ background: '#FFFFFF', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #171717', paddingBottom: '1rem' }}>
          <div>
            <span className="nb-badge nb-badge-mint" style={{ marginBottom: '0.3rem' }}>Authentic Feedback</span>
            <h2 style={{ fontSize: '1.6rem', margin: 0 }}>Customer Reviews & Ratings</h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
              <Star size={24} fill="#F59E0B" color="#D97706" />
              <span style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                {reviewsData.total_reviews > 0 ? reviewsData.average_rating.toFixed(1) : '—'}
              </span>
              <span style={{ color: '#666', fontSize: '0.9rem' }}>/ 5.0</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#666' }}>
              {reviewsData.total_reviews} verified customer review{reviewsData.total_reviews === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {reviewsData.reviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#F8F9FA', border: '1.5px dashed #171717', borderRadius: '6px' }}>
            <Sparkles size={36} color="#777" style={{ marginBottom: '0.75rem' }} />
            <h4>No Verified Reviews Yet</h4>
            <p style={{ fontSize: '0.88rem', color: '#666', marginTop: '0.35rem' }}>
              Only pet owners with completed grooming appointments can submit verified reviews. Be the first to review after your pet's session!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reviewsData.reviews.map(r => (
              <div key={r.id} style={{ background: '#FAF7F0', border: '1.5px solid #171717', borderRadius: '6px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ display: 'flex' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={16}
                          fill={s <= r.rating ? '#F59E0B' : '#E5E7EB'}
                          color={s <= r.rating ? '#D97706' : '#9CA3AF'}
                        />
                      ))}
                    </div>
                    <strong style={{ fontSize: '0.95rem' }}>{r.reviewer_name}</strong>
                    <span className="nb-badge nb-badge-mint" style={{ fontSize: '0.65rem' }}>Verified Stay</span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#666' }}>{formatDateIN(r.created_at)}</span>
                </div>

                <p style={{ fontSize: '0.95rem', color: '#171717', margin: '0.5rem 0', lineHeight: 1.5 }}>
                  "{r.review_text}"
                </p>

                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: '#666', marginTop: '0.4rem', borderTop: '1px dashed #E5E7EB', paddingTop: '0.4rem' }}>
                  <span>Pet: <strong>{r.pet_name}</strong></span>
                  {r.groomer_name && <span>Stylist: <strong>{r.groomer_name}</strong></span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

