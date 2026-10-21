process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_NAME = 'pbgms_test.sqlite';

const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');
const { get, run, all, initPromise } = require('../src/config/sqliteDb');

let server;
let baseUrl;

// Pre-seeded token holders
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

  // Log in to acquire tokens for all 5 pre-seeded roles
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

// Helper request
function api(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${baseUrl}/api${endpoint}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {})
  }).then(async res => {
    let data;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return { status: res.statusCode || res.status, data, headers: res.headers };
  });
}

// ─────────────────────────────────────────────────────────────
// PHASE 1: PET MANAGEMENT & OWNER ISOLATION
// ─────────────────────────────────────────────────────────────

let createdPetId;

test('PHASE 1.1: Pet Owner registers a pet with feeding & medical notes', async () => {
  const res = await api('/pets', 'POST', {
    name: 'Simba',
    species: 'Dog',
    breed: 'Beagle',
    dob: '2023-06-15',
    weight: 12.5,
    sex: 'Male',
    feeding_instructions: '150g puppy kibble at 8am and 6pm',
    medication_instructions: 'None',
    behavioral_notes: 'Energetic, loves squeaky toys',
    allergies: 'None'
  }, ownerToken);

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.data.name, 'Simba');
  assert.strictEqual(res.data.data.breed, 'Beagle');
  createdPetId = res.data.data.id;
});

test('PHASE 1.2: Pet Owner views pet details', async () => {
  const res = await api(`/pets/${createdPetId}`, 'GET', null, ownerToken);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.data.name, 'Simba');
  assert.strictEqual(res.data.data.feeding_instructions, '150g puppy kibble at 8am and 6pm');
});

test('PHASE 1.3: Pet Owner data isolation - Second owner cannot access pet', async () => {
  const uniqueEmail = `rajesh.${Date.now()}@pbgms.in`;
  const regRes = await api('/auth/register', 'POST', {
    name: 'Rajesh Khanna',
    email: uniqueEmail,
    phone: '+91 9988112233',
    password: 'Password123!',
    notification_pref: 'email'
  });
  const secondToken = regRes.data.token;

  // Attempt to view Simba with Rajesh's token
  const viewRes = await api(`/pets/${createdPetId}`, 'GET', null, secondToken);
  assert.strictEqual(viewRes.status, 403, 'Should deny access to another owner pet');

  // Attempt to edit Simba with Rajesh's token
  const editRes = await api(`/pets/${createdPetId}`, 'PUT', { name: 'Hacked' }, secondToken);
  assert.strictEqual(editRes.status, 403, 'Should deny editing another owner pet');

  // Attempt to delete Simba with Rajesh's token
  const delRes = await api(`/pets/${createdPetId}`, 'DELETE', null, secondToken);
  assert.strictEqual(delRes.status, 403, 'Should deny deleting another owner pet');
});

test('PHASE 1.4: Add vaccination record to pet & check expiration validation', async () => {
  const vacRes = await api(`/pets/${createdPetId}/vaccinations`, 'POST', {
    vaccine_name: 'Rabies + DHPP Annual',
    date_administered: '2026-05-10',
    expiration_date: '2027-05-10'
  }, ownerToken);

  assert.strictEqual(vacRes.status, 201);
  assert.strictEqual(vacRes.data.success, true);

  // Query vaccinations endpoint
  const getVac = await api(`/pets/${createdPetId}/vaccinations`, 'GET', null, ownerToken);
  assert.strictEqual(getVac.status, 200);
  assert.strictEqual(getVac.data.has_active_vaccine, true);
  assert.strictEqual(getVac.data.data.length, 1);
});

// ─────────────────────────────────────────────────────────────
// PHASE 2: BOARDING BOOKINGS & SEQUENCE DIAGRAM FLOW
// ─────────────────────────────────────────────────────────────

let boardingBookingId;
let boardingBookingNumber;

