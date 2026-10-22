const { get, run, all } = require('../config/sqliteDb');
const razorpayService = require('../services/razorpayService');
const notificationService = require('../services/notificationService');

/**
 * GET /api/payments/config
 * Returns public gateway configuration for frontend checkout
 */
exports.getPaymentConfig = async (req, res) => {
  const configured = razorpayService.isConfigured();
  const isLive = razorpayService.isLiveMode();
  return res.json({
    success: true,
    configured,
    is_live: isLive,
    mode: isLive ? 'LIVE' : configured ? 'TEST' : 'UNCONFIGURED',
    key_id: razorpayService.getKeyId(),
    currency: 'INR'
  });
};

/**
 * POST /api/payments/create-order
 * Authoritatively calculates amount on the backend and creates a Razorpay Order
 */
exports.createOrder = async (req, res) => {
  try {
    const { booking_id, payment_type = 'Deposit' } = req.body;

    if (!booking_id) {
      return res.status(400).json({ success: false, message: 'Booking ID is required.' });
    }

    const booking = await get(`
      SELECT b.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
             p.name as pet_name
      FROM bookings b
      JOIN users u ON b.owner_id = u.id
      JOIN pets p ON b.pet_id = p.id
      WHERE b.id = ?
    `, [booking_id]);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // Role-based authorization
    if (req.user.role === 'PET_OWNER' && booking.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not own this booking.' });
    }

    if (booking.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot create payment for a cancelled booking.' });
    }

    // Calculate current financial standing from real DB records
    const existingPayments = await all(
      `SELECT * FROM payments WHERE booking_id = ? AND payment_status = 'Paid'`,
      [booking.id]
    );
    const paidSoFar = existingPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalDue = booking.total_price + (booking.late_checkout_fee || 0);
    const remainingBalance = Math.max(0, totalDue - paidSoFar);

    if (remainingBalance <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This booking has already been paid in full. No balance due.',
        paid_amount: paidSoFar,
        total_price: totalDue
      });
    }

    // Retrieve configured deposit percentage (default 20%)
    let depositPct = 20;
    const configRow = await get(`SELECT value FROM business_config WHERE key = 'deposit_percentage'`);
    if (configRow && !isNaN(Number(configRow.value))) {
      depositPct = Number(configRow.value);
    }

    let payableAmount = 0;
    let chosenPaymentType = payment_type;

    if (payment_type === 'Deposit') {
      const calculatedDeposit = Math.round((booking.total_price * (depositPct / 100)) * 100) / 100;
      if (paidSoFar >= calculatedDeposit) {
        // Deposit already paid, switch to remaining balance
        chosenPaymentType = 'Remaining Balance';
        payableAmount = remainingBalance;
      } else {
        payableAmount = Math.min(remainingBalance, calculatedDeposit - paidSoFar);
      }
    } else if (payment_type === 'Remaining Balance') {
      payableAmount = remainingBalance;
    } else {
      // Full Payment
      chosenPaymentType = 'Full Payment';
      payableAmount = remainingBalance;
    }

    if (payableAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment calculation: Amount payable is zero.' });
    }

    if (!razorpayService.isConfigured()) {
      return res.status(400).json({
        success: false,
        code: 'RAZORPAY_NOT_CONFIGURED',
        message: 'Razorpay payment gateway credentials are not configured on the server. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env.',
        amount: payableAmount,
        currency: 'INR'
      });
    }

    const receiptRef = `rcpt_${booking.booking_number}_${Date.now().toString(36)}`;
    const order = await razorpayService.createOrder({
      amountInINR: payableAmount,
      receipt: receiptRef,
      notes: {
        booking_id: String(booking.id),
        booking_number: booking.booking_number,
        pet_name: booking.pet_name,
        customer_email: booking.customer_email,
        payment_type: chosenPaymentType
      }
    });

    // Store pending transaction record in SQLite
    await run(`
      INSERT INTO payments (
        booking_id, amount, payment_method, payment_type, payment_status,
        transaction_reference, razorpay_order_id, currency, receipt
      ) VALUES (?, ?, 'Razorpay', ?, 'Pending', ?, ?, 'INR', ?)
    `, [booking.id, payableAmount, chosenPaymentType, order.id, order.id, receiptRef]);

    return res.status(201).json({
      success: true,
      order_id: order.id,
      amount: order.amount, // in paise
      amount_in_inr: payableAmount,
      currency: order.currency,
      key_id: razorpayService.getKeyId(),
      booking_id: booking.id,
      booking_number: booking.booking_number,
      customer: {
        name: booking.customer_name,
        email: booking.customer_email,
        phone: booking.customer_phone
      },
      payment_type: chosenPaymentType
    });
  } catch (err) {
    console.error('Razorpay order creation error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to create payment order.' });
  }
};

