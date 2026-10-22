import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getBookingById,
  getPaymentConfig,
  createPaymentOrder,
  verifyPaymentSignature,
  getPaymentHistory
} from '../services/api';
import { formatINR, formatDateIN } from '../utils/formatters';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Lock,
  Receipt,
  FileCheck
} from 'lucide-react';

export default function Payment() {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [config, setConfig] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentType, setPaymentType] = useState('Deposit'); // 'Deposit' or 'Remaining Balance'
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState(null);
  const [showDemoModal, setShowDemoModal] = useState(false);

  // Load Razorpay Checkout Script dynamically if not already loaded
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [bookingRes, configRes, historyRes] = await Promise.all([
        getBookingById(bookingId),
        getPaymentConfig().catch(() => ({ success: false })),
        getPaymentHistory(bookingId).catch(() => ({ success: false }))
      ]);

      if (bookingRes.success && bookingRes.data) {
        setBooking(bookingRes.data);
        if (bookingRes.data.remaining_balance <= 0) {
          setPaymentType('Paid');
        } else if (bookingRes.data.paid_amount > 0) {
          setPaymentType('Remaining Balance');
        } else {
          setPaymentType('Deposit');
        }
      } else {
        setError('Booking details could not be found.');
      }

      if (configRes.success) {
        setConfig(configRes);
      }

      if (historyRes.success) {
        setPaymentHistory(historyRes.transactions || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load booking payment details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadRazorpayScript();
  }, [bookingId]);

  const handlePay = async () => {
    setError('');
    setProcessing(true);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Unable to load Razorpay payment gateway script. Please verify internet connectivity.');
      }

      if (!config?.configured) {
        // Open the College Presentation Demo Gateway Dialog
        setShowDemoModal(true);
        setProcessing(false);
        return;
      }

      // Step 1: Request server to authoritatively calculate amount and create Razorpay Order
      const orderRes = await createPaymentOrder({
        booking_id: Number(bookingId),
        payment_type: paymentType
      });

      if (!orderRes.success) {
        throw new Error(orderRes.message || 'Failed to initiate payment order.');
      }

      // Step 2: Configure Razorpay Standard Checkout options
      const options = {
        key: orderRes.key_id,
        amount: orderRes.amount, // in paise
        currency: orderRes.currency || 'INR',
        name: 'Pet Boarding & Grooming Management System',
        description: `${orderRes.payment_type} for Booking #${orderRes.booking_number}`,
        image: '/assets/dog-grooming.jpg',
        order_id: orderRes.order_id,
        prefill: {
          name: orderRes.customer?.name || '',
          email: orderRes.customer?.email || '',
          contact: orderRes.customer?.phone || ''
        },
        theme: {
          color: '#FFE45E' // Neo-brutalist PBGMS Yellow
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            setError('Payment checkout was closed before completion. Your booking remains pending.');
          }
        },
        // Step 3: Handle Gateway Success Callback
        handler: async (response) => {
          try {
            setProcessing(true);
            // Step 4: Submit signature and identifiers to backend for cryptographic verification
            const verifyRes = await verifyPaymentSignature({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              booking_id: Number(bookingId)
            });

            if (verifyRes.success) {
              setSuccessResult({
                payment_id: response.razorpay_payment_id,
                order_id: response.razorpay_order_id,
                message: verifyRes.message
              });
              loadData();
            } else {
              setError(verifyRes.message || 'Payment signature verification failed.');
            }
          } catch (verErr) {
            setError(verErr.message || 'Error occurred while verifying payment with server.');
          } finally {
            setProcessing(false);
          }
        }
      };

      // Step 5: Open real Razorpay Checkout modal
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (failResponse) => {
        setProcessing(false);
        setError(`Payment failed: ${failResponse.error?.description || 'Gateway transaction declined.'}`);
      });
      rzp.open();
    } catch (err) {
      setError(err.message || 'Payment initiation error.');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="nb-container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: '#666' }}>Loading verified billing & booking records...</p>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="nb-container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <div className="nb-alert nb-alert-coral" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <AlertCircle size={20} /> {error}
        </div>
        <Link to="/my-bookings" className="nb-btn nb-btn-white" style={{ marginTop: '1.5rem' }}>
          <ArrowLeft size={16} /> Return to My Bookings
        </Link>
      </div>
    );
  }

  const depositAmount = Math.round((booking.total_price * 0.20) * 100) / 100;
  const remainingDue = booking.remaining_balance || 0;

  return (
    <div className="nb-container" style={{ padding: '3.5rem 1.5rem', maxWidth: '850px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/my-bookings" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#171717', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back to Reservations
        </Link>
      </div>

      <div className="nb-card" style={{ background: '#FFFFFF', padding: '2.5rem' }}>
        {/* Header */}
        <div style={{ borderBottom: '2.5px solid #171717', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
          <div className="nb-badge nb-badge-yellow" style={{ marginBottom: '0.4rem' }}>
            <Lock size={12} /> Encrypted Gateway Checkout
          </div>
          <h1 style={{ fontSize: '2rem' }}>Payment & Settle Balance</h1>
          <p style={{ color: '#666', fontSize: '0.92rem' }}>
            Reservation <strong>#{booking.booking_number}</strong> for {booking.pet_name} ({booking.pet_species}).
          </p>
        </div>

        {/* Razorpay Gateway Status Alert */}
        {config && !config.configured && (
          <div className="nb-alert nb-alert-yellow" style={{ marginBottom: '1.5rem', borderLeft: '6px solid #F59E0B' }}>
            <AlertCircle size={22} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span className="nb-badge nb-badge-coral" style={{ fontSize: '0.72rem', fontWeight: 800 }}>DEMO / PRESENTATION MODE</span>
                <strong>Razorpay Test API Keys Not Set in server/.env</strong>
              </div>
              <div style={{ fontSize: '0.86rem', color: '#444' }}>
                To launch the official Razorpay Checkout modal in <strong>Test Mode (Sandbox)</strong> without real money, set <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code> in <code>server/.env</code>.
              </div>
            </div>
          </div>
        )}

        {config && config.configured && (
          <div className="nb-alert nb-alert-mint" style={{ marginBottom: '1.5rem', borderLeft: '6px solid #10B981' }}>
            <ShieldCheck size={22} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span className="nb-badge nb-badge-yellow" style={{ fontSize: '0.72rem', fontWeight: 800 }}>
                  {config.is_live ? 'LIVE GATEWAY' : 'RAZORPAY TEST MODE (SANDBOX)'}
                </span>
                <strong>Official Payment Gateway Connected</strong>
              </div>
              <div style={{ fontSize: '0.86rem', color: '#333' }}>
                {config.is_live
                  ? 'Connected to live banking networks.'
                  : 'Operating in Razorpay Sandbox (Test Mode). No real money is charged. Uses test card/UPI instruments.'}
              </div>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {successResult && (
          <div className="nb-alert nb-alert-mint" style={{ marginBottom: '1.5rem' }}>
            <CheckCircle2 size={24} />
            <div>
              <strong style={{ display: 'block', fontSize: '1.05rem' }}>Payment Verified Successfully!</strong>
              <div>Transaction Reference: <strong>{successResult.payment_id}</strong></div>
              <div style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>{successResult.message}</div>
            </div>
          </div>
        )}

        {error && (
          <div className="nb-alert nb-alert-coral" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={20} />
            <div>{error}</div>
          </div>
        )}

        {/* Booking Financial Breakdown Box */}
        <div style={{ background: '#FFF8E7', border: '2.5px solid #171717', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', textTransform: 'uppercase', color: '#555', marginBottom: '0.85rem' }}>
            Financial Breakdown (INR)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.95rem' }}>
            <div><strong>Guest:</strong> {booking.pet_name} ({booking.pet_breed || booking.pet_species})</div>
            <div><strong>Service:</strong> {booking.service_name || `${booking.room_type || 'Standard'} Boarding Suite`}</div>
            <div><strong>Schedule:</strong> {formatDateIN(booking.start_date)} {booking.end_date ? `to ${formatDateIN(booking.end_date)}` : `@ ${booking.start_time || '09:00 AM'}`}</div>
            <div><strong>Payment Status:</strong> <span className={`nb-badge ${booking.payment_status === 'Paid' ? 'nb-badge-mint' : booking.payment_status === 'Deposit Paid' ? 'nb-badge-yellow' : 'nb-badge-coral'}`} style={{ fontSize: '0.75rem' }}>{booking.payment_status || 'Pending'}</span></div>
            <div><strong>Total Booking Amount:</strong> <strong>{formatINR(booking.total_price)}</strong></div>
            <div><strong>Required 20% Deposit:</strong> {formatINR(depositAmount)}</div>
            <div><strong>Paid to Date:</strong> <span style={{ color: '#196E3F', fontWeight: 700 }}>{formatINR(booking.paid_amount)}</span></div>
            <div><strong>Remaining Amount Due:</strong> <span style={{ color: remainingDue > 0 ? '#BA2D21' : '#196E3F', fontWeight: 700 }}>{formatINR(remainingDue)}</span></div>
          </div>
        </div>

        {/* Payment Type Selection */}
        {remainingDue > 0 ? (
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.6rem' }}>
              Select Payment Option:
            </label>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {booking.paid_amount < depositAmount && (
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.85rem 1.25rem', border: '2px solid #171717', borderRadius: '8px',
                  background: paymentType === 'Deposit' ? 'var(--nb-yellow)' : '#FFFFFF', cursor: 'pointer',
                  fontWeight: 700
                }}>
                  <input
                    type="radio"
                    name="payOption"
                    checked={paymentType === 'Deposit'}
                    onChange={() => setPaymentType('Deposit')}
                  />
                  20% Mandatory Deposit ({formatINR(depositAmount)})
                </label>
              )}

              <label style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.85rem 1.25rem', border: '2px solid #171717', borderRadius: '8px',
                background: paymentType === 'Remaining Balance' ? 'var(--nb-yellow)' : '#FFFFFF', cursor: 'pointer',
                fontWeight: 700
              }}>
                <input
                  type="radio"
                  name="payOption"
                  checked={paymentType === 'Remaining Balance'}
                  onChange={() => setPaymentType('Remaining Balance')}
                />
                Pay Remaining Balance ({formatINR(remainingDue)})
              </label>
            </div>
          </div>
        ) : (
          <div className="nb-alert nb-alert-mint" style={{ marginBottom: '2rem' }}>
            <CheckCircle2 size={20} />
            <div>This booking is paid in full. No outstanding balance is due.</div>
          </div>
        )}

        {/* Action Button */}
        {remainingDue > 0 && (
          <div style={{ marginBottom: '2.5rem' }}>
            <button
              onClick={handlePay}
              disabled={processing}
              className="nb-btn nb-btn-coral"
              style={{ width: '100%', padding: '1rem', fontSize: '1.15rem' }}
            >
              {processing ? (
                <>Verifying Gateway Checkout...</>
              ) : (
                <>
                  <CreditCard size={20} /> Pay {formatINR(paymentType === 'Deposit' ? depositAmount : remainingDue)} via Razorpay
                </>
              )}
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: '#666', marginTop: '0.6rem' }}>
              Supports UPI (Google Pay, PhonePe, Paytm), Net Banking (HDFC, ICICI, SBI), and Credit/Debit Cards.
            </p>
          </div>
        )}

        {/* Verified Transaction History */}
        {paymentHistory.length > 0 && (
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Receipt size={18} /> Verified Transaction History
            </h3>
            <div className="nb-table-container">
              <table className="nb-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Reference #</th>
                    <th>Payment Type</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map(p => (
                    <tr key={p.id}>
                      <td>{formatDateIN(p.paid_at || p.created_at)}</td>
                      <td>
                        <strong>{p.transaction_reference}</strong>
                        {p.razorpay_payment_id && (
                          <span style={{ display: 'block', fontSize: '0.72rem', color: '#666' }}>
                            RZP: {p.razorpay_payment_id}
                          </span>
                        )}
                      </td>
                      <td>{p.payment_type}</td>
                      <td>{p.payment_method}</td>
                      <td><strong>{formatINR(p.amount)}</strong></td>
                      <td>
                        <span className={`nb-badge ${p.payment_status === 'Paid' ? 'nb-badge-mint' : p.payment_status === 'Refunded' ? 'nb-badge-coral' : 'nb-badge-yellow'}`}>
                          {p.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* College Presentation Demonstration Modal */}
      {showDemoModal && (
        <div className="nb-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="nb-card nb-modal-content" style={{
            background: '#FFFFFF',
            maxWidth: '560px',
            width: '100%',
            padding: '2rem',
            position: 'relative',
            border: '3px solid #171717',
            boxShadow: '8px 8px 0px #171717'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '2px solid #171717', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="nb-badge nb-badge-coral" style={{ fontSize: '0.72rem', fontWeight: 800 }}>DEMO MODE</span>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Payment Gateway Simulator</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="nb-btn nb-btn-sm nb-btn-white"
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.9rem' }}
              >
                ✕
              </button>
            </div>

            <div className="nb-alert nb-alert-yellow" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Notice:</strong> This is an interactive presentation preview. Because live banking credentials are not used, this simulation <strong>does not charge real money</strong> and does not mark the database booking as paid without genuine Razorpay cryptographic verification.
              </div>
            </div>

            <div style={{ background: '#F8F9FA', border: '1.5px solid #171717', borderRadius: '6px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                <span style={{ color: '#666' }}>Payable Amount:</span>
                <strong style={{ fontSize: '1.1rem' }}>{formatINR(paymentType === 'Deposit' ? depositAmount : remainingDue)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#666' }}>Booking Reference:</span>
                <span>#{booking.booking_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#666' }}>Service & Guest:</span>
                <span>{booking.service_name || 'Boarding'} ({booking.pet_name})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#666' }}>Payment Category:</span>
                <span>{paymentType}</span>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: '#444' }}>
                Select Simulated Payment Instrument:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ border: '1.5px solid #171717', borderRadius: '4px', padding: '0.5rem', background: '#FFF9DB', fontSize: '0.82rem', fontWeight: 600 }}>
                  📱 UPI / QR Code (Simulated)
                </div>
                <div style={{ border: '1.5px solid #171717', borderRadius: '4px', padding: '0.5rem', background: '#FFF9DB', fontSize: '0.82rem', fontWeight: 600 }}>
                  💳 Card: 4111 •••• •••• 1111 (Test)
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  setShowDemoModal(false);
                  setError('Demonstration simulated: No real payment was charged. To process genuine test payments, provide RAZORPAY_KEY_ID in server/.env.');
                }}
                className="nb-btn nb-btn-coral"
                style={{ flex: 1, padding: '0.75rem' }}
              >
                Simulate Gateway Exit
              </button>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="nb-btn nb-btn-white"
                style={{ padding: '0.75rem 1.25rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