test('PHASE 2.1: Boarding booking sequence with valid pet & room', async () => {
  // Check availability
  const availRes = await api('/bookings/check-availability?start_date=2026-11-10&end_date=2026-11-14');
  assert.strictEqual(availRes.status, 200);
  assert.ok(availRes.data.data.length > 0);
  const roomId = availRes.data.data[0].id;

  // Book boarding (4 nights)
  const bookRes = await api('/bookings/boarding', 'POST', {
    pet_id: createdPetId,
    room_id: roomId,
    start_date: '2026-11-10',
    end_date: '2026-11-14',
    special_instructions: 'Handle with care',
    addons: [{ name: 'Daily Video Update', price: 300 }]
  }, ownerToken);

  assert.strictEqual(bookRes.status, 201);
  assert.strictEqual(bookRes.data.success, true);
  assert.strictEqual(bookRes.data.data.nights, 4);
  assert.ok(bookRes.data.data.booking_number.startsWith('BRD-'));
  assert.ok(bookRes.data.data.deposit_paid > 0);

  boardingBookingId = bookRes.data.data.booking_id;
  boardingBookingNumber = bookRes.data.data.booking_number;

  // Verify in SQLite database
  const dbBooking = await get('SELECT * FROM bookings WHERE id = ?', [boardingBookingId]);
  assert.ok(dbBooking);
  assert.strictEqual(dbBooking.status, 'Confirmed');
  assert.strictEqual(dbBooking.room_id, roomId);
});

test('PHASE 2.2: Overlapping room reservation prevention (concurrency protection)', async () => {
  // Fetch room of the previous booking
  const dbBooking = await get('SELECT room_id FROM bookings WHERE id = ?', [boardingBookingId]);

  // Attempt to book the exact same room for overlapping dates
  const clashRes = await api('/bookings/boarding', 'POST', {
    pet_id: createdPetId,
    room_id: dbBooking.room_id,
    start_date: '2026-11-11',
    end_date: '2026-11-15'
  }, ownerToken);

  assert.strictEqual(clashRes.status, 409, 'Must prevent double-booking of same room');
  assert.strictEqual(clashRes.data.success, false);
});

test('PHASE 2.3: Sequence diagram payment failure handling - Booking must NOT be confirmed', async () => {
  // Fetch an available room
  const availRes = await api('/bookings/check-availability?start_date=2026-12-01&end_date=2026-12-05');
  const roomId = availRes.data.data[0].id;

  // Attempt booking with declined payment
  const failRes = await api('/bookings/boarding', 'POST', {
    pet_id: createdPetId,
    room_id: roomId,
    start_date: '2026-12-01',
    end_date: '2026-12-05',
    payment_declined: true
  }, ownerToken);

  assert.strictEqual(failRes.status, 402, 'Should return 402 Payment Required');
  assert.strictEqual(failRes.data.success, false);

  // Verify room was NOT reserved in database
  const checkClash = await get(
    `SELECT id FROM bookings WHERE room_id = ? AND start_date = '2026-12-01'`,
    [roomId]
  );
  assert.strictEqual(checkClash, undefined, 'No booking should be created when payment is declined');
});

test('PHASE 2.4: Vaccination eligibility rule (BR-1) rejection for unvaccinated pet', async () => {
  // Create an unvaccinated pet
  const petRes = await api('/pets', 'POST', {
    name: 'UnvaxxedPup',
    species: 'Dog',
    breed: 'Labrador'
  }, ownerToken);
  const unvaxxedId = petRes.data.data.id;

  const bookRes = await api('/bookings/boarding', 'POST', {
    pet_id: unvaxxedId,
    room_id: 1,
    start_date: '2026-12-10',
    end_date: '2026-12-14'
  }, ownerToken);

  assert.strictEqual(bookRes.status, 400);
  assert.ok(bookRes.data.message.includes('BR-1 Violation'));
});

// ─────────────────────────────────────────────────────────────
// PHASE 3: GROOMING BOOKINGS
// ─────────────────────────────────────────────────────────────

let groomingBookingId;

test('PHASE 3.1: Retrieve grooming services from SQLite DB', async () => {
  const res = await api('/services?category=Grooming');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert.ok(res.data.data.length >= 2);
  assert.ok(res.data.data.some(s => s.service_name.includes('Grooming')));
});

