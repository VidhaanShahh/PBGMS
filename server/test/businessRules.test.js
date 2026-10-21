const test = require('node:test');
const assert = require('node:assert');

// 1. Boarding night and price calculation (BR-5)
test('BR-5 Boarding nights calculation', () => {
  const checkIn = new Date('2026-11-01');
  const checkOut = new Date('2026-11-05');
  const nights = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  assert.strictEqual(nights, 4);

  const dailyRate = 1200; // INR
  const total = nights * dailyRate;
  assert.strictEqual(total, 4800);
});

// 2. Deposit calculation (BR-6: 20% default)
test('BR-6 Deposit policy calculation (20%)', () => {
  const grandTotal = 5000;
  const depositPct = 20;
  const depositAmount = (grandTotal * depositPct) / 100;
  assert.strictEqual(depositAmount, 1000);
  assert.strictEqual(grandTotal - depositAmount, 4000);
});

// 3. 48-Hour Cancellation policy (BR-4)
test('BR-4 Cancellation full refund if >= 48 hours notice', () => {
  const bookingStart = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours away
  const hoursNotice = (bookingStart - new Date()) / (1000 * 60 * 60);
  assert.ok(hoursNotice >= 48);

  const totalPaid = 1000;
  const refundAmount = hoursNotice >= 48 ? totalPaid : 0;
  assert.strictEqual(refundAmount, 1000);
});

test('BR-4 Cancellation fee applies if < 48 hours notice', () => {
  const bookingStart = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours away
  const hoursNotice = (bookingStart - new Date()) / (1000 * 60 * 60);
  assert.ok(hoursNotice < 48);

  const totalPaid = 2000;
  const dailyRateCancellationFee = 1200;
  const refundAmount = Math.max(0, totalPaid - dailyRateCancellationFee);
  assert.strictEqual(refundAmount, 800);
});

// 4. Vaccination eligibility validation (BR-1)
test('BR-1 Pet vaccination expiration validation', () => {
  const now = new Date('2026-10-18');
  const validVaccineDate = new Date('2027-01-15');
  const expiredVaccineDate = new Date('2025-05-01');

  assert.strictEqual(validVaccineDate >= now, true, 'Valid vaccine should pass check');
  assert.strictEqual(expiredVaccineDate >= now, false, 'Expired vaccine should fail check');
});
