process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_NAME = 'pbgms_test.sqlite';

const test = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');
const http = require('http');
const { initPromise } = require('../src/config/sqliteDb');

let server;
let baseUrl;

test.before(async () => {
  await initPromise;
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('Pet Behavior Editing & Shared Care Log Isolation', async () => {
  // 1. Login as owner (user #5, owner@pbgms.in)
  const ownerLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@pbgms.in', password: 'admin123' })
  });
  assert.strictEqual(ownerLoginRes.status, 200);
  const ownerData = await ownerLoginRes.json();
  const ownerToken = ownerData.token;

  // 2. Login as frontdesk
  const fdLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'frontdesk@pbgms.in', password: 'admin123' })
  });
  assert.strictEqual(fdLoginRes.status, 200);
  const fdData = await fdLoginRes.json();
  const fdToken = fdData.token;

  // 3. Login as admin
  const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@pbgms.in', password: 'admin123' })
  });
  assert.strictEqual(adminLoginRes.status, 200);
  const adminData = await adminLoginRes.json();
  const adminToken = adminData.token;

  // 4. Register a second owner to test isolation
  const secondOwnerEmail = `owner2_${Date.now()}@pbgms.in`;
  const owner2RegRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Second Owner',
      email: secondOwnerEmail,
      phone: '9888877777',
      password: 'Password@123'
    })
  });
  assert.strictEqual(owner2RegRes.status, 201);
  const owner2Data = await owner2RegRes.json();
  const owner2Token = owner2Data.token;

  // --- TASK 3: PET BEHAVIOR EDITING ---
  // Owner's pet #1 (Simba)
  const simbaGetRes = await fetch(`${baseUrl}/api/pets/1`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  assert.strictEqual(simbaGetRes.status, 200);
  const simba = await simbaGetRes.json();
  const originalBreed = simba.data.breed;
  const petName = simba.data.name;

  const updatedNotes = `Friendly and energetic, loves gentle head scratches - Updated ${Date.now()}`;
  const updateRes = await fetch(`${baseUrl}/api/pets/1`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      behavioral_notes: updatedNotes,
      feeding_instructions: '2 scoops dry kibble in morning'
    })
  });
  assert.strictEqual(updateRes.status, 200);
  const updateData = await updateRes.json();
  assert.strictEqual(updateData.pet.behavioral_notes, updatedNotes);
  assert.strictEqual(updateData.pet.breed, originalBreed); // existing details not wiped

  // Verify persistence on re-query
  const verifySimbaRes = await fetch(`${baseUrl}/api/pets/1`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  assert.strictEqual(verifySimbaRes.status, 200);
  const verifySimba = await verifySimbaRes.json();
  assert.strictEqual(verifySimba.data.behavioral_notes, updatedNotes);

  // Verify second owner cannot update owner 1's pet (403 forbidden)
  const unauthorizedUpdateRes = await fetch(`${baseUrl}/api/pets/1`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${owner2Token}`
    },
    body: JSON.stringify({ behavioral_notes: 'Malicious modification' })
  });
  assert.strictEqual(unauthorizedUpdateRes.status, 403);

  // --- TASK 4 & 5: SHARED CARE LOGS & AUTHORIZATION ---
  // Create an owner-visible care log via Front Desk
  const publicLogRes = await fetch(`${baseUrl}/api/care-logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${fdToken}`
    },
    body: JSON.stringify({
      pet_id: 1,
      booking_id: 1,
      activity_type: 'FEEDING',
      notes: 'Simba finished morning meal and took 500ml water.',
      is_owner_visible: true
    })
  });
  assert.strictEqual(publicLogRes.status, 201);
  const publicLogData = await publicLogRes.json();
  assert.strictEqual(publicLogData.data.pet_name, petName);
  assert.strictEqual(publicLogData.data.is_owner_visible, 1);

  // Create an internal staff-only care log via Front Desk
  const internalLogRes = await fetch(`${baseUrl}/api/care-logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${fdToken}`
    },
    body: JSON.stringify({
      pet_id: 1,
      booking_id: 1,
      activity_type: 'OBSERVATION',
      notes: 'Internal staff observation: Barked at vacuum cleaner.',
      is_owner_visible: false
    })
  });
  assert.strictEqual(internalLogRes.status, 201);

  // Admin query: Must see both logs
  const adminLogsRes = await fetch(`${baseUrl}/api/care-logs`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(adminLogsRes.status, 200);
  const adminLogs = await adminLogsRes.json();
  const adminNotes = adminLogs.data.map(l => l.notes);
  assert.ok(adminNotes.includes('Simba finished morning meal and took 500ml water.'));
  assert.ok(adminNotes.includes('Internal staff observation: Barked at vacuum cleaner.'));

  // Front Desk query: Must see logs
  const fdLogsRes = await fetch(`${baseUrl}/api/care-logs`, {
    headers: { 'Authorization': `Bearer ${fdToken}` }
  });
  assert.strictEqual(fdLogsRes.status, 200);
  const fdLogs = await fdLogsRes.json();
  assert.ok(fdLogs.data.length > 0);

  // Owner 1 query: Must see owner-visible log, but NOT internal staff-only log!
  const ownerLogsRes = await fetch(`${baseUrl}/api/care-logs`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  assert.strictEqual(ownerLogsRes.status, 200);
  const ownerLogs = await ownerLogsRes.json();
  const ownerLogNotes = ownerLogs.data.map(l => l.notes);
  assert.ok(ownerLogNotes.includes('Simba finished morning meal and took 500ml water.'));
  assert.ok(!ownerLogNotes.includes('Internal staff observation: Barked at vacuum cleaner.'));

  // Owner 1 pet-specific query: /api/pets/1/care-logs
  const petLogsRes = await fetch(`${baseUrl}/api/pets/1/care-logs`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  assert.strictEqual(petLogsRes.status, 200);
  const petLogs = await petLogsRes.json();
  const petLogNotes = petLogs.data.map(l => l.notes);
  assert.ok(petLogNotes.includes('Simba finished morning meal and took 500ml water.'));
  assert.ok(!petLogNotes.includes('Internal staff observation: Barked at vacuum cleaner.'));

  // Owner 2 query: Cannot see Owner 1's pet care logs
  const owner2LogsRes = await fetch(`${baseUrl}/api/care-logs`, {
    headers: { 'Authorization': `Bearer ${owner2Token}` }
  });
  assert.strictEqual(owner2LogsRes.status, 200);
  const owner2Logs = await owner2LogsRes.json();
  assert.strictEqual(owner2Logs.data.length, 0); // No pets registered for owner 2 yet

  const owner2Pet1LogsRes = await fetch(`${baseUrl}/api/pets/1/care-logs`, {
    headers: { 'Authorization': `Bearer ${owner2Token}` }
  });
  assert.strictEqual(owner2Pet1LogsRes.status, 403); // Access denied

  // Unauthenticated request rejection
  const unauthCareRes = await fetch(`${baseUrl}/api/care-logs`);
  assert.strictEqual(unauthCareRes.status, 401);
});
