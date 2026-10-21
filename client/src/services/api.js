const API_BASE = '/api';

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('pbgms_token') || localStorage.getItem('pcs_admin_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
  } catch (netErr) {
    const error = new Error(`Cannot connect to PBGMS backend server (${netErr.message || 'Network failure'}).`);
    error.status = 0;
    throw error;
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => '');
    data = { success: response.ok, message: text || `HTTP ${response.status} ${response.statusText}` };
  }

  if (!response.ok) {
    const errorMsg = (data && data.message) ? data.message : `Server error occurred (HTTP ${response.status} ${response.statusText})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ── Authentication ──
export const registerUser = (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) });
export const loginUser = (emailOrUsername, password) => request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: emailOrUsername, username: emailOrUsername, password })
});
export const loginAdmin = (username, password) => loginUser(username, password);
export const getMe = () => request('/auth/me');
export const updateProfile = (profileData) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(profileData) });

// ── Pets & Vaccinations ──
export const getMyPets = (all = false) => request(`/pets${all ? '?all=true' : ''}`);
export const getPetById = (id) => request(`/pets/${id}`);
export const addPet = (petData) => request('/pets', { method: 'POST', body: JSON.stringify(petData) });
export const updatePet = (id, petData) => request(`/pets/${id}`, { method: 'PUT', body: JSON.stringify(petData) });
export const deletePet = (id) => request(`/pets/${id}`, { method: 'DELETE' });
export const addVaccination = (petId, vacData) => request(`/pets/${petId}/vaccinations`, { method: 'POST', body: JSON.stringify(vacData) });

// ── Services & Rooms ──
export const getServices = (params = {}) => {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.category) query.set('category', params.category);
  if (params.pet_type) query.set('pet_type', params.pet_type);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return request(`/services${qs}`);
};
export const getServiceById = (id) => request(`/services/${id}`);
export const createService = (payload) => request('/services', { method: 'POST', body: JSON.stringify(payload) });
export const updateService = (id, payload) => request(`/services/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteService = (id) => request(`/services/${id}`, { method: 'DELETE' });

export const getRooms = () => request('/bookings/rooms');
export const checkBoardingAvailability = (params) => {
  const query = new URLSearchParams(params).toString();
  return request(`/bookings/check-availability?${query}`);
};
export const getGroomingSlots = (date, serviceId) => request(`/bookings/grooming-slots?date=${encodeURIComponent(date)}${serviceId ? `&service_id=${serviceId}` : ''}`);

// ── Bookings & Appointments ──
export const bookBoarding = (payload) => request('/bookings/boarding', { method: 'POST', body: JSON.stringify(payload) });
export const bookGrooming = (payload) => request('/bookings/grooming', { method: 'POST', body: JSON.stringify(payload) });
export const getMyBookings = (type) => request(`/bookings/my-bookings${type ? `?type=${type}` : ''}`);
export const getBookingById = (id) => request(`/bookings/${id}`);
export const cancelBooking = (id) => request(`/bookings/${id}/cancel`, { method: 'POST' });

// ── Staff & Operations ──
export const processCheckIn = (id, payload = {}) => request(`/bookings/${id}/check-in`, { method: 'POST', body: JSON.stringify(payload) });
export const processCheckOut = (id, payload = {}) => request(`/bookings/${id}/check-out`, { method: 'POST', body: JSON.stringify(payload) });
export const updateGroomingStatus = (id, status, notes = '') => request(`/bookings/${id}/grooming-status`, {
  method: 'POST',
  body: JSON.stringify({ status, service_notes: notes })
});
export const addCareActivity = (id, payload) => request(`/bookings/${id}/care-activity`, { method: 'POST', body: JSON.stringify(payload) });
export const getCareLogs = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/care-logs${query ? `?${query}` : ''}`);
};
export const getPetCareLogs = (petId) => request(`/pets/${petId}/care-logs`);
export const getBookingCareLogs = (bookingId) => request(`/bookings/${bookingId}/care-logs`);
export const createCareLog = (payload) => request('/care-logs', { method: 'POST', body: JSON.stringify(payload) });

// ── Reports & Analytics ──
export const getOccupancyReport = () => request('/reports/occupancy');
export const getRevenueReport = () => request('/reports/revenue');
export const getDashboardStats = () => request('/reports/stats');
export const getNotifications = () => request('/reports/notifications');
export const exportRevenueCSV = async () => {
  const token = localStorage.getItem('pbgms_token') || localStorage.getItem('pcs_admin_token');
  const res = await fetch('/api/reports/export/revenue-csv', {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error('Failed to export revenue CSV');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pbgms_revenue_report.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
export const exportBookingsCSV = async () => {
  const token = localStorage.getItem('pbgms_token') || localStorage.getItem('pcs_admin_token');
  const res = await fetch('/api/reports/export/bookings-csv', {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error('Failed to export bookings CSV');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pbgms_bookings_report.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

// Legacy compatibility
export const getAppointments = (status = 'all') => getMyBookings();
export const getAppointmentById = (id) => getBookingById(id);
export const updateAppointmentStatus = (id, status) => request(`/bookings/${id}/grooming-status`, {
  method: 'POST',
  body: JSON.stringify({ status })
});
export const processPayment = (payload) => request('/payments/process', { method: 'POST', body: JSON.stringify(payload) });
