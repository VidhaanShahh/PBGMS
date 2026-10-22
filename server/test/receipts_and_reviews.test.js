process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_NAME = 'pbgms_test.sqlite';
process.env.RAZORPAY_KEY_ID = 'rzp_test_pbgms_dummy_key_123';
process.env.RAZORPAY_KEY_SECRET = 'dummy_secret_for_cryptographic_tests_456';
process.env.RAZORPAY_WEBHOOK_SECRET = 'dummy_webhook_secret_789';

const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');
const { initPromise, run, get, all } = require('../src/config/sqliteDb');

let server;
let baseUrl;
let ownerToken;
let groomerToken;
let customerId;

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
    return d;
  }

  const ownerLogin = await login('owner@pbgms.in');
  ownerToken = ownerLogin.token;
  customerId = ownerLogin.user.id;

  const groomerLogin = await login('groomer@pbgms.in');
  groomerToken = groomerLogin.token;
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('SECTION 1: Authoritative Payment Simulation & Fee Calculation', async () => {
  // 1. Create a test grooming booking for the owner
  const pet = await get('SELECT id FROM pets WHERE owner_id = ? LIMIT 1', [customerId]);
  const service = await get("SELECT id, price FROM services WHERE category = 'Grooming' LIMIT 1");

  assert.ok(pet, 'Owner must have a pet in test database');
  assert.ok(service, 'Grooming service must exist');

  const today = new Date().toISOString().split('T')[0];
  const bookingNum = `TEST-SIM-${Date.now()}`;

  const insRes = await run(
    `INSERT INTO bookings (
      booking_number, owner_id, pet_id, booking_type, service_id,
      start_date, end_date, start_time, total_price, deposit_amount,
      status, created_at
    ) VALUES (?, ?, ?, 'GROOMING', ?, ?, ?, '10:00:00', ?, 0, 'Confirmed', datetime('now'))`,
    [bookingNum, customerId, pet.id, service.id, today, today, service.price]
  );
  const bookingId = insRes.lastID;

  // 2. Execute simulated deposit payment (20%)
  const simRes = await fetch(`${baseUrl}/api/payments/simulate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      booking_id: bookingId,
      payment_type: 'Deposit'
    })
  });

  assert.strictEqual(simRes.status, 201);
  const simData = await simRes.json();
  assert.strictEqual(simData.success, true);
  assert.ok(simData.payment_id, 'Payment ID returned');
  assert.ok(simData.transaction_reference.startsWith('SIM-'), 'Simulated transaction reference');
  assert.ok(simData.receipt_number.startsWith('RCP-SIM-'), 'Simulated receipt number');

  // Authoritative 20% check:
  const expectedDeposit = Math.round(Number(service.price) * 0.20 * 100) / 100;
  assert.strictEqual(Number(simData.amount), expectedDeposit);

  // 3. Test GET receipt endpoint
  const recRes = await fetch(`${baseUrl}/api/payments/receipt/${simData.payment_id}`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  assert.strictEqual(recRes.status, 200);
  const recData = await recRes.json();
  assert.strictEqual(recData.success, true);
  assert.strictEqual(recData.receipt.receipt_number, simData.receipt_number);
  assert.strictEqual(recData.booking.booking_number, bookingNum);

  // 4. Test GET downloadable PDF receipt endpoint
  const pdfRes = await fetch(`${baseUrl}/api/payments/receipt/${simData.payment_id}/pdf`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  assert.strictEqual(pdfRes.status, 200);
  assert.strictEqual(pdfRes.headers.get('content-type'), 'application/pdf');
  const pdfBuffer = await pdfRes.arrayBuffer();
  assert.ok(pdfBuffer.byteLength > 1000, 'PDF generated with non-trivial size');
  const pdfHeader = Buffer.from(pdfBuffer).subarray(0, 4).toString();
  assert.strictEqual(pdfHeader, '%PDF', 'Valid PDF magic bytes');
});

test('SECTION 2: Post-Grooming Review & Rating System', async () => {
  const pet = await get('SELECT id FROM pets WHERE owner_id = ? LIMIT 1', [customerId]);
  const service = await get("SELECT id, price FROM services WHERE category = 'Grooming' LIMIT 1");
  const today = new Date().toISOString().split('T')[0];

  // 1. Create a non-completed grooming booking (Confirmed)
  const pendingBookingNum = `TEST-REV-PEND-${Date.now()}`;
  const pendRes = await run(
    `INSERT INTO bookings (
      booking_number, owner_id, pet_id, booking_type, service_id,
      start_date, end_date, total_price, deposit_amount,
      status, created_at
    ) VALUES (?, ?, ?, 'GROOMING', ?, ?, ?, ?, ?, 'Confirmed', datetime('now'))`,
    [pendingBookingNum, customerId, pet.id, service.id, today, today, service.price, service.price]
  );
  const pendingBookingId = pendRes.lastID;

  // 2. Creating review on uncompleted booking should be rejected (400)
  const failRes = await fetch(`${baseUrl}/api/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      booking_id: pendingBookingId,
      rating: 5,
      review_text: 'Should fail because status is not Completed.'
    })
  });
  assert.strictEqual(failRes.status, 400);
  const failData = await failRes.json();
  assert.strictEqual(failData.success, false);
  assert.match(failData.message, /cannot be reviewed because its current status is/i);

  // 3. Mark the booking as Completed
  await run("UPDATE bookings SET status = 'Completed' WHERE id = ?", [pendingBookingId]);

  // 4. Verify eligible bookings endpoint includes it
  const eligRes = await fetch(`${baseUrl}/api/reviews/eligible-bookings`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  assert.strictEqual(eligRes.status, 200);
  const eligData = await eligRes.json();
  assert.strictEqual(eligData.success, true);
  const found = (eligData.bookings || eligData.data).find(b => b.id === pendingBookingId);
  assert.ok(found, 'Completed booking is eligible for review');

  // 5. Submit valid review (Rating 5)
  const submitRes = await fetch(`${baseUrl}/api/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      booking_id: pendingBookingId,
      rating: 5,
      review_text: 'Exceptional styling and gentle coat care!'
    })
  });
  assert.strictEqual(submitRes.status, 201);
  const submitData = await submitRes.json();
  assert.strictEqual(submitData.success, true);
  assert.ok(submitData.review_id, 'Review created successfully');

  // 6. Duplicate review on same booking should be rejected
  const dupRes = await fetch(`${baseUrl}/api/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      booking_id: pendingBookingId,
      rating: 4,
      review_text: 'Duplicate review attempt.'
    })
  });
  assert.strictEqual(dupRes.status, 409);
  const dupData = await dupRes.json();
  assert.strictEqual(dupData.success, false);
  assert.match(dupData.message, /already been submitted/i);

  // 7. Verify service reviews aggregation
  const srvRes = await fetch(`${baseUrl}/api/reviews/service/${service.id}`);
  assert.strictEqual(srvRes.status, 200);
  const srvData = await srvRes.json();
  assert.strictEqual(srvData.success, true);
  assert.ok(srvData.stats.total_reviews >= 1);
  assert.ok(srvData.stats.average_rating >= 1 && srvData.stats.average_rating <= 5);
  const verifiedRev = srvData.reviews.find(r => r.booking_id === pendingBookingId);
  assert.ok(verifiedRev, 'Submitted review appears in service reviews');
  assert.strictEqual(verifiedRev.rating, 5);
  assert.strictEqual(verifiedRev.review_text, 'Exceptional styling and gentle coat care!');

  // 8. Verify my-reviews endpoint
  const myRes = await fetch(`${baseUrl}/api/reviews/my-reviews`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  assert.strictEqual(myRes.status, 200);
  const myData = await myRes.json();
  assert.strictEqual(myData.success, true);
  const myRev = (myData.reviews || myData.data).find(r => r.booking_id === pendingBookingId);
  assert.ok(myRev, 'Review appears in customer my-reviews list');
});
