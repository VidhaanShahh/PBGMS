const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const fs = require('fs');
const dbDir = path.resolve(__dirname, '../../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbFilename = process.env.SQLITE_DB_NAME || (process.env.NODE_ENV === 'test' ? 'pbgms_test.sqlite' : 'pbgms.sqlite');
const dbPath = process.env.SQLITE_DB_PATH || path.resolve(dbDir, dbFilename);
const db = new sqlite3.Database(dbPath);

// Helper function to run SQL queries as Promises
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDatabase() {
  await run(`PRAGMA foreign_keys = ON;`);

  // 1. Users Table (Role-based: PET_OWNER, FRONT_DESK, GROOMER, BOARDING_ATTENDANT, ADMIN, SYSTEM_ADMIN)
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'PET_OWNER',
      is_verified INTEGER NOT NULL DEFAULT 1,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until DATETIME NULL,
      notification_pref TEXT NOT NULL DEFAULT 'both',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Pets Table
  await run(`
    CREATE TABLE IF NOT EXISTS pets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      species TEXT NOT NULL,
      breed TEXT NOT NULL,
      dob DATE,
      weight REAL,
      sex TEXT,
      photo TEXT,
      feeding_instructions TEXT,
      medication_instructions TEXT,
      behavioral_notes TEXT,
      allergies TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 3. Vaccination Records Table
  await run(`
    CREATE TABLE IF NOT EXISTS vaccinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_id INTEGER NOT NULL,
      vaccine_name TEXT NOT NULL,
      date_administered DATE NOT NULL,
      expiration_date DATE NOT NULL,
      document_url TEXT,
      verified INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(pet_id) REFERENCES pets(id) ON DELETE CASCADE
    );
  `);

  // 4. Boarding Rooms Inventory
  await run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number TEXT NOT NULL UNIQUE,
      room_type TEXT NOT NULL, -- Standard, Deluxe, Suite
      capacity INTEGER NOT NULL DEFAULT 1,
      daily_rate REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, MAINTENANCE
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Grooming & Clinic Services
  await run(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_name TEXT NOT NULL,
      category TEXT NOT NULL, -- Grooming, Boarding, Veterinary
      target_pet_type TEXT NOT NULL, -- Dog, Cat, All
      description TEXT NOT NULL,
      price REAL NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Bookings (Boarding & Grooming consolidated lifecycle: Pending -> Confirmed -> Checked-in / In Service -> Completed, Cancelled)
  await run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_number TEXT NOT NULL UNIQUE,
      booking_type TEXT NOT NULL, -- BOARDING, GROOMING
      owner_id INTEGER NOT NULL,
      pet_id INTEGER NOT NULL,
      service_id INTEGER NULL,
      room_id INTEGER NULL,
      staff_id INTEGER NULL, -- assigned groomer or attendant
      start_date DATE NOT NULL,
      end_date DATE NULL,
      start_time TEXT NULL,
      end_time TEXT NULL,
      special_instructions TEXT,
      status TEXT NOT NULL DEFAULT 'Confirmed', -- Pending, Confirmed, Checked-in, In Service, Completed, Cancelled
      total_price REAL NOT NULL,
      deposit_amount REAL NOT NULL DEFAULT 0,
      late_checkout_fee REAL NOT NULL DEFAULT 0,
      actual_check_in DATETIME NULL,
      actual_check_out DATETIME NULL,
      checked_in_by INTEGER NULL,
      checked_out_by INTEGER NULL,
      service_notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(owner_id) REFERENCES users(id),
      FOREIGN KEY(pet_id) REFERENCES pets(id),
      FOREIGN KEY(service_id) REFERENCES services(id),
      FOREIGN KEY(room_id) REFERENCES rooms(id),
      FOREIGN KEY(staff_id) REFERENCES users(id)
    );
  `);

  // 7. Booking Addons
  await run(`
    CREATE TABLE IF NOT EXISTS booking_addons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      addon_name TEXT NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );
  `);

  // 8. Care Activities (Boarding & Grooming Shared Daily Log: feeding, medication, walk, play, health observations)
  await run(`
    CREATE TABLE IF NOT EXISTS care_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_id INTEGER NULL,
      booking_id INTEGER NULL,
      attendant_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL, -- Feeding, Medication, Walk, Groom, Health Observation, Note
      notes TEXT NOT NULL,
      is_owner_visible INTEGER NOT NULL DEFAULT 1,
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(pet_id) REFERENCES pets(id) ON DELETE CASCADE,
      FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
      FOREIGN KEY(attendant_id) REFERENCES users(id)
    );
  `);

  // 9. Payments Table
  await run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL, -- UPI, Credit Card, Debit Card, Cash, Net Banking
      payment_type TEXT NOT NULL DEFAULT 'Full Payment', -- Deposit, Full Payment, Remaining Balance
      payment_status TEXT NOT NULL DEFAULT 'Paid', -- Paid, Pending, Refunded, Failed
      transaction_reference TEXT NOT NULL,
      paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );
  `);

  // 10. Notifications Table
  await run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      channel TEXT NOT NULL, -- email, sms, both
      type TEXT NOT NULL, -- Confirmation, Reminder, StatusChange, Receipt
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      sent_status TEXT NOT NULL DEFAULT 'SENT',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 11. Business Configuration (SRS Deposit 20-100%, 48h cancel, late checkout fee)
  await run(`
    CREATE TABLE IF NOT EXISTS business_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      description TEXT
    );
  `);

  // 12. Grooming Sessions Table (Grooming Lifecycle, Checklist & Clinical Observations)
  await run(`
    CREATE TABLE IF NOT EXISTS grooming_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL UNIQUE,
      groomer_id INTEGER NOT NULL,
      session_status TEXT NOT NULL DEFAULT 'Scheduled',
      started_at DATETIME NULL,
      completed_at DATETIME NULL,
      checklist_bathing INTEGER NOT NULL DEFAULT 0,
      checklist_drying INTEGER NOT NULL DEFAULT 0,
      checklist_brushing INTEGER NOT NULL DEFAULT 0,
      checklist_nail_trimming INTEGER NOT NULL DEFAULT 0,
      checklist_ear_cleaning INTEGER NOT NULL DEFAULT 0,
      checklist_hair_trimming INTEGER NOT NULL DEFAULT 0,
      checklist_coat_inspection INTEGER NOT NULL DEFAULT 0,
      checklist_final_inspection INTEGER NOT NULL DEFAULT 0,
      coat_condition TEXT NULL,
      skin_condition TEXT NULL,
      behavior_notes TEXT NULL,
      incident_notes TEXT NULL,
      products_used TEXT NULL,
      recommendations TEXT NULL,
      handover_notes TEXT NULL,
      safety_alerts TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY(groomer_id) REFERENCES users(id)
    );
  `);

  // Safe migration for payments schema (Razorpay columns)
  try {
    const payCols = await all(`PRAGMA table_info(payments);`);
    const existingColNames = payCols.map(c => c.name);

    if (!existingColNames.includes('razorpay_order_id')) {
      await run(`ALTER TABLE payments ADD COLUMN razorpay_order_id TEXT;`);
    }
    if (!existingColNames.includes('razorpay_payment_id')) {
      await run(`ALTER TABLE payments ADD COLUMN razorpay_payment_id TEXT;`);
    }
    if (!existingColNames.includes('razorpay_signature')) {
      await run(`ALTER TABLE payments ADD COLUMN razorpay_signature TEXT;`);
    }
    if (!existingColNames.includes('razorpay_refund_id')) {
      await run(`ALTER TABLE payments ADD COLUMN razorpay_refund_id TEXT;`);
    }
    if (!existingColNames.includes('currency')) {
      await run(`ALTER TABLE payments ADD COLUMN currency TEXT DEFAULT 'INR';`);
    }
    if (!existingColNames.includes('failure_reason')) {
      await run(`ALTER TABLE payments ADD COLUMN failure_reason TEXT;`);
    }
    if (!existingColNames.includes('receipt')) {
      await run(`ALTER TABLE payments ADD COLUMN receipt TEXT;`);
    }
    if (!existingColNames.includes('refund_amount')) {
      await run(`ALTER TABLE payments ADD COLUMN refund_amount REAL DEFAULT 0;`);
    }
    if (!existingColNames.includes('refund_status')) {
      await run(`ALTER TABLE payments ADD COLUMN refund_status TEXT;`);
    }
  } catch (payMigErr) {
    console.warn('payments migration note:', payMigErr.message);
  }

  // Safe migration for bookings schema (handover & checkin columns)
  try {
    const bookCols = await all(`PRAGMA table_info(bookings);`);
    const bookColNames = bookCols.map(c => c.name);

    if (!bookColNames.includes('checkin_notes')) {
      await run(`ALTER TABLE bookings ADD COLUMN checkin_notes TEXT;`);
    }
    if (!bookColNames.includes('belongings')) {
      await run(`ALTER TABLE bookings ADD COLUMN belongings TEXT;`);
    }
    if (!bookColNames.includes('handover_notes')) {
      await run(`ALTER TABLE bookings ADD COLUMN handover_notes TEXT;`);
    }
  } catch (bookMigErr) {
    console.warn('bookings migration note:', bookMigErr.message);
  }

  // Safe migration for care_activities schema evolution
  try {
    const careCols = await all(`PRAGMA table_info(care_activities);`);
    const hasPetId = careCols.some(c => c.name === 'pet_id');
    const hasOwnerVisible = careCols.some(c => c.name === 'is_owner_visible');

    if (!hasPetId) {
      await run(`ALTER TABLE care_activities ADD COLUMN pet_id INTEGER REFERENCES pets(id);`);
    }

    if (!hasOwnerVisible) {
      await run(`ALTER TABLE care_activities ADD COLUMN is_owner_visible INTEGER NOT NULL DEFAULT 1;`);
    }

    await run(`
      UPDATE care_activities
      SET pet_id = (SELECT pet_id FROM bookings WHERE bookings.id = care_activities.booking_id)
      WHERE pet_id IS NULL AND booking_id IS NOT NULL;
    `);
  } catch (migErr) {
    console.warn('care_activities migration note:', migErr.message);
  }

  // Check and seed initial data
  const adminUser = await get(`SELECT * FROM users WHERE email = ?`, ['admin@pbgms.in']);
  if (!adminUser) {
    const pwHash = await bcrypt.hash('admin123', 10);
    // Seed SRS Roles:
    await run(
      `INSERT INTO users (name, email, phone, password, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)`,
      ['System Administrator', 'admin@pbgms.in', '+91 98765 43210', pwHash, 'ADMIN', 1]
    );
    await run(
      `INSERT INTO users (name, email, phone, password, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)`,
      ['Priya Sharma (Front Desk)', 'frontdesk@pbgms.in', '+91 98765 43211', pwHash, 'FRONT_DESK', 1]
    );
    await run(
      `INSERT INTO users (name, email, phone, password, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)`,
      ['Rahul Verma (Master Groomer)', 'groomer@pbgms.in', '+91 98765 43212', pwHash, 'GROOMER', 1]
    );
    await run(
      `INSERT INTO users (name, email, phone, password, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)`,
      ['Amit Kumar (Boarding Attendant)', 'attendant@pbgms.in', '+91 98765 43213', pwHash, 'BOARDING_ATTENDANT', 1]
    );
    await run(
      `INSERT INTO users (name, email, phone, password, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)`,
      ['Ananya Iyer (Pet Owner)', 'owner@pbgms.in', '+91 98765 43214', pwHash, 'PET_OWNER', 1]
    );

    // Seed Config
    await run(`INSERT OR IGNORE INTO business_config (key, value, description) VALUES ('deposit_percentage', '20', 'Mandatory online deposit percentage');`);
    await run(`INSERT OR IGNORE INTO business_config (key, value, description) VALUES ('cancellation_window_hours', '48', 'Full refund window before booking');`);
    await run(`INSERT OR IGNORE INTO business_config (key, value, description) VALUES ('late_checkout_hourly_fee', '350', 'Late pickup fee per hour in INR');`);
    await run(`INSERT OR IGNORE INTO business_config (key, value, description) VALUES ('facility_timezone', 'Asia/Kolkata', 'Facility standard timezone');`);
  }

  // Seed Rooms if empty
  const roomCount = await get(`SELECT COUNT(*) as count FROM rooms`);
  if (roomCount.count === 0) {
    const roomsData = [
      ['K-101', 'Standard Kennel', 1, 1200.00, 'AVAILABLE'],
      ['K-102', 'Standard Kennel', 1, 1200.00, 'AVAILABLE'],
      ['K-103', 'Standard Kennel', 1, 1200.00, 'AVAILABLE'],
      ['D-201', 'Deluxe Room', 2, 2200.00, 'AVAILABLE'],
      ['D-202', 'Deluxe Room', 2, 2200.00, 'AVAILABLE'],
      ['S-301', 'Royal Presidential Suite', 3, 3800.00, 'AVAILABLE'],
      ['S-302', 'Cat Condo Oasis', 2, 1800.00, 'AVAILABLE']
    ];
    for (const r of roomsData) {
      await run(`INSERT INTO rooms (room_number, room_type, capacity, daily_rate, status) VALUES (?, ?, ?, ?, ?)`, r);
    }
  }

  // Seed Services if empty
  const svcCount = await get(`SELECT COUNT(*) as count FROM services`);
  if (svcCount.count === 0) {
    const servicesData = [
      ['Royal Canine Full Grooming', 'Grooming', 'Dog', 'Organic honey bath, blow dry, hygienic sanitary trim, full breed styling, nail dremel, ear cleansing and dental breath refresh.', 2499.00, 90, 'dog-grooming.jpg'],
      ['Feline Zen Spa & Groom', 'Grooming', 'Cat', 'Stress-free waterless or warm herbal foam bath, thorough comb-out, nail clipping, eye and ear care tailored for cats.', 1999.00, 60, 'cat-grooming.jpg'],
      ['Luxury Boarding Overnight', 'Boarding', 'All', 'Climate-controlled private room with orthopedic bedding, 3 organic meals, 4 daily outdoor play sessions, and webcam access.', 1800.00, 1440, 'pet-boarding.jpg'],
      ['Comprehensive Veterinary Health Exam', 'Veterinary', 'All', 'Complete nose-to-tail wellness examination by Dr. Sen, vitals assessment, dental grading, and personalized diet plan.', 1499.00, 45, 'vet-checkup-dog.jpg'],
      ['Aromatherapy & De-shedding Therapy', 'Grooming', 'Dog', 'Specialized deep-coat treatment to reduce shedding by up to 80% using safe botanical formulas and blowout.', 1299.00, 60, 'dog-grooming.jpg']
    ];
    for (const s of servicesData) {
      await run(`INSERT INTO services (service_name, category, target_pet_type, description, price, duration_minutes, image) VALUES (?, ?, ?, ?, ?, ?, ?)`, s);
    }
  }

  // Seed Pet & Vaccination for sample Owner (Ananya Iyer id: 5)
  const petCount = await get(`SELECT COUNT(*) as count FROM pets`);
  if (petCount.count === 0) {
    const owner = await get(`SELECT id FROM users WHERE email = ?`, ['owner@pbgms.in']);
    if (owner) {
      const petRes = await run(
        `INSERT INTO pets (owner_id, name, species, breed, dob, weight, sex, feeding_instructions, medication_instructions, behavioral_notes, allergies)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [owner.id, 'Bruno', 'Dog', 'Golden Retriever', '2023-04-10', 28.5, 'Male', 'Royal Canin Maxi Adult, 250g twice daily at 8 AM and 7 PM', 'None currently', 'Friendly with all dogs and staff; loves belly rubs.', 'Allergic to chicken proteins. Feed lamb only.']
      );
      
      // Add active core vaccination (Rabies, DHPP)
      await run(
        `INSERT INTO vaccinations (pet_id, vaccine_name, date_administered, expiration_date, verified)
         VALUES (?, ?, ?, ?, ?)`,
        [petRes.lastID, 'Rabies + DHPP 7-in-1', '2026-01-15', '2027-01-15', 1]
      );

      // Add a second pet: Luna (Cat)
      const catRes = await run(
        `INSERT INTO pets (owner_id, name, species, breed, dob, weight, sex, feeding_instructions, medication_instructions, behavioral_notes, allergies)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [owner.id, 'Luna', 'Cat', 'Persian', '2024-02-14', 4.2, 'Female', 'Whiskas wet pouch morning, dry kibble evening', 'Eye drops once weekly', 'Gentle, shy around loud barking. Prefers quiet corners.', 'No known allergies']
      );

      await run(
        `INSERT INTO vaccinations (pet_id, vaccine_name, date_administered, expiration_date, verified)
         VALUES (?, ?, ?, ?, ?)`,
        [catRes.lastID, 'FVRCP Core Feline', '2026-03-01', '2027-03-01', 1]
      );
    }
  }

  console.log('✅ SQLite persistent relational database initialized with full PBGMS SRS schema & seed records.');
}

const initPromise = initDatabase().catch(console.error);

module.exports = { db, run, get, all, initPromise, initDatabase };
