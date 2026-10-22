const crypto = require('crypto');
let Razorpay;
try {
  Razorpay = require('razorpay');
} catch (e) {
  Razorpay = null;
}

const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

let razorpayInstance = null;
if (Razorpay && KEY_ID && KEY_SECRET) {
  razorpayInstance = new Razorpay({
    key_id: KEY_ID,
    key_secret: KEY_SECRET
  });
}

function isConfigured() {
  return Boolean(KEY_ID && KEY_SECRET);
}

function isLiveMode() {
  return isConfigured() && KEY_ID.startsWith('rzp_live_');
}

function getKeyId() {
  return KEY_ID;
}

/**
 * Create a Razorpay Order
 * @param {Object} params
 * @param {number} params.amountInINR - Amount in Rupees
 * @param {string} params.receipt - Unique internal receipt reference
 * @param {Object} [params.notes] - Key-value metadata
 */
async function createOrder({ amountInINR, receipt, notes = {} }) {
  if (!isConfigured() || !razorpayInstance) {
    throw new Error('Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env.');
  }

  const amountInPaise = Math.round(Number(amountInINR) * 100);
  if (amountInPaise <= 0) {
    throw new Error('Invalid order amount. Amount must be greater than zero.');
  }

  const options = {
    amount: amountInPaise,
    currency: 'INR',
    receipt: receipt.slice(0, 40),
    notes
  };

  const order = await razorpayInstance.orders.create(options);
  return order;
}

/**
 * Verify Razorpay payment signature
 * generated_signature = hmac_sha256(order_id + "|" + razorpay_payment_id, secret)
 */
function verifyPaymentSignature({ order_id, payment_id, signature }) {
  if (!KEY_SECRET) {
    throw new Error('Cannot verify payment signature: RAZORPAY_KEY_SECRET is not configured.');
  }
  if (!order_id || !payment_id || !signature) {
    return false;
  }

  const body = `${order_id}|${payment_id}`;
  const expectedSignature = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(body.toString())
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
  const signatureBuf = Buffer.from(signature, 'utf-8');

  if (expectedBuf.length !== signatureBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

/**
 * Verify Razorpay Webhook signature
 * signature header: x-razorpay-signature
 */
function verifyWebhookSignature({ rawBody, signature }) {
  if (!WEBHOOK_SECRET) {
    throw new Error('Webhook secret (RAZORPAY_WEBHOOK_SECRET) is not configured.');
  }
  if (!rawBody || !signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
  const signatureBuf = Buffer.from(signature, 'utf-8');

  if (expectedBuf.length !== signatureBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

/**
 * Refund a captured payment via Razorpay API
 */
async function processRefund({ payment_id, amountInINR, notes = {} }) {
  if (!isConfigured() || !razorpayInstance) {
    throw new Error('Razorpay is not configured. Cannot process online gateway refund.');
  }

  const options = { notes };
  if (amountInINR !== undefined && amountInINR !== null) {
    options.amount = Math.round(Number(amountInINR) * 100);
  }

  const refund = await razorpayInstance.payments.refund(payment_id, options);
  return refund;
}

/**
 * Fetch payment details from Razorpay
 */
async function fetchPayment(payment_id) {
  if (!isConfigured() || !razorpayInstance) {
    throw new Error('Razorpay is not configured.');
  }
  return await razorpayInstance.payments.fetch(payment_id);
}

module.exports = {
  isConfigured,
  isLiveMode,
  getKeyId,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  processRefund,
  fetchPayment
};
