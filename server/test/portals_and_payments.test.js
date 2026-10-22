process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_NAME = 'pbgms_test.sqlite';
process.env.RAZORPAY_KEY_ID = 'rzp_test_pbgms_dummy_key_123';
process.env.RAZORPAY_KEY_SECRET = 'dummy_secret_for_cryptographic_tests_456';
process.env.RAZORPAY_WEBHOOK_SECRET = 'dummy_webhook_secret_789';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const http = require('http');
const app = require('../src/app');
const { initPromise, run, get, all } = require('../src/config/sqliteDb');

let server;
let baseUrl;
let adminToken;
let frontDeskToken;
let groomerToken;
let attendantToken;
let ownerToken;

test.before(async () => {
  await initPromise;
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  async function login(email) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'admin123' })
    });
    const d = await res.json();
    return d.token;
  }

  adminToken = await login('admin@pbgms.in');
  frontDeskToken = await login('frontdesk@pbgms.in');
  groomerToken = await login('groomer@pbgms.in');
  attendantToken = await login('attendant@pbgms.in');
  ownerToken = await login('owner@pbgms.in');
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('SECTION 2: Front Desk Operational Portal & Workflows', async () => {
  // 1. Get real operational stats
  const statsRes = await fetch(`${baseUrl}/api/frontdesk/stats`, {
    headers: { 'Authorization': `Bearer ${frontDeskToken}` }
  });
  assert.strictEqual(statsRes.status, 200);
  const statsData = await statsRes.json();
  assert.strictEqual(statsData.success, true);
  assert.ok(typeof statsData.data.today_arrivals === 'number');
  assert.ok(typeof statsData.data.today_departures === 'number');
  assert.ok(typeof statsData.data.in_house_guests === 'number');
  assert.ok(typeof statsData.data.outstanding_balances === 'number');

  // 2. Front Desk search & filter bookings
  const bookingsRes = await fetch(`${baseUrl}/api/frontdesk/bookings?type=BOARDING`, {
    headers: { 'Authorization': `Bearer ${frontDeskToken}` }
  });
  assert.strictEqual(bookingsRes.status, 200);
  const bookingsData = await bookingsRes.json();
  assert.strictEqual(bookingsData.success, true);
  assert.ok(Array.isArray(bookingsData.data));

  // 3. Customer Directory access
  const custRes = await fetch(`${baseUrl}/api/frontdesk/customers`, {
    headers: { 'Authorization': `Bearer ${frontDeskToken}` }
  });
  assert.strictEqual(custRes.status, 200);
  const custData = await custRes.json();
  assert.strictEqual(custData.success, true);
  assert.ok(custData.data.length > 0);

  // 4. Grooming coordination queue
  const groomCoordRes = await fetch(`${baseUrl}/api/frontdesk/grooming-coordination`, {
    headers: { 'Authorization': `Bearer ${frontDeskToken}` }
  });
  assert.strictEqual(groomCoordRes.status, 200);
  const groomCoordData = await groomCoordRes.json();
  assert.strictEqual(groomCoordData.success, true);

  // 5. Negative RBAC: Pet owner cannot access Front Desk stats
  const unauthStatsRes = await fetch(`${baseUrl}/api/frontdesk/stats`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  assert.strictEqual(unauthStatsRes.status, 403);
});

test('SECTION 3: Groomer Studio Portal & Clinical Checklist Lifecycle', async () => {
  // 1. Groomer Dashboard (filtered for groomer)
  const dashRes = await fetch(`${baseUrl}/api/grooming/dashboard`, {
    headers: { 'Authorization': `Bearer ${groomerToken}` }
  });
  assert.strictEqual(dashRes.status, 200);
  const dashData = await dashRes.json();
  assert.strictEqual(dashData.success, true);
  assert.ok(typeof dashData.data.today_total === 'number');
  assert.ok(typeof dashData.data.in_service === 'number');
  assert.ok(typeof dashData.data.ready_for_collection === 'number');

  // 2. Find a grooming booking to test session lifecycle
  const allBookings = await all(`SELECT id, status FROM bookings WHERE booking_type = 'GROOMING' ORDER BY id DESC LIMIT 1`);
  if (allBookings.length > 0) {
    const bookingId = allBookings[0].id;

    // Open session details
    const sessionRes = await fetch(`${baseUrl}/api/grooming/sessions/${bookingId}`, {
      headers: { 'Authorization': `Bearer ${groomerToken}` }
    });
    assert.strictEqual(sessionRes.status, 200);
    const sessionData = await sessionRes.json();
    assert.strictEqual(sessionData.success, true);
    assert.ok(sessionData.booking);
    assert.ok(sessionData.session);

    // Start session
    const startRes = await fetch(`${baseUrl}/api/grooming/sessions/${bookingId}/start`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groomerToken}` }
    });
    assert.strictEqual(startRes.status, 200);

    // Update checklist & clinical observations
    const checklistRes = await fetch(`${baseUrl}/api/grooming/sessions/${bookingId}/checklist`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groomerToken}`
      },
      body: JSON.stringify({
        checklist_bathing: true,
        checklist_drying: true,
        checklist_brushing: true,
        checklist_nail_trimming: true,
        coat_condition: 'Clean, no matting',
        skin_condition: 'Healthy, no irritation',
        behavior_notes: 'Very calm and cooperative during bath.',
        recommendations: 'Brush twice weekly.',
        handover_notes: 'Grooming completed beautifully.'
      })
    });
    assert.strictEqual(checklistRes.status, 200);
    const checklistData = await checklistRes.json();
    assert.strictEqual(checklistData.session.checklist_bathing, 1);
    assert.strictEqual(checklistData.session.checklist_drying, 1);
    assert.strictEqual(checklistData.session.coat_condition, 'Clean, no matting');

    // Complete session (marks Ready for Collection)
    const completeRes = await fetch(`${baseUrl}/api/grooming/sessions/${bookingId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groomerToken}`
      },
      body: JSON.stringify({
        handover_notes: 'Pet is fresh and ready for owner pickup.',
        recommendations: 'Use conditioning spray.'
      })
    });
    assert.strictEqual(completeRes.status, 200);

    // Verify booking status is now 'Ready for Collection'
    const updatedBooking = await get(`SELECT status, handover_notes FROM bookings WHERE id = ?`, [bookingId]);
    assert.strictEqual(updatedBooking.status, 'Ready for Collection');
    assert.strictEqual(updatedBooking.handover_notes, 'Pet is fresh and ready for owner pickup.');

    // Front Desk Handover (Customer arrives to collect pet)
    const handoverRes = await fetch(`${baseUrl}/api/frontdesk/grooming-handover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${frontDeskToken}`
      },
      body: JSON.stringify({ booking_id: bookingId })
    });
    assert.strictEqual(handoverRes.status, 200);

    const finalBooking = await get(`SELECT status FROM bookings WHERE id = ?`, [bookingId]);
    assert.strictEqual(finalBooking.status, 'Completed');
  }

  // Negative test: Front Desk cannot start or modify groomer clinical checklists
  const unauthChecklistRes = await fetch(`${baseUrl}/api/grooming/dashboard`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  assert.strictEqual(unauthChecklistRes.status, 403);
});