test('PHASE 3.2: Book grooming appointment with real service & slot', async () => {
  const svcRes = await api('/services?category=Grooming');
  const service = svcRes.data.data[0];

  const bookRes = await api('/bookings/grooming', 'POST', {
    pet_id: createdPetId,
    service_id: service.id,
    start_date: '2026-11-20',
    start_time: '10:30 AM',
    special_instructions: 'Warm water wash only'
  }, ownerToken);

  assert.strictEqual(bookRes.status, 201);
  assert.strictEqual(bookRes.data.success, true);
  assert.ok(bookRes.data.data.booking_number.startsWith('GRM-'));
  assert.strictEqual(bookRes.data.data.total_price, service.price);

  groomingBookingId = bookRes.data.data.booking_id;
});

test('PHASE 3.3: Overlapping grooming slot collision rejection', async () => {
  const svcRes = await api('/services?category=Grooming');
  const service = svcRes.data.data[0];

  const clashRes = await api('/bookings/grooming', 'POST', {
    pet_id: createdPetId,
    service_id: service.id,
    start_date: '2026-11-20',
    start_time: '10:30 AM'
  }, ownerToken);

  assert.strictEqual(clashRes.status, 409);
  assert.strictEqual(clashRes.data.success, false);
});

// ─────────────────────────────────────────────────────────────
// PHASE 4: BUSINESS RULES & CANCELLATIONS (BR-4)
// ─────────────────────────────────────────────────────────────

test('PHASE 4.1: Cancellation policy (BR-4) full refund when cancelled >= 48 hours notice', async () => {
  // Grooming booking is on 2026-11-20 (weeks in advance)
  const cancelRes = await api(`/bookings/${groomingBookingId}/cancel`, 'POST', {}, ownerToken);
  assert.strictEqual(cancelRes.status, 200);
  assert.strictEqual(cancelRes.data.success, true);
  assert.strictEqual(cancelRes.data.cancellation_fee, 0);
  assert.ok(cancelRes.data.refund_issued > 0);

  const dbBooking = await get('SELECT status FROM bookings WHERE id = ?', [groomingBookingId]);
  assert.strictEqual(dbBooking.status, 'Cancelled');
});

// ─────────────────────────────────────────────────────────────
// PHASE 5: STAFF WORKFLOWS & RBAC
// ─────────────────────────────────────────────────────────────

test('PHASE 5.1: Front Desk check-in for confirmed boarding booking', async () => {
  const res = await api(`/bookings/${boardingBookingId}/check-in`, 'POST', {}, frontDeskToken);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);

  const dbBooking = await get('SELECT status, actual_check_in FROM bookings WHERE id = ?', [boardingBookingId]);
  assert.strictEqual(dbBooking.status, 'Checked-in');
  assert.ok(dbBooking.actual_check_in);
});

test('PHASE 5.2: Boarding attendant logs daily care activity', async () => {
  const res = await api(`/bookings/${boardingBookingId}/care-activity`, 'POST', {
    activity_type: 'Feeding',
    notes: 'Ate all 250g of Royal Canin with enthusiasm. Water refreshed.'
  }, attendantToken);

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.success, true);

  const logs = await all('SELECT * FROM care_activities WHERE booking_id = ?', [boardingBookingId]);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].activity_type, 'Feeding');
});

test('PHASE 5.3: Front Desk checkout with late fee settlement', async () => {
  const res = await api(`/bookings/${boardingBookingId}/check-out`, 'POST', {
    payment_method: 'UPI',
    late_fee: 350 // BR-8 late pickup fee
  }, frontDeskToken);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);

  const dbBooking = await get('SELECT status, actual_check_out, late_checkout_fee FROM bookings WHERE id = ?', [boardingBookingId]);
  assert.strictEqual(dbBooking.status, 'Completed');
  assert.strictEqual(dbBooking.late_checkout_fee, 350);
});

