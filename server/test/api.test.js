process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_NAME = 'pbgms_test.sqlite';

const test = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');
const http = require('http');

let server;
let baseUrl;

test.before(async () => {
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('GET /api/health should return status ok', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'ok');
});

test('GET /api/services should return list of services', async () => {
  const res = await fetch(`${baseUrl}/api/services`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.ok(Array.isArray(data.services));
  assert.ok(data.services.length >= 5);
});

test('GET /api/services/1 should return details for Premium Dog Grooming', async () => {
  const res = await fetch(`${baseUrl}/api/services/1`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.service.id, 1);
  assert.ok(data.service.service_name.includes('Grooming'));
});

test('POST /api/auth/login with invalid credentials should be rejected', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
  });
  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.strictEqual(data.success, false);
});

test('POST /api/auth/login with valid credentials should return token', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.ok(data.token);
  assert.strictEqual(data.admin.username, 'admin');
});

test('GET /api/dashboard/stats without token should be 401 Unauthorized', async () => {
  const res = await fetch(`${baseUrl}/api/dashboard/stats`);
  assert.strictEqual(res.status, 401);
});

test('POST /api/appointments should validate booking input and create appointment', async () => {
  const res = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: 1,
      customer_name: 'Test Customer',
      customer_email: 'test@example.com',
      customer_phone: '0711122334',
      pet_name: 'Max',
      breed: 'Beagle',
      age: '2 years',
      appointment_date: '2026-11-15'
    })
  });
  assert.strictEqual(res.status, 201);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.ok(data.appointment.id);
  assert.strictEqual(data.appointment.customer_name, 'Test Customer');
});