/**
 * POST /api/payments/verify
 * Cryptographically verifies Razorpay payment signature and updates database
 */
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      booking_id
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required verification fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature are mandatory.'
      });
    }

    // Cryptographic signature check
    let isValid = false;
    try {
      isValid = razorpayService.verifyPaymentSignature({
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        signature: razorpay_signature
      });
    } catch (sigErr) {
      return res.status(400).json({
        success: false,
        message: sigErr.message || 'Payment signature verification could not be performed.'
      });
    }

    if (!isValid) {
      // Record failed verification
      await run(`
        UPDATE payments SET payment_status = 'Failed', failure_reason = 'Signature verification mismatch'
        WHERE razorpay_order_id = ?
      `, [razorpay_order_id]);

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Signature does not match cryptographic secret. Transaction rejected.'
      });
    }

    // Check duplicate payment
    const existingVerified = await get(`
      SELECT * FROM payments WHERE razorpay_payment_id = ? AND payment_status = 'Paid'
    `, [razorpay_payment_id]);

    if (existingVerified) {
      return res.json({
        success: true,
        message: 'Payment has already been verified and recorded.',
        payment_id: existingVerified.id,
        transaction_reference: existingVerified.transaction_reference
      });
    }

    // Find pending payment record
    let payment = await get(`
      SELECT * FROM payments WHERE razorpay_order_id = ?
    `, [razorpay_order_id]);

    let resolvedBookingId = booking_id || (payment ? payment.booking_id : null);

    // Calculate transaction fee according to configured policy
    const feeRow = await get(`SELECT value FROM business_config WHERE key = 'gateway_fee_percentage'`);
    const fixedFeeRow = await get(`SELECT value FROM business_config WHERE key = 'gateway_fee_fixed'`);
    const feePct = feeRow && !isNaN(Number(feeRow.value)) ? Number(feeRow.value) : 2.0;
    const fixedFee = fixedFeeRow && !isNaN(Number(fixedFeeRow.value)) ? Number(fixedFeeRow.value) : 0.0;
    const baseAmount = payment ? Number(payment.amount) : 0;
    const estimatedFee = Math.round(((baseAmount * (feePct / 100)) + fixedFee) * 100) / 100;

    if (payment) {
      await run(`
        UPDATE payments SET
          payment_status = 'Paid',
          razorpay_payment_id = ?,
          razorpay_signature = ?,
          transaction_reference = ?,
          paid_at = CURRENT_TIMESTAMP,
          payment_environment = 'test',
          estimated_transaction_fee = ?,
          fee_status = 'estimated',
          amount_charged = ?
        WHERE id = ?
      `, [razorpay_payment_id, razorpay_signature, razorpay_payment_id, estimatedFee, payment.amount, payment.id]);
    } else if (resolvedBookingId) {
      const result = await run(`
        INSERT INTO payments (
          booking_id, amount, payment_method, payment_type, payment_status,
          transaction_reference, razorpay_order_id, razorpay_payment_id, razorpay_signature, currency,
          payment_environment, estimated_transaction_fee, fee_status, amount_charged
        ) VALUES (?, 0, 'Razorpay', 'Full Payment', 'Paid', ?, ?, ?, ?, 'INR', 'test', ?, 'estimated', 0)
      `, [resolvedBookingId, razorpay_payment_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, estimatedFee]);
      payment = { id: result.lastID, booking_id: resolvedBookingId, amount: 0 };
    } else {
      return res.status(400).json({ success: false, message: 'Cannot correlate payment with local booking record.' });
    }


    // Generate or fetch Authoritative Receipt record
    const receiptNum = `RCP-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    await run(`
      INSERT OR IGNORE INTO receipts (receipt_number, payment_id, booking_id, customer_id, receipt_status)
      VALUES (?, ?, ?, ?, 'Paid')
    `, [receiptNum, payment.id, resolvedBookingId, req.user.id]);

    // Update booking status
    if (resolvedBookingId) {
      const booking = await get(`SELECT * FROM bookings WHERE id = ?`, [resolvedBookingId]);
      if (booking && booking.status === 'Pending') {
        await run(`UPDATE bookings SET status = 'Confirmed' WHERE id = ?`, [resolvedBookingId]);
      }

      // Notify customer
      if (booking) {
        await notificationService.sendNotification({
          userId: booking.owner_id,
          channel: 'both',
          type: 'Receipt',
          title: 'Payment Confirmed',
          message: `Payment #${razorpay_payment_id} for Booking #${booking.booking_number} verified and confirmed.`
        });
      }
    }

    return res.json({
      success: true,
      message: 'Payment verified and recorded successfully.',
      payment_id: payment.id,
      razorpay_payment_id,
      booking_id: resolvedBookingId
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    return res.status(500).json({ success: false, message: 'Server error during payment verification.' });
  }
};


