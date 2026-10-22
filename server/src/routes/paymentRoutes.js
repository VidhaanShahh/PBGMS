const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, requireRole } = require('../middleware/auth');

// Public Gateway Config
router.get('/config', paymentController.getPaymentConfig);

// Authenticated Order Creation & Cryptographic Signature Verification
router.post('/create-order', authenticate, paymentController.createOrder);
router.post('/verify', authenticate, paymentController.verifyPayment);

// Presentation Demo Simulator Payment (Explicitly authorized demo with authoritative DB record)
router.post('/simulate', authenticate, paymentController.simulatePayment);

// Receipt retrieval & PDF download
router.get('/receipt/:paymentId', authenticate, paymentController.getReceipt);
router.get('/receipt/:paymentId/pdf', authenticate, paymentController.downloadReceiptPdf);

// Webhook endpoint (Raw body verified cryptographically via HMAC SHA256)
router.post('/webhook', paymentController.handleWebhook);

// Refund processing (Restricted to Front Desk & Admin)
router.post('/refund', authenticate, requireRole(['ADMIN', 'FRONT_DESK']), paymentController.processRefund);

// Payment history for a booking
router.get('/history/:bookingId', authenticate, paymentController.getBookingPayments);

// Legacy fallback endpoint for older test suites
router.post('/process', async (req, res, next) => {
  return paymentController.createOrder(req, res).catch(next);
});


module.exports = router;
