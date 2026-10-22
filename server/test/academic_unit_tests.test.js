process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert');

const {
  calculateDeposit,
  calculateRemainingBalance
} = require('../src/services/paymentCalculationService');

const {
  validatePetInput
} = require('../src/services/petValidationService');

// ============================================================================
// MODULE 1: BOOKING AND PAYMENT CALCULATIONS
// ============================================================================

test('TC01: Verify the mandatory 20% deposit calculation', () => {
  const totalAmount = 5000; // INR
  const deposit = calculateDeposit(totalAmount, 20);
  assert.strictEqual(deposit, 1000, '20% deposit of 5000 INR must equal 1000 INR');
});

test('TC02: Verify deposit calculation for a zero-value booking', () => {
  const totalAmount = 0;
  const deposit = calculateDeposit(totalAmount, 20);
  assert.strictEqual(deposit, 0, 'Deposit for a 0 INR booking must equal 0 INR');
});

test('TC03: Verify outstanding balance after a partial payment', () => {
  const totalAmount = 4800; // 4 nights @ 1200 INR
  const partialPaid = 960;  // 20% deposit paid
  const remaining = calculateRemainingBalance(totalAmount, partialPaid);
  assert.strictEqual(remaining, 3840, 'Remaining balance must be total (4800) - paid (960) = 3840');
});

test('TC04: Verify outstanding balance after the booking has been fully paid', () => {
  const totalAmount = 3500;
  const fullyPaid = 3500;
  const remaining = calculateRemainingBalance(totalAmount, fullyPaid);
  assert.strictEqual(remaining, 0, 'Outstanding balance for fully paid booking must be 0');
});

test('TC05: Verify rejection of a negative booking price', () => {
  assert.throws(
    () => {
      calculateDeposit(-1500, 20);
    },
    /Booking price cannot be negative/i,
    'Negative booking amounts must throw an invalid calculation error'
  );
});

// ============================================================================
// MODULE 2: PET MANAGEMENT AND VALIDATION
// ============================================================================

test('TC06: Verify valid pet creation or input validation', () => {
  const validPetData = {
    name: 'Rocky',
    species: 'Dog',
    breed: 'Golden Retriever',
    dob: '2022-04-10',
    weight: 28.5
  };

  const validation = validatePetInput(validPetData);
  assert.strictEqual(validation.isValid, true, 'Valid pet data must pass validation');
  assert.strictEqual(validation.errors.length, 0, 'Valid pet data should produce zero errors');
  assert.strictEqual(validation.sanitized.name, 'Rocky');
  assert.strictEqual(validation.sanitized.species, 'Dog');
  assert.strictEqual(validation.sanitized.breed, 'Golden Retriever');
});

test('TC07: Verify valid pet name handling', () => {
  const petWithWhitespace = {
    name: '   Bella Luna   ',
    species: 'Cat',
    breed: 'Persian'
  };

  const validation = validatePetInput(petWithWhitespace);
  assert.strictEqual(validation.isValid, true, 'Pet with whitespace-padded name should be valid');
  assert.strictEqual(validation.sanitized.name, 'Bella Luna', 'Pet name must be trimmed of leading and trailing whitespace');
});

test('TC08: Verify rejection of an empty pet name, if required by existing business rules', () => {
  const invalidPetData = {
    name: '   ',
    species: 'Dog',
    breed: 'Beagle'
  };

  const validation = validatePetInput(invalidPetData);
  assert.strictEqual(validation.isValid, false, 'Empty or blank pet name must fail validation');
  assert.ok(
    validation.errors.some(e => e.includes('Pet name is mandatory')),
    'Error list must indicate mandatory name requirement'
  );
});

test('TC09: Verify rejection of an unsupported species, if required by existing business rules', () => {
  const unsupportedPetData = {
    name: 'Rex',
    species: 'Dragon', // Unsupported exotic animal
    breed: 'Mythical'
  };

  const validation = validatePetInput(unsupportedPetData);
  assert.strictEqual(validation.isValid, false, 'Unsupported species must fail validation');
  assert.ok(
    validation.errors.some(e => e.includes('Species \'Dragon\' is unsupported')),
    'Validation error must cite unsupported species'
  );
});

test('TC10: Verify valid breed handling', () => {
  // Case A: Specified breed
  const petWithBreed = {
    name: 'Milo',
    species: 'Cat',
    breed: 'Siamese'
  };
  const valA = validatePetInput(petWithBreed);
  assert.strictEqual(valA.sanitized.breed, 'Siamese', 'Specified breed should be preserved');

  // Case B: Unspecified breed defaults to 'Mixed Breed'
  const petWithoutBreed = {
    name: 'Buddy',
    species: 'Dog',
    breed: ''
  };
  const valB = validatePetInput(petWithoutBreed);
  assert.strictEqual(valB.sanitized.breed, 'Mixed Breed', 'Empty breed must default to Mixed Breed');
});