/**
 * POST /api/payments/webhook
 * Handles asynchronous Razorpay webhook events with HMAC SHA256 validation
 */
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody;

    if (!rawBody || !signature) {
      return res.status(400).json({ success: false, message: 'Missing webhook raw body or signature.' });
    }

    let isValid = false;
    try {
      isValid = razorpayService.verifyWebhookSignature({ rawBody, signature });
    } catch (sigErr) {
      return res.status(400).json({ success: false, message: sigErr.message });
    }

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const event = req.body;
    const eventType = event.event;

    if (eventType === 'payment.captured') {
      const paymentEntity = event.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      const amountInINR = paymentEntity.amount / 100;

      const existing = await get(`SELECT * FROM payments WHERE razorpay_order_id = ?`, [orderId]);
      if (existing && existing.payment_status !== 'Paid') {
        await run(`
          UPDATE payments SET
            payment_status = 'Paid',
            razorpay_payment_id = ?,
            paid_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [paymentId, existing.id]);

        await run(`UPDATE bookings SET status = 'Confirmed' WHERE id = ? AND status = 'Pending'`, [existing.booking_id]);
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = event.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const failureReason = paymentEntity.error_description || 'Payment failed';

      await run(`
        UPDATE payments SET payment_status = 'Failed', failure_reason = ?
        WHERE razorpay_order_id = ? AND payment_status != 'Paid'
      `, [failureReason, orderId]);
    } else if (eventType === 'refund.processed') {
      const refundEntity = event.payload.refund.entity;
      const paymentId = refundEntity.payment_id;
      const refundId = refundEntity.id;
      const refundAmount = refundEntity.amount / 100;

      await run(`
        UPDATE payments SET
          payment_status = 'Refunded',
          razorpay_refund_id = ?,
          refund_amount = ?,
          refund_status = 'Processed'
        WHERE razorpay_payment_id = ?
      `, [refundId, refundAmount, paymentId]);
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ success: false, message: 'Webhook handling error.' });
  }
};

/**
 * POST /api/payments/refund
 * Processes Razorpay refund for cancellations (Staff / Admin)
 */
exports.processRefund = async (req, res) => {
  try {
    const { payment_id, amount, reason } = req.body;

    if (!payment_id) {
      return res.status(400).json({ success: false, message: 'Payment ID is required.' });
    }

    const payment = await get(`SELECT * FROM payments WHERE id = ?`, [payment_id]);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    if (payment.payment_status !== 'Paid') {
      return res.status(400).json({ success: false, message: `Only 'Paid' transactions can be refunded. Current status: ${payment.payment_status}` });
    }

    const refundAmount = amount !== undefined ? Number(amount) : payment.amount;

    if (payment.payment_method === 'Razorpay' && payment.razorpay_payment_id && razorpayService.isConfigured()) {
      const rzpRefund = await razorpayService.processRefund({
        payment_id: payment.razorpay_payment_id,
        amountInINR: refundAmount,
        notes: { reason: reason || 'Customer cancellation' }
      });

      await run(`
        UPDATE payments SET
          payment_status = 'Refunded',
          razorpay_refund_id = ?,
          refund_amount = ?,
          refund_status = 'Completed'
        WHERE id = ?
      `, [rzpRefund.id, refundAmount, payment.id]);

      return res.json({
        success: true,
        message: 'Refund processed successfully via Razorpay.',
        refund_id: rzpRefund.id,
        refund_amount: refundAmount
      });
    } else {
      // Manual/Cash/Offline Refund recorded in database
      const refTxn = `REF-${Math.floor(100000 + Math.random() * 900000)}`;
      await run(`
        UPDATE payments SET
          payment_status = 'Refunded',
          refund_amount = ?,
          refund_status = 'Completed',
          transaction_reference = ?
        WHERE id = ?
      `, [refundAmount, refTxn, payment.id]);

      return res.json({
        success: true,
        message: 'Refund recorded in database.',
        refund_reference: refTxn,
        refund_amount: refundAmount
      });
    }
  } catch (err) {
    console.error('Refund error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Refund processing failed.' });
  }
};

/**
 * GET /api/payments/history/:bookingId
 * Retrieves verified transaction history for a booking
 */
exports.getBookingPayments = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await get(`SELECT * FROM bookings WHERE id = ?`, [bookingId]);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    if (req.user.role === 'PET_OWNER' && booking.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view these payment records.' });
    }

    const transactions = await all(`
      SELECT p.*, b.booking_number
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      WHERE p.booking_id = ?
      ORDER BY p.id DESC
    `, [bookingId]);

    const totalPaid = transactions
      .filter(t => t.payment_status === 'Paid')
      .reduce((sum, t) => sum + t.amount, 0);

    return res.json({
      success: true,
      booking_number: booking.booking_number,
      total_price: booking.total_price + (booking.late_checkout_fee || 0),
      total_paid: totalPaid,
      remaining_balance: Math.max(0, (booking.total_price + (booking.late_checkout_fee || 0)) - totalPaid),
      transactions
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve payment history.' });
  }
};

/**
 * POST /api/payments/simulate
 * Explicit presentation demo simulator that records an authorized demo payment in SQLite
 * with prominent DEMO_SIMULATOR label and zero real money charge.
 */
exports.simulatePayment = async (req, res) => {
  try {
    const { booking_id, payment_type = 'Deposit', payment_method = 'Demo Simulator' } = req.body;
    if (!booking_id) {
      return res.status(400).json({ success: false, message: 'Booking ID is required.' });
    }

    const booking = await get(`
      SELECT b.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
             p.name as pet_name
      FROM bookings b
      JOIN users u ON b.owner_id = u.id
      JOIN pets p ON b.pet_id = p.id
      WHERE b.id = ?
    `, [booking_id]);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    if (req.user.role === 'PET_OWNER' && booking.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not own this booking.' });
    }

    const existingPayments = await all(
      `SELECT * FROM payments WHERE booking_id = ? AND payment_status = 'Paid'`,
      [booking.id]
    );
    const paidSoFar = existingPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalDue = booking.total_price + (booking.late_checkout_fee || 0);
    const remainingBalance = Math.max(0, totalDue - paidSoFar);

    if (remainingBalance <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This booking has already been paid in full. No balance due.',
        paid_amount: paidSoFar,
        total_price: totalDue
      });
    }

    let depositPct = 20;
    const configRow = await get(`SELECT value FROM business_config WHERE key = 'deposit_percentage'`);
    if (configRow && !isNaN(Number(configRow.value))) {
      depositPct = Number(configRow.value);
    }

    let payableAmount = 0;
    let chosenPaymentType = payment_type;
    if (payment_type === 'Deposit') {
      const calculatedDeposit = Math.round((booking.total_price * (depositPct / 100)) * 100) / 100;
      if (paidSoFar >= calculatedDeposit) {
        chosenPaymentType = 'Remaining Balance';
        payableAmount = remainingBalance;
      } else {
        payableAmount = Math.min(remainingBalance, calculatedDeposit - paidSoFar);
      }
    } else {
      payableAmount = remainingBalance;
    }

    if (payableAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment calculation: Amount payable is zero.' });
    }

    // Calculate estimated transaction fee
    const feeRow = await get(`SELECT value FROM business_config WHERE key = 'gateway_fee_percentage'`);
    const feePct = feeRow && !isNaN(Number(feeRow.value)) ? Number(feeRow.value) : 2.0;
    const estimatedFee = Math.round((payableAmount * (feePct / 100)) * 100) / 100;

    const simTxn = `SIM-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const simReceipt = `RCP-SIM-${Date.now().toString(36).toUpperCase()}`;

    const payResult = await run(`
      INSERT INTO payments (
        booking_id, amount, payment_method, payment_type, payment_status,
        transaction_reference, currency, payment_environment, estimated_transaction_fee, fee_status,
        amount_charged, receipt
      ) VALUES (?, ?, ?, ?, 'Paid', ?, 'INR', 'simulator', ?, 'estimated', ?, ?)
    `, [booking.id, payableAmount, payment_method, chosenPaymentType, simTxn, estimatedFee, payableAmount, simReceipt]);

    // Insert Receipt Record
    await run(`
      INSERT INTO receipts (receipt_number, payment_id, booking_id, customer_id, receipt_status)
      VALUES (?, ?, ?, ?, 'Paid')
    `, [simReceipt, payResult.lastID, booking.id, booking.owner_id]);

    // Update booking status if needed
    if (booking.status === 'Pending') {
      await run(`UPDATE bookings SET status = 'Confirmed' WHERE id = ?`, [booking.id]);
    }

    // Send confirmation notification
    await notificationService.sendNotification({
      userId: booking.owner_id,
      channel: 'both',
      type: 'Receipt',
      title: 'Demo Payment Confirmed',
      message: `Simulated Payment #${simTxn} of Rs. ${payableAmount.toFixed(2)} recorded for Booking #${booking.booking_number}.`
    });

    return res.status(201).json({
      success: true,
      message: 'Demo payment simulated and recorded successfully. No real money was charged.',
      payment_id: payResult.lastID,
      transaction_reference: simTxn,
      receipt_number: simReceipt,
      amount: payableAmount,
      booking_id: booking.id,
      remaining_balance: Math.max(0, remainingBalance - payableAmount)
    });
  } catch (err) {
    console.error('Simulate payment error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process simulated payment.' });
  }
};

