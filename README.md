# 🐾 Pet Boarding & Grooming Management System (PBGMS)

A full-stack, enterprise-grade pet management web application built with **React (Vite)**, **Express.js**, and persistent **SQLite**, implementing the complete **SRS Release 1.0** specification, class diagram, and sequence diagrams.

---

## 🚀 Key Architectural Highlights

- **Frontend**: React 19, Vite, React Router v7, Lucide Icons, and a bold **Neobrutalist design system** (Outfit & Space Grotesk typography, 4px solid borders, vibrant color blocking, zero generic templates).
- **Backend**: Node.js / Express REST API with parameterized queries, input validation, JWT authentication, and bcryptjs salted password hashing.
- **Relational Persistence**: Pure SQLite database engine (`server/database/pbgms.sqlite`) with foreign keys, cascade rules, and automated schema migrations.
- **Test Database Isolation**: Automated test suites operate against an isolated database (`pbgms_test.sqlite`) so development and production data are preserved.
- **Six Application Roles (RBAC)**:
  1. `PET_OWNER`: Self-service registration, pet profile management, boarding & grooming bookings, booking history.
  2. `FRONT_DESK`: Arrivals & departures monitoring, check-in, check-out settlement, and late fee processing.
  3. `GROOMER`: Assigned grooming appointments, service progress updates ('In Service' / 'Completed'), and clinical grooming notes.
  4. `BOARDING_ATTENDANT`: Boarding kennel assignments, daily care logs (feeding, medication, exercise).
  5. `ADMIN`: Full operational oversight, service catalog management, occupancy metrics, revenue analytics, and CSV exports.
  6. `SYSTEM_ADMIN`: Platform configuration (deposit percentage, cancellation window, hourly late fees).
- **Business Rules Enforcement**:
  - **BR-1**: Mandatory active core vaccination verification for boarding stays.
  - **BR-2**: Boarding stays restricted to within 12 months in advance.
  - **BR-4**: 48-hour cancellation policy (100% refund if $\ge 48$ hours; cancellation fee equal to 1 night stay or grooming price if $< 48$ hours).
  - **BR-5**: Immutable price snapshots stored on booking creation.
  - **BR-6**: Configurable online deposit calculation (default 20%).
  - **BR-8**: Late pickup hourly fee calculation.
  - **Account Lockout**: 15-minute lockout enforced after 5 consecutive failed login attempts.
- **Currency**: Transparently priced and calculated in Indian Rupees (₹ / INR).

---

## 📁 Project Structure

```text
Pet-Care-System-main/
│
├── client/                     # React Frontend (Vite)
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── assets/             # High-res pet images (hero-dog, dog-grooming, pet-boarding)
│   │   ├── components/         # Navbar, Footer, ProtectedRoute
│   │   ├── context/            # AuthContext (JWT session state & role tracking)
│   │   ├── pages/              # Home, Register, Login, MyPets, BookBoarding, BookGrooming, MyBookings, StaffDashboard
│   │   ├── services/           # api.js client (Fetch API abstraction & CSV downloads)
│   │   ├── utils/              # formatters.js (formatINR, formatDateIN)
│   │   ├── App.jsx             # React Router route registry
│   │   └── index.css           # Neobrutalist design tokens & CSS utilities
│   ├── package.json
│   └── vite.config.js          # Port 5173 + dev proxy for /api -> http://localhost:5000
│
├── server/                     # Express REST API
│   ├── database/               # SQLite persistent databases (pbgms.sqlite & pbgms_test.sqlite)
│   ├── uploads/                # Persistent pet photo uploads
│   ├── src/
│   │   ├── config/             # sqliteDb.js (relational SQLite schema & seed loader)
│   │   ├── controllers/        # auth, pet, booking, service, reports, payment
│   │   ├── middleware/         # JWT auth middleware, role guards, input validation
│   │   ├── routes/             # authRoutes, petRoutes, bookingRoutes, serviceRoutes, reportsRoutes
│   │   ├── services/           # notificationService.js (delivery tracking & status logging)
│   │   ├── app.js              # Express app configuration & static upload handler
│   │   └── server.js           # Server entry point on port 5000
│   ├── test/                   # Comprehensive automated test suite
│   ├── package.json
│   └── .env
│
├── package.json                # Root orchestration with concurrently
└── README.md
```

---

## ⚡ Quick Start Guide (Windows PowerShell)

### 1. Install Dependencies
```powershell
npm run install:all
```

---

### 2. Run the Full-Stack Application
To start both the Express backend (`http://localhost:5000`) and Vite frontend (`http://localhost:5173`) simultaneously:
```powershell
npm run dev
```

Open your browser at:
👉 **`http://localhost:5173/`**

---

## 👥 Seed Accounts (Roles)

| Role | Email | Initial Password | Permitted Console Access |
|---|---|---|---|
| `ADMIN` | `admin@pbgms.in` | `admin123` | Full Administrative Hub, Service Management, Revenue, CSV Exports |
| `FRONT_DESK` | `frontdesk@pbgms.in` | `admin123` | Front Desk Console, Check-in, Check-out Settlement, Bookings CSV |
| `GROOMER` | `groomer@pbgms.in` | `admin123` | Groomer Portal, Assigned Appointments, Status Updates, Grooming Notes |
| `BOARDING_ATTENDANT`| `attendant@pbgms.in` | `admin123` | Kennel Room Assignments, Daily Care Activity Logs (Feeding, Walking) |
| `PET_OWNER` | `owner@pbgms.in` | `admin123` | Pet Profiles, Boarding/Grooming Booking Engines, Booking History |

*Public self-registration via `/register` automatically assigns the secure `PET_OWNER` role.*

---

## 🧪 Running Automated Tests

Run all 33 automated tests on the isolated test database:
```powershell
npm run test
```

---

## 📦 Building Production Frontend

Generate the optimized production bundle:
```powershell
npm run build
```
Bundle outputs to `client/dist/`.
