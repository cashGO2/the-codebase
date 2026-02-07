/**
 * Materio SMTP Mailer Utility
 * Sends incident/alert emails via Gmail SMTP using nodemailer.
 * Used as a free replacement for incident.io API.
 *
 * Environment variables:
 *   SMTP_EMAIL     - Gmail address (e.g. materioappdesk@gmail.com)
 *   SMTP_PASSWORD  - Gmail App Password (16-char code from Google)
 *   ALERT_EMAIL    - Recipient for incident alerts (defaults to SMTP_EMAIL)
 */

const nodemailer = require('nodemailer');

// --- Config ---
const SMTP_EMAIL = process.env.SMTP_EMAIL || process.env.SENDER_EMAIL || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || process.env.SENDER_PASSWORD || '';
const ALERT_EMAIL = process.env.ALERT_EMAIL || SMTP_EMAIL;

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);

// Reusable transporter (created lazily)
let _transporter = null;

function getTransporter() {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    return null;
  }
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_EMAIL,
        pass: SMTP_PASSWORD,
      },
      // Connection timeout for serverless
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return _transporter;
}

// --- Severity styles ---
const SEVERITY_COLORS = {
  critical: '#DC2626',
  major: '#EA580C',
  minor: '#CA8A04',
  cosmetic: '#6B7280',
};

const SEVERITY_EMOJI = {
  critical: '🔴',
  major: '🟠',
  minor: '🟡',
  cosmetic: '⚪',
};

/**
 * Send an incident alert email when bug reports cluster.
 *
 * @param {Object} incidentData - output from buildIncidentSummary()
 *   { name, summary, severity, affectedAreas, reportCount }
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendIncidentEmail(incidentData) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[Mailer] SMTP not configured — skipping incident email');
    return { success: false, error: 'SMTP not configured' };
  }

  const { name, summary, severity, affectedAreas, reportCount } = incidentData;
  const color = SEVERITY_COLORS[severity] || '#6B7280';
  const emoji = SEVERITY_EMOJI[severity] || '⚪';
  const timestamp = new Date().toISOString();

  const subject = `${emoji} [Materio Incident] ${name}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <!-- Header -->
    <div style="background:${color};padding:20px 24px;color:#fff;">
      <h1 style="margin:0;font-size:18px;font-weight:600;">${emoji} Auto-Incident Created</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:0.9;">Materio Health Monitor</p>
    </div>

    <!-- Body -->
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#6b7280;width:120px;">Incident</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;">${escapeHtml(name)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#6b7280;">Severity</td>
          <td style="padding:8px 0;">
            <span style="display:inline-block;background:${color};color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;text-transform:uppercase;">
              ${severity}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#6b7280;">Affected Areas</td>
          <td style="padding:8px 0;font-size:14px;">${escapeHtml(affectedAreas.join(', '))}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#6b7280;">Reports</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;">${reportCount} clustered reports</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#6b7280;">Time</td>
          <td style="padding:8px 0;font-size:13px;color:#374151;">${timestamp}</td>
        </tr>
      </table>

      <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Summary</h3>
        <pre style="margin:0;font-size:13px;line-height:1.6;color:#1f2937;white-space:pre-wrap;word-break:break-word;font-family:inherit;">${escapeHtml(summary)}</pre>
      </div>

      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
        This incident was auto-created by the Materio Health Monitor based on clustered bug reports.
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `[Materio Incident] ${name}\nSeverity: ${severity}\nAffected: ${affectedAreas.join(', ')}\nReports: ${reportCount}\n\n${summary}`;

  try {
    const info = await transporter.sendMail({
      from: `"Materio Health Monitor" <${SMTP_EMAIL}>`,
      to: ALERT_EMAIL,
      subject,
      text,
      html,
    });

    console.log(`[Mailer] Incident email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Mailer] Failed to send incident email:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send a generic alert/notification email.
 *
 * @param {Object} opts
 * @param {string} opts.to - recipient (defaults to ALERT_EMAIL)
 * @param {string} opts.subject
 * @param {string} opts.text - plain text body
 * @param {string} [opts.html] - optional HTML body
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendAlertEmail({ to, subject, text, html }) {
  const transporter = getTransporter();
  if (!transporter) {
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Materio Alerts" <${SMTP_EMAIL}>`,
      to: to || ALERT_EMAIL,
      subject,
      text,
      html: html || undefined,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Mailer] Alert email failed:', err.message);
    return { success: false, error: err.message };
  }
}

// --- HTML escaping ---
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  sendIncidentEmail,
  sendAlertEmail,
  ALERT_EMAIL,
};