/**
 * GET /api/payments/receipt/:paymentId
 * Retrieves receipt details and authoritative fee breakdown for a verified payment
 */
exports.getReceipt = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await get(`SELECT * FROM payments WHERE id = ?`, [paymentId]);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    const booking = await get(`
      SELECT b.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
             p.name as pet_name, p.species as pet_species, p.breed as pet_breed,
             s.service_name
      FROM bookings b
      JOIN users u ON b.owner_id = u.id
      JOIN pets p ON b.pet_id = p.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.id = ?
    `, [payment.booking_id]);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Associated booking not found.' });
    }

    // Access control: Pet owner must own booking, or user must have staff/admin role
    if (req.user.role === 'PET_OWNER' && booking.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this receipt.' });
    }

    let receipt = await get(`SELECT * FROM receipts WHERE payment_id = ?`, [payment.id]);
    if (!receipt && payment.payment_status === 'Paid') {
      const receiptNum = `RCP-${Date.now().toString(36).toUpperCase()}-${payment.id}`;
      await run(`
        INSERT INTO receipts (receipt_number, payment_id, booking_id, customer_id, receipt_status)
        VALUES (?, ?, ?, ?, 'Paid')
      `, [receiptNum, payment.id, booking.id, booking.owner_id]);
      receipt = await get(`SELECT * FROM receipts WHERE payment_id = ?`, [payment.id]);
    }

    // Compute previous payments and balance
    const allPayments = await all(`SELECT * FROM payments WHERE booking_id = ? AND payment_status = 'Paid'`, [booking.id]);
    const priorPayments = allPayments.filter(p => p.id < payment.id);
    const priorPaid = priorPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalDue = booking.total_price + (booking.late_checkout_fee || 0);
    const amountDueBefore = Math.max(0, totalDue - priorPaid);
    const remainingBalance = Math.max(0, amountDueBefore - payment.amount);

    const feeAmount = payment.actual_transaction_fee || payment.estimated_transaction_fee || 0;
    const feeStatus = payment.fee_status || (payment.actual_transaction_fee ? 'actual' : 'estimated');
    const feeType = payment.actual_transaction_fee ? 'actual' : 'estimated';

    return res.json({
      success: true,
      receipt: receipt || {
        receipt_number: `RCP-${payment.id}`,
        receipt_status: payment.payment_status,
        issue_timestamp: payment.paid_at
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency || 'INR',
        payment_method: payment.payment_method,
        payment_type: payment.payment_type,
        payment_status: payment.payment_status,
        transaction_reference: payment.transaction_reference,
        payment_environment: payment.payment_environment || 'simulator',
        paid_at: payment.paid_at
      },
      booking: {
        id: booking.id,
        booking_number: booking.booking_number,
        booking_type: booking.booking_type,
        service_name: booking.service_name || (booking.booking_type === 'BOARDING' ? 'Luxury Boarding Suite' : 'Grooming Care'),
        start_date: booking.start_date,
        total_price: totalDue,
        pet_name: booking.pet_name,
        pet_species: booking.pet_species
      },
      customer: {
        id: booking.owner_id,
        name: booking.customer_name,
        email: booking.customer_email,
        phone: booking.customer_phone
      },
      fee_breakdown: {
        amountDueBefore,
        amountPaid: payment.amount,
        remainingBalance,
        feeAmount,
        feeStatus,
        feeType,
        netBusinessSettlement: Math.max(0, payment.amount - feeAmount)
      }
    });
  } catch (err) {
    console.error('Get receipt error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve receipt.' });
  }
};

