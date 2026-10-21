const bcrypt = require('bcryptjs');

// Default initial admin (admin / admin123)
const defaultHashedPassword = bcrypt.hashSync('admin123', 10);

const initialAdmins = [
  {
    id: 1,
    username: 'admin',
    password: defaultHashedPassword,
    created_at: new Date().toISOString()
  }
];

const initialServices = [
  {
    id: 1,
    service_name: 'Premium Dog Grooming',
    category: 'Grooming',
    target_pet_type: 'Dog',
    description: 'A comprehensive grooming session for your dog including a relaxing bath with premium shampoo, blow-dry, coat trimming, nail clipping, ear cleaning, and a fresh bandana finish. Keeps your dog looking and feeling their best.',
    price: 3500.00,
    image: 'dog-grooming.jpg',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 2,
    service_name: 'Cat Grooming',
    category: 'Grooming',
    target_pet_type: 'Cat',
    description: 'A gentle and thorough grooming service tailored for cats, including a soothing bath, blow-dry, coat brushing and trimming, nail trimming, and ear cleaning. Our experienced groomers handle even shy cats with care.',
    price: 3000.00,
    image: 'cat-grooming.jpg',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 3,
    service_name: 'Veterinary Checkup for Dogs',
    category: 'Veterinary',
    target_pet_type: 'Dog',
    description: 'A complete health examination for your dog conducted by our licensed veterinarian. Includes physical assessment, vital signs check, vaccination review, dietary advice, and a written health report for your records.',
    price: 2500.00,
    image: 'vet-checkup-dog.jpg',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 4,
    service_name: 'Pet Boarding',
    category: 'Boarding',
    target_pet_type: 'Dog',
    description: 'Safe and comfortable overnight boarding for your dog while you are away. Includes a clean private kennel, 3 meals per day, fresh water, supervised play sessions, and daily health checks by our trained staff.',
    price: 4500.00,
    image: 'pet-boarding.jpg',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 5,
    service_name: 'Cat Veterinary Checkup',
    category: 'Veterinary',
    target_pet_type: 'Cat',
    description: 'A thorough health examination for your cat by our licensed veterinarian. Covers full physical assessment, dental check, parasite screening, vaccination status review, and personalised diet and care advice.',
    price: 2500.00,
    image: 'vet-checkup-cat.jpg',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const initialAppointments = [
  {
    id: 1,
    service_id: 1,
    customer_name: 'Kasun Silva',
    customer_email: 'kasun@example.com',
    customer_phone: '0712345678',
    pet_name: 'Buddy',
    breed: 'Golden Retriever',
    age: '3 years',
    appointment_date: '2026-10-25',
    booking_status: 'Confirmed',
    created_at: new Date().toISOString()
  }
];

const initialPayments = [
  {
    id: 1,
    appointment_id: 1,
    amount: 3500.00,
    payment_method: 'Credit Card',
    transaction_reference: 'TXN-98234-DEMO',
    payment_status: 'Paid',
    paid_at: new Date().toISOString()
  }
];

let state = {
  admins: [...initialAdmins],
  services: [...initialServices],
  appointments: [...initialAppointments],
  payments: [...initialPayments],
  nextServiceId: 6,
  nextAppointmentId: 2,
  nextPaymentId: 2
};

const store = {
  getAdmins: () => state.admins,
  findAdminByUsername: (username) => state.admins.find(a => a.username.toLowerCase() === username.toLowerCase()),
  
  getServices: (filters = {}) => {
    let result = [...state.services];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(s => s.service_name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    if (filters.category) {
      result = result.filter(s => s.category.toLowerCase() === filters.category.toLowerCase());
    }
    if (filters.pet_type) {
      result = result.filter(s => s.target_pet_type.toLowerCase() === filters.pet_type.toLowerCase());
    }
    return result;
  },
  
  getServiceById: (id) => state.services.find(s => Number(s.id) === Number(id)),
  
  createService: (data) => {
    const newService = {
      id: state.nextServiceId++,
      service_name: data.service_name,
      category: data.category,
      target_pet_type: data.target_pet_type,
      description: data.description,
      price: Number(data.price),
      image: data.image || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    state.services.unshift(newService);
    return newService;
  },
  
  updateService: (id, data) => {
    const idx = state.services.findIndex(s => Number(s.id) === Number(id));
    if (idx === -1) return null;
    state.services[idx] = {
      ...state.services[idx],
      service_name: data.service_name ?? state.services[idx].service_name,
      category: data.category ?? state.services[idx].category,
      target_pet_type: data.target_pet_type ?? state.services[idx].target_pet_type,
      description: data.description ?? state.services[idx].description,
      price: data.price !== undefined ? Number(data.price) : state.services[idx].price,
      image: data.image !== undefined ? data.image : state.services[idx].image,
      updated_at: new Date().toISOString()
    };
    return state.services[idx];
  },
  
  deleteService: (id) => {
    const idx = state.services.findIndex(s => Number(s.id) === Number(id));
    if (idx === -1) return false;
    // Check if service has appointments
    const hasAppointments = state.appointments.some(a => Number(a.service_id) === Number(id));
    if (hasAppointments) {
      throw new Error('Cannot delete service because it is linked to existing appointments.');
    }
    state.services.splice(idx, 1);
    return true;
  },
  
  getCategories: () => {
    const cats = new Set(state.services.map(s => s.category));
    return Array.from(cats).sort();
  },
  
  getPetTypes: () => {
    const types = new Set(state.services.map(s => s.target_pet_type));
    return Array.from(types).sort();
  },
  
  getAppointments: (status = 'all') => {
    let list = state.appointments.map(a => {
      const s = state.services.find(svc => Number(svc.id) === Number(a.service_id));
      const p = state.payments.find(pay => Number(pay.appointment_id) === Number(a.id));
      return {
        ...a,
        service_name: s ? s.service_name : 'Unknown Service',
        service_price: s ? s.price : 0,
        payment_status: p ? p.payment_status : 'Pending',
        payment_method: p ? p.payment_method : null,
        paid_amount: p ? p.amount : null,
        transaction_reference: p ? p.transaction_reference : null
      };
    });
    if (status && status !== 'all') {
      list = list.filter(a => a.booking_status.toLowerCase() === status.toLowerCase());
    }
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  
  getAppointmentById: (id) => {
    const a = state.appointments.find(item => Number(item.id) === Number(id));
    if (!a) return null;
    const s = state.services.find(svc => Number(svc.id) === Number(a.service_id));
    const p = state.payments.find(pay => Number(pay.appointment_id) === Number(a.id));
    return {
      ...a,
      booking_id: a.id,
      service_name: s ? s.service_name : 'Unknown Service',
      category: s ? s.category : '',
      target_pet_type: s ? s.target_pet_type : '',
      service_price: s ? s.price : 0,
      amount: p ? p.amount : (s ? s.price : 0),
      payment_method: p ? p.payment_method : null,
      payment_status: p ? p.payment_status : 'Pending',
      transaction_reference: p ? p.transaction_reference : null,
      paid_at: p ? p.paid_at : null
    };
  },
  
  createAppointment: (data) => {
    const newAppt = {
      id: state.nextAppointmentId++,
      service_id: Number(data.service_id),
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      customer_phone: data.customer_phone,
      pet_name: data.pet_name,
      breed: data.breed,
      age: data.age,
      appointment_date: data.appointment_date,
      booking_status: 'Pending',
      created_at: new Date().toISOString()
    };
    state.appointments.unshift(newAppt);
    return newAppt;
  },
  
  updateAppointmentStatus: (id, status) => {
    const appt = state.appointments.find(a => Number(a.id) === Number(id));
    if (!appt) return null;
    appt.booking_status = status;
    return appt;
  },
  
  createPayment: (data) => {
    // Check if payment already exists
    let p = state.payments.find(pay => Number(pay.appointment_id) === Number(data.appointment_id));
    if (p) {
      p.payment_status = 'Paid';
      p.payment_method = data.payment_method;
      p.amount = Number(data.amount);
      p.transaction_reference = data.transaction_reference || `TXN-${Math.floor(10000 + Math.random() * 90000)}`;
      p.paid_at = new Date().toISOString();
      return p;
    }
    const newPayment = {
      id: state.nextPaymentId++,
      appointment_id: Number(data.appointment_id),
      amount: Number(data.amount),
      payment_method: data.payment_method,
      transaction_reference: data.transaction_reference || `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
      payment_status: 'Paid',
      paid_at: new Date().toISOString()
    };
    state.payments.unshift(newPayment);
    return newPayment;
  },
  
  getStats: () => {
    return {
      totalServices: state.services.length,
      totalAppointments: state.appointments.length,
      paidBookings: state.payments.filter(p => p.payment_status === 'Paid').length,
      pendingPayments: state.appointments.length - state.payments.filter(p => p.payment_status === 'Paid').length
    };
  }
};

module.exports = store;