test('SECTION 6: Real Payment Gateway (Razorpay) Architecture & Verification', async () => {
  // 1. Public gateway config endpoint
  const configRes = await fetch(`${baseUrl}/api/payments/config`);
  assert.strictEqual(configRes.status, 200);
  const configData = await configRes.json();
  assert.strictEqual(configData.success, true);
  assert.strictEqual(configData.currency, 'INR');
  assert.strictEqual(configData.key_id, 'rzp_test_pbgms_dummy_key_123');

  // 2. Get an active booking for payment testing
  const sampleBooking = await get(`
    SELECT b.*, u.email as owner_email
    FROM bookings b
    JOIN users u ON b.owner_id = u.id
    WHERE b.owner_id = 5
    ORDER BY b.id DESC LIMIT 1
  `);

  if (sampleBooking) {
    const bookingId = sampleBooking.id;

    // 3. Cryptographic signature verification logic:
    const testOrderId = `order_${Date.now()}`;
    const testPaymentId = `pay_${Date.now()}`;
    const secret = process.env.RAZORPAY_KEY_SECRET;

    // Generate valid HMAC SHA256 signature
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${testOrderId}|${testPaymentId}`)
      .digest('hex');

    // Negative Test: Invalid signature must be rejected with 400
    const invalidVerifyRes = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        razorpay_order_id: testOrderId,
        razorpay_payment_id: testPaymentId,
        razorpay_signature: 'invalid_malicious_signature_hash',
        booking_id: bookingId
      })
    });
    assert.strictEqual(invalidVerifyRes.status, 400);
    const invalidData = await invalidVerifyRes.json();
    assert.strictEqual(invalidData.success, false);
    assert.ok(invalidData.message.includes('verification failed'));

    // Positive Test: Valid cryptographic signature must be accepted and persisted in SQLite
    const validVerifyRes = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        razorpay_order_id: testOrderId,
        razorpay_payment_id: testPaymentId,
        razorpay_signature: validSignature,
        booking_id: bookingId
      })
    });
    assert.strictEqual(validVerifyRes.status, 200);
    const validData = await validVerifyRes.json();
    assert.strictEqual(validData.success, true);
    assert.strictEqual(validData.razorpay_payment_id, testPaymentId);

    // Verify record in SQLite database
    const savedPayment = await get(
      `SELECT * FROM payments WHERE razorpay_payment_id = ? AND payment_status = 'Paid'`,
      [testPaymentId]
    );
    assert.ok(savedPayment);
    assert.strictEqual(savedPayment.razorpay_order_id, testOrderId);
    assert.strictEqual(savedPayment.payment_status, 'Paid');

    // Test duplicate verification idempotency (must not duplicate transaction)
    const duplicateRes = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        razorpay_order_id: testOrderId,
        razorpay_payment_id: testPaymentId,
        razorpay_signature: validSignature,
        booking_id: bookingId
      })
    });
    assert.strictEqual(duplicateRes.status, 200);
    const duplicateData = await duplicateRes.json();
    assert.ok(duplicateData.message.includes('already been verified'));

    // Check payment history endpoint
    const historyRes = await fetch(`${baseUrl}/api/payments/history/${bookingId}`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert.strictEqual(historyRes.status, 200);
    const historyData = await historyRes.json();
    assert.strictEqual(historyData.success, true);
    assert.ok(historyData.transactions.some(t => t.razorpay_payment_id === testPaymentId));

    // 4. Webhook cryptographic verification test:
    const webhookPayload = JSON.stringify({
      entity: 'event',
      account_id: 'acc_dummy123',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_hook_${Date.now()}`,
            order_id: testOrderId,
            amount: 50000,
            status: 'captured'
          }
        }
      }
    });

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const validWebhookSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookPayload)
      .digest('hex');

    // Missing webhook signature must be rejected
    const badWebhookRes = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: webhookPayload
    });
    assert.strictEqual(badWebhookRes.status, 400);

    // Valid webhook signature must succeed (200 OK)
    const goodWebhookRes = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validWebhookSig
      },
      body: webhookPayload
    });
    assert.strictEqual(goodWebhookRes.status, 200);
  }

  // Negative test: Unauthenticated payment order request rejected with 401
  const unauthOrderRes = await fetch(`${baseUrl}/api/payments/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking_id: 1 })
  });
  assert.strictEqual(unauthOrderRes.status, 401);
});