test('PHASE 5.4: Groomer updates service notes & status', async () => {
  // Create a quick grooming booking for testing groomer completion
  const regRes = await api('/bookings/grooming', 'POST', {
    pet_id: createdPetId,
    service_id: 1,
    start_date: '2026-11-25',
    start_time: '02:00 PM'
  }, ownerToken);
  const testGrmId = regRes.data.data.booking_id;

  // Groomer updates to In Service
  const inSvcRes = await api(`/bookings/${testGrmId}/grooming-status`, 'POST', {
    status: 'In Service',
    service_notes: 'Coat shampooed with organic chamomile'
  }, groomerToken);
  assert.strictEqual(inSvcRes.status, 200);

  // Groomer marks Completed
  const doneRes = await api(`/bookings/${testGrmId}/grooming-status`, 'POST', {
    status: 'Completed',
    service_notes: 'Styling complete, nails trimmed and coat conditioned'
  }, groomerToken);
  assert.strictEqual(doneRes.status, 200);

  const dbBooking = await get('SELECT status, service_notes FROM bookings WHERE id = ?', [testGrmId]);
  assert.strictEqual(dbBooking.status, 'Completed');
  assert.ok(dbBooking.service_notes.includes('nails trimmed'));
});

test('PHASE 5.5: Admin revenue report & CSV export', async () => {
  const revRes = await api('/reports/revenue', 'GET', null, adminToken);
  assert.strictEqual(revRes.status, 200);
  assert.strictEqual(revRes.data.currency, 'INR');
  assert.ok(revRes.data.data.total_revenue > 0);

  // CSV Export
  const csvRes = await api('/reports/export/revenue-csv', 'GET', null, adminToken);
  assert.strictEqual(csvRes.status, 200);
  assert.ok(csvRes.headers.get('content-type').includes('text/csv'));
  assert.ok(csvRes.data.includes('Payment ID,Transaction Reference'));
});

test('PHASE 5.6: System Admin platform configuration read & update', async () => {
  // Read config
  const cfgRes = await api('/reports/config', 'GET', null, adminToken);
  assert.strictEqual(cfgRes.status, 200);
  assert.ok(cfgRes.data.data.some(c => c.key === 'deposit_percentage'));

  // Update late fee config
  const updateRes = await api('/reports/config', 'PUT', {
    key: 'late_checkout_hourly_fee',
    value: '400'
  }, adminToken);
  assert.strictEqual(updateRes.status, 200);
  assert.strictEqual(updateRes.data.data.value, '400');
});

// ─────────────────────────────────────────────────────────────
// PHASE 6: NOTIFICATIONS & DELIVERY STATUS
// ─────────────────────────────────────────────────────────────

test('PHASE 6.1: Notifications recorded with accurate delivery status', async () => {
  const notesRes = await api('/reports/notifications', 'GET', null, ownerToken);
  assert.strictEqual(notesRes.status, 200);
  assert.ok(notesRes.data.data.length > 0);

  const latestNote = notesRes.data.data[0];
  assert.ok(latestNote.title);
  assert.ok(latestNote.sent_status);
  // Transparently identifies lack of external SMS/SMTP provider in demo environment
  assert.ok(['LOGGED_NO_CREDENTIALS', 'QUEUED_NO_PROVIDER', 'DELIVERED', 'SENT'].includes(latestNote.sent_status));
});

// ─────────────────────────────────────────────────────────────
// PHASE 8: SECURITY, RBAC & OWNER ISOLATION
// ─────────────────────────────────────────────────────────────

test('PHASE 8.1: Unauthorized role access denial (RBAC)', async () => {
  // Pet Owner trying to access Admin Revenue Report
  const unauthRev = await api('/reports/revenue', 'GET', null, ownerToken);
  assert.strictEqual(unauthRev.status, 403);

  // Attendant trying to access Revenue CSV Export
  const unauthCsv = await api('/reports/export/revenue-csv', 'GET', null, attendantToken);
  assert.strictEqual(unauthCsv.status, 403);
});

test('PHASE 8.2: Unauthenticated request rejection', async () => {
  const unauthRes = await api('/pets');
  assert.strictEqual(unauthRes.status, 401);
});
