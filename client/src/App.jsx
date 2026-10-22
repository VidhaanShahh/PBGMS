import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import RouteMetaController from './components/RouteMetaController';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import MyPets from './pages/MyPets';
import BookBoarding from './pages/BookBoarding';
import BookGrooming from './pages/BookGrooming';
import MyBookings from './pages/MyBookings';
import StaffDashboard from './pages/StaffDashboard';
import FrontDeskPortal from './pages/FrontDeskPortal';
import GroomerPortal from './pages/GroomerPortal';
import Payment from './pages/Payment';

// Legacy routes preserved for backwards compatibility
import AdminServices from './pages/AdminServices';
import ServiceForm from './pages/ServiceForm';
import AdminAppointments from './pages/AdminAppointments';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RouteMetaController />
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--nb-bg)' }}>
          <Navbar />
          <main style={{ flex: 1 }}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/admin/login" element={<Login />} />

              {/* Pet Owner Core Workflows (SRS 3.1, 3.2, 3.3, 3.4) */}
              <Route
                path="/my-pets"
                element={
                  <ProtectedRoute>
                    <MyPets />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/boarding/book"
                element={
                  <ProtectedRoute>
                    <BookBoarding />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/grooming/book"
                element={
                  <ProtectedRoute>
                    <BookGrooming />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-bookings"
                element={
                  <ProtectedRoute>
                    <MyBookings />
                  </ProtectedRoute>
                }
              />

              {/* Payment Checkout & Receipt Engine */}
              <Route
                path="/payment/:bookingId"
                element={
                  <ProtectedRoute>
                    <Payment />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/confirmation/:bookingId"
                element={
                  <ProtectedRoute>
                    <Payment />
                  </ProtectedRoute>
                }
              />

              {/* Dedicated Front Desk Portal */}
              <Route
                path="/front-desk"
                element={
                  <ProtectedRoute allowedRoles={['FRONT_DESK', 'ADMIN', 'SYSTEM_ADMIN']}>
                    <FrontDeskPortal />
                  </ProtectedRoute>
                }
              />

              {/* Dedicated Groomer Studio Portal */}
              <Route
                path="/groomer"
                element={
                  <ProtectedRoute allowedRoles={['GROOMER', 'ADMIN', 'SYSTEM_ADMIN']}>
                    <GroomerPortal />
                  </ProtectedRoute>
                }
              />

              {/* Boarding Attendant & Operational Dashboard */}
              <Route
                path="/staff/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['BOARDING_ATTENDANT', 'FRONT_DESK', 'GROOMER', 'ADMIN', 'SYSTEM_ADMIN']}>
                    <StaffDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'SYSTEM_ADMIN']}>
                    <StaffDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/services"
                element={
                  <ProtectedRoute>
                    <AdminServices />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/services/new"
                element={
                  <ProtectedRoute>
                    <ServiceForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/services/edit/:id"
                element={
                  <ProtectedRoute>
                    <ServiceForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/appointments"
                element={
                  <ProtectedRoute>
                    <AdminAppointments />
                  </ProtectedRoute>
                }
              />

              {/* 404 Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
