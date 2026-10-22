const PDFDocument = require('pdfkit');

/**
 * Generate a PDF receipt buffer for a verified payment and booking.
 * 
 * @param {Object} data
 * @param {Object} data.receipt - Receipt database record
 * @param {Object} data.payment - Authoritative payment record
 * @param {Object} data.booking - Authoritative booking record
 * @param {Object} data.customer - Customer/Owner record
 * @param {Object} data.feeInfo - Transaction fee breakdown
 * @returns {Promise<Buffer>} Resolves to a binary PDF buffer
 */
function generateReceiptPdf({ receipt, payment, booking, customer, feeInfo }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 45,
        info: {
          Title: `PBGMS Receipt ${receipt.receipt_number}`,
          Author: 'Pet Boarding & Grooming Management System',
          Subject: `Transaction Receipt for Booking ${booking.booking_number}`,
          Keywords: 'receipt, payment, PBGMS, pet care'
        }
      });

      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      const isSimulator = payment.payment_environment === 'simulator' || payment.payment_method === 'Demo Simulator';

      // ── Header Banner ──
      if (isSimulator) {
        doc.rect(45, 45, 505, 26).fill('#FEE2E2');
        doc.fillColor('#991B1B')
           .fontSize(10)
           .font('Helvetica-Bold')
           .text('DEMO / SIMULATED PAYMENT — NOT A REAL FINANCIAL TRANSACTION', 50, 52, { align: 'center', width: 495 });
        doc.moveDown(1.5);
      } else {
        doc.rect(45, 45, 505, 26).fill('#ECFDF5');
        doc.fillColor('#065F46')
           .fontSize(10)
           .font('Helvetica-Bold')
           .text('OFFICIAL TRANSACTION RECEIPT — VERIFIED PAYMENT', 50, 52, { align: 'center', width: 495 });
        doc.moveDown(1.5);
      }

      const topY = isSimulator ? 85 : 85;

      // ── Business Details & Logo Heading ──
      doc.fillColor('#171717')
         .fontSize(20)
         .font('Helvetica-Bold')
         .text('PBGMS INDIA', 45, topY);

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#555555')
         .text('Pet Boarding & Grooming Management System', 45, topY + 24)
         .text('Premier Care, Luxury Boarding & Certified Grooming Spa', 45, topY + 36)
         .text('Support: support@pbgms.in | Phone: +91 98765 43210', 45, topY + 48)
         .text('Web: https://pbgms.netlify.app', 45, topY + 60);

      // Receipt Meta Box (Right aligned)
      doc.rect(340, topY, 210, 75).fillAndStroke('#F8FAFC', '#171717');
      doc.fillColor('#171717')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('RECEIPT', 350, topY + 8)
         .fontSize(9)
         .font('Helvetica')
         .fillColor('#333333')
         .text(`Number: ${receipt.receipt_number}`, 350, topY + 24)
         .text(`Date: ${new Date(receipt.issue_timestamp || receipt.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 350, topY + 38)
         .text(`Status: ${receipt.receipt_status || payment.payment_status}`, 350, topY + 52)
         .text(`Currency: ${payment.currency || 'INR'} (Rs.)`, 350, topY + 64);

      // ── Divider ──
      doc.strokeColor('#171717').lineWidth(1.5).moveTo(45, topY + 88).lineTo(550, topY + 88).stroke();

      // ── Customer & Booking Information ──
      const detailsY = topY + 100;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#171717').text('CUSTOMER & RESERVATION DETAILS', 45, detailsY);

      doc.rect(45, detailsY + 16, 505, 74).fillAndStroke('#FFFFFF', '#CBD5E1');

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333');
      doc.text('Customer Name:', 55, detailsY + 24);
      doc.text('Email Address:', 55, detailsY + 38);
      doc.text('Phone Number:', 55, detailsY + 52);
      doc.text('Pet Name & Species:', 55, detailsY + 66);

      doc.font('Helvetica').fillColor('#171717');
      doc.text(customer.name || 'Valued Pet Parent', 165, detailsY + 24);
      doc.text(customer.email || 'N/A', 165, detailsY + 38);
      doc.text(customer.phone || 'N/A', 165, detailsY + 52);
      doc.text(`${booking.pet_name || 'Pet'} (${booking.pet_species || 'Dog/Cat'}${booking.pet_breed ? ` - ${booking.pet_breed}` : ''})`, 165, detailsY + 66);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Booking Ref:', 320, detailsY + 24);
      doc.text('Booking Type:', 320, detailsY + 38);
      doc.text('Service:', 320, detailsY + 52);
      doc.text('Scheduled Date:', 320, detailsY + 66);

      doc.font('Helvetica').fillColor('#171717');
      doc.text(`#${booking.booking_number}`, 410, detailsY + 24);
      doc.text(booking.booking_type || 'Grooming/Boarding', 410, detailsY + 38);
      doc.text((booking.service_name || (booking.booking_type === 'BOARDING' ? 'Luxury Boarding Suite' : 'Grooming')).slice(0, 24), 410, detailsY + 52);
      doc.text(booking.start_date || 'N/A', 410, detailsY + 66);

      // ── Payment & Transaction Information Table ──
      const tableY = detailsY + 104;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#171717').text('PAYMENT BREAKDOWN & FEES', 45, tableY);

      // Table Header
      doc.rect(45, tableY + 16, 505, 22).fill('#171717');
      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
      doc.text('Item Description', 55, tableY + 22);
      doc.text('Payment Category', 240, tableY + 22);
      doc.text('Method / Provider', 360, tableY + 22);
      doc.text('Amount (INR)', 470, tableY + 22, { align: 'right', width: 70 });

      // Table Row
      doc.rect(45, tableY + 38, 505, 26).fillAndStroke('#FFFFFF', '#CBD5E1');
      doc.fillColor('#171717').fontSize(9).font('Helvetica');
      doc.text(booking.service_name || `${booking.booking_type} Reservation Settlement`, 55, tableY + 46, { width: 180 });
      doc.text(payment.payment_type || 'Full Payment', 240, tableY + 46);
      doc.text(payment.payment_method || 'Online Gateway', 360, tableY + 46);
      doc.font('Helvetica-Bold').text(`Rs. ${Number(payment.amount).toFixed(2)}`, 470, tableY + 46, { align: 'right', width: 70 });

      // ── Authoritative Financial Totals Box ──
      const calcY = tableY + 74;
      const boxWidth = 240;
      const boxX = 310;
      doc.rect(boxX, calcY, boxWidth, 136).fillAndStroke('#F8FAFC', '#171717');

      const drawRow = (label, value, y, isBold = false, color = '#171717') => {
        doc.fontSize(9).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color);
        doc.text(label, boxX + 12, y);
        doc.text(value, boxX + 130, y, { align: 'right', width: 95 });
      };

      drawRow('Total Booking Value:', `Rs. ${Number(booking.total_price + (booking.late_checkout_fee || 0)).toFixed(2)}`, calcY + 10);
      drawRow('Amount Due Prior:', `Rs. ${Number(feeInfo.amountDueBefore).toFixed(2)}`, calcY + 24);
      drawRow('Amount Paid (This Txn):', `Rs. ${Number(payment.amount).toFixed(2)}`, calcY + 38, true, '#065F46');
      drawRow('Remaining Balance:', `Rs. ${Number(feeInfo.remainingBalance).toFixed(2)}`, calcY + 52, false, feeInfo.remainingBalance > 0 ? '#991B1B' : '#065F46');
      
      // Divider in box
      doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(boxX + 10, calcY + 68).lineTo(boxX + boxWidth - 10, calcY + 68).stroke();

      // Transaction Fee Section (Authoritative breakdown)
      drawRow('Payment Gateway Fee:', `Rs. ${Number(feeInfo.feeAmount).toFixed(2)}`, calcY + 76);
      drawRow('Fee Classification:', `${feeInfo.feeType.toUpperCase()} (${feeInfo.feeStatus})`, calcY + 90, false, '#6B7280');
      drawRow('Customer Fee Added:', 'Rs. 0.00 (Inclusive)', calcY + 104, false, '#4B5563');
      drawRow('Net Settlement to Business:', `Rs. ${Number(feeInfo.netBusinessSettlement).toFixed(2)}`, calcY + 118, true, '#171717');

      // ── Transaction References (Left side) ──
      doc.rect(45, calcY, 250, 136).fillAndStroke('#FFFFFF', '#CBD5E1');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#171717').text('AUDIT & COMPLIANCE METRICS', 55, calcY + 10);
      doc.fontSize(8.5).font('Helvetica').fillColor('#4B5563')
         .text(`Transaction Reference:`, 55, calcY + 28)
         .font('Helvetica-Bold').fillColor('#111827').text(`${payment.transaction_reference || 'N/A'}`, 55, calcY + 39)
         .font('Helvetica').fillColor('#4B5563').text(`Provider Order ID:`, 55, calcY + 54)
         .font('Helvetica').fillColor('#111827').text(`${payment.razorpay_order_id || 'LOCAL_ORDER'}`, 55, calcY + 65)
         .font('Helvetica').fillColor('#4B5563').text(`Provider Payment ID:`, 55, calcY + 80)
         .font('Helvetica').fillColor('#111827').text(`${payment.razorpay_payment_id || 'SIMULATED'}`, 55, calcY + 91)
         .font('Helvetica').fillColor('#4B5563').text(`Payment Environment:`, 55, calcY + 106)
         .font('Helvetica-Bold').fillColor(isSimulator ? '#B91C1C' : '#047857').text(`${payment.payment_environment || 'simulator'}`.toUpperCase(), 55, calcY + 117);

      // ── Footer / Legal Note ──
      const footerY = 730;
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(45, footerY).lineTo(550, footerY).stroke();
      doc.fontSize(8).font('Helvetica').fillColor('#64748B')
         .text('Thank you for trusting PBGMS India with your pet’s boarding and grooming care.', 45, footerY + 8, { align: 'center', width: 505 })
         .text('This receipt was automatically generated from verified database records. For questions or refunds, contact accounts@pbgms.in.', 45, footerY + 20, { align: 'center', width: 505 })
         .text(`Generated on ${new Date().toISOString()} | Unique Receipt ID: ${receipt.receipt_number}`, 45, footerY + 32, { align: 'center', width: 505 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateReceiptPdf };
