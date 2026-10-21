const http = require('http');

function post(url, data, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d || '{}') }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d || '{}') }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('=== TEST D: AUTHENTICATION FLOW VERIFICATION ===');
  // 1. Valid Login
  const loginRes = await post('http://localhost:5000/api/auth/login', {
    email: 'aarav.patel@pbgms.in',
    password: 'SecurePassword123!'
  });
  console.log('[1] Login Status:', loginRes.status, '| Success:', loginRes.body.success, '| Role:', loginRes.body.user ? loginRes.body.user.role : null);
  const token = loginRes.body.token;

  // 2. Protected Pet Owner endpoint with token
  const petsRes = await get('http://localhost:5000/api/pets', token);
  console.log('[2] Protected GET /api/pets (With Token) Status:', petsRes.status, '| Success:', petsRes.body.success);

  // 3. Unauthenticated request rejected
  const unauthRes = await get('http://localhost:5000/api/pets');
  console.log('[3] Unauthenticated GET /api/pets (No Token) Status:', unauthRes.status, '| Message:', unauthRes.body.message);

  // 4. Role Authorization Denial (PET_OWNER trying to access admin revenue)
  const adminRes = await get('http://localhost:5000/api/reports/revenue', token);
  console.log('[4] Privilege Escalation Denial GET /api/reports/revenue Status:', adminRes.status, '| Message:', adminRes.body.message);

  console.log('\n=== TEST E: 5-ATTEMPT 15-MINUTE ACCOUNT LOCKOUT VERIFICATION ===');
  // Register a dedicated user for lockout testing
  const lockoutEmail = 'lockout.test@pbgms.in';
  await post('http://localhost:5000/api/auth/register', {
    name: 'Lockout Target',
    email: lockoutEmail,
    phone: '+91 9988776655',
    password: 'Password123!',
    notificationPreference: 'sms'
  });

  for (let i = 1; i <= 6; i++) {
    const failRes = await post('http://localhost:5000/api/auth/login', {
      email: lockoutEmail,
      password: 'WrongPassword' + i
    });
    console.log(`[Attempt ${i}] Status: ${failRes.status} | Message: ${failRes.body.message}`);
  }
}

run().catch(console.error);