/**
 * GET /api/payments/receipt/:paymentId/pdf
 * Generates and streams an authoritative, downloadable PDF receipt
 */
exports.downloadReceiptPdf = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await get(`SELECT * FROM payments WHERE id = ?`, [paymentId]);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    const booking = await get(`
      SELECT b.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
             p.name as pet_name, p.species as pet_species, p.breed as pet_breed,
             s.service_name
      FROM bookings b
      JOIN users u ON b.owner_id = u.id
      JOIN pets p ON b.pet_id = p.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.id = ?
    `, [payment.booking_id]);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Associated booking not found.' });
    }

    if (req.user.role === 'PET_OWNER' && booking.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized to download this receipt.' });
    }

    let receipt = await get(`SELECT * FROM receipts WHERE payment_id = ?`, [payment.id]);
    if (!receipt) {
      const receiptNum = `RCP-${Date.now().toString(36).toUpperCase()}-${payment.id}`;
      await run(`
        INSERT INTO receipts (receipt_number, payment_id, booking_id, customer_id, receipt_status)
        VALUES (?, ?, ?, ?, ?)
      `, [receiptNum, payment.id, booking.id, booking.owner_id, payment.payment_status]);
      receipt = await get(`SELECT * FROM receipts WHERE payment_id = ?`, [payment.id]);
    }

    // Calculations
    const allPayments = await all(`SELECT * FROM payments WHERE booking_id = ? AND payment_status = 'Paid'`, [booking.id]);
    const priorPayments = allPayments.filter(p => p.id < payment.id);
    const priorPaid = priorPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalDue = booking.total_price + (booking.late_checkout_fee || 0);
    const amountDueBefore = Math.max(0, totalDue - priorPaid);
    const remainingBalance = Math.max(0, amountDueBefore - payment.amount);

    const feeAmount = payment.actual_transaction_fee || payment.estimated_transaction_fee || 0;
    const feeStatus = payment.fee_status || (payment.actual_transaction_fee ? 'actual' : 'estimated');
    const feeType = payment.actual_transaction_fee ? 'actual' : 'estimated';

    const { generateReceiptPdf } = require('../services/receiptService');
    const pdfBuffer = await generateReceiptPdf({
      receipt,
      payment,
      booking,
      customer: {
        name: booking.customer_name,
        email: booking.customer_email,
        phone: booking.customer_phone
      },
      feeInfo: {
        amountDueBefore,
        amountPaid: payment.amount,
        remainingBalance,
        feeAmount,
        feeStatus,
        feeType,
        netBusinessSettlement: Math.max(0, payment.amount - feeAmount)
      }
    });

    const filename = `PBGMS-Receipt-${receipt.receipt_number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (err) {
    console.error('Download receipt PDF error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate PDF receipt.' });
  }
};

