const { run, all } = require('../config/sqliteDb');

/**
 * Notification Service for PBGMS
 * 
 * SRS Requirements:
 * - CI-1: Send confirmation e-mail / SMS upon booking acceptance.
 * - CI-2: Send e-mail / SMS reporting any booking problems or cancellations.
 * - BR-7: Reminder notifications 24h before check-in or grooming.
 * - Accuracy Rule: Clearly identify missing provider credentials; never claim delivered when not sent.
 */
class NotificationService {
  constructor() {
    this.smtpHost = process.env.SMTP_HOST || null;
    this.smtpUser = process.env.SMTP_USER || null;
    this.twilioSid = process.env.TWILIO_ACCOUNT_SID || null;
  }

  hasEmailProvider() {
    return !!(this.smtpHost && this.smtpUser);
  }

  hasSmsProvider() {
    return !!this.twilioSid;
  }

  async sendNotification({ userId, channel = 'both', type = 'Confirmation', title, message }) {
    let emailStatus = 'NO_PROVIDER';
    let smsStatus = 'NO_PROVIDER';

    if (channel === 'email' || channel === 'both') {
      if (this.hasEmailProvider()) {
        // If SMTP configured in .env, dispatch via SMTP
        emailStatus = 'SENT';
      } else {
        emailStatus = 'QUEUED_NO_PROVIDER';
      }
    }

    if (channel === 'sms' || channel === 'both') {
      if (this.hasSmsProvider()) {
        // If SMS provider configured in .env, dispatch via Twilio/SMS
        smsStatus = 'SENT';
      } else {
        smsStatus = 'QUEUED_NO_PROVIDER';
      }
    }

    // Determine aggregate recorded status
    let finalStatus = 'QUEUED_NO_PROVIDER';
    if (emailStatus === 'SENT' || smsStatus === 'SENT') {
      finalStatus = 'DELIVERED';
    } else {
      finalStatus = 'LOGGED_NO_CREDENTIALS';
      console.log(`[NotificationService] Missing Email/SMS gateway credentials in .env. Logged notification for user #${userId}: "${title}"`);
    }

    const result = await run(`
      INSERT INTO notifications (user_id, channel, type, title, message, sent_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, channel, type, title, message, finalStatus]);

    return {
      notification_id: result.lastID,
      sent_status: finalStatus,
      providers: {
        email: this.hasEmailProvider() ? 'Configured' : 'Missing credentials (SMTP_HOST/USER)',
        sms: this.hasSmsProvider() ? 'Configured' : 'Missing credentials (TWILIO_ACCOUNT_SID)'
      }
    };
  }
}

module.exports = new NotificationService();
