/**
 * Materio SMTP Mailer Utility
 * Sends incident, alert, and OTP emails via Gmail SMTP using nodemailer.
 *
 * Environment variables:
 *   SMTP_EMAIL     - Gmail address (e.g. materioappdesk@gmail.com)
 *   SMTP_PASSWORD  - Gmail App Password (16-char code from Google)
 *   ALERT_EMAIL    - Recipient for incident alerts (defaults to SMTP_EMAIL)
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

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
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return _transporter;
}

// --- Status/Severity mapping ---
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
 * Send an incident alert email.
 */
async function sendIncidentEmail(incidentData) {
  const transporter = getTransporter();
  if (!transporter) return { success: false, error: 'SMTP not configured' };

  const { name, summary, severity, affectedAreas, reportCount, aiGenerated } = incidentData;
  const color = SEVERITY_COLORS[severity] || '#6B7280';
  const emoji = SEVERITY_EMOJI[severity] || '⚪';
  const timestamp = new Date().toISOString();
  const LOGO_URL = 'https://materioa.vercel.app/assets/img/materio.png';
  const subject = `${emoji} [Materio Incident] ${name}`;

  const text = [
    `${emoji} AUTO-INCIDENT CREATED`,
    `Incident: ${name}`,
    `Severity: ${severity.toUpperCase()}`,
    `Affected Areas: ${affectedAreas.join(', ')}`,
    `Reports: ${reportCount} clustered reports`,
    `Time: ${timestamp}`,
    aiGenerated ? `Summary: AI-generated` : `Summary: Deterministic fallback`,
    ``,
    `--- SUMMARY ---`,
    summary,
  ].join('\n');

  const SEVERITY_HEADER_BG = {
    critical: 'rgba(220, 38, 38, 0.15)',
    major: 'rgba(234, 88, 12, 0.15)',
    minor: 'rgba(202, 138, 4, 0.15)',
    cosmetic: 'rgba(107, 114, 128, 0.15)',
  };

  const headerBg = SEVERITY_HEADER_BG[severity] || 'rgba(107, 114, 128, 0.15)';
  const formattedDate = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) + ' IST';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet"><style>body { margin: 0; padding: 20px; background: #ffffff; font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }</style></head>
<body>
  <div style="max-width:600px;margin:24px auto;">
    <div style="margin-bottom:24px;"><img src="${LOGO_URL}" alt="materio." width="180" height="38" style="display:block;" /></div>
    <div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;padding:24px;">
      <div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:${headerBg};padding:16px 20px;">
          <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;line-height:1.4;color:#1f2937;">${escapeHtml(name.replace(/\[Auto\] /, ''))}</h2>
          <div style="font-size:13px;"><span style="color:${color};font-weight:600;">Incident created</span><span style="color:#6b7280;margin-left:12px;">Started ${formattedDate}</span></div>
        </div>
        <div style="padding:16px 20px;font-size:14px;line-height:1.8;color:#1f2937;background:#fff;">
          <div><strong>Severity</strong> : <span style="color:${color};font-weight:600;">${severity.charAt(0).toUpperCase() + severity.slice(1)}</span></div>
          <div><strong>Affected Areas:</strong> ${escapeHtml(affectedAreas.join(', '))}</div>
          <div><strong>Reports:</strong> ${reportCount} clustered reports</div>
        </div>
      </div>
      <div style="background:#fafafa;padding:16px 20px;margin-bottom:24px;border-radius:12px;border:1px solid #e5e7eb;">
        <h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1f2937;">Summary</h3>
        <div style="font-size:13px;line-height:1.7;color:#4b5563;">${escapeHtml(summary).replace(/\n/g, '<br>')}</div>
      </div>
      <div style="text-align:center;font-size:12px;color:#9ca3af;">This incident is auto generated by Materio's incident reporting system.</div>
    </div>
  </div>
</body>
</html>`;

  try {
    const info = await transporter.sendMail({
      from: `"Materio Health Monitor" <${SMTP_EMAIL}>`,
      to: ALERT_EMAIL,
      subject,
      text,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Mailer] Incident email failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send a generic alert email.
 */
async function sendAlertEmail({ to, subject, text, html }) {
  const transporter = getTransporter();
  if (!transporter) return { success: false, error: 'SMTP not configured' };

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

/**
 * Send a branded OTP email with CID images.
 */
async function sendOTPEmail({ to, otp, type, html }) {
  const transporter = getTransporter();
  if (!transporter) return { success: false, error: 'SMTP not configured' };

  const subject = type === 'signup'
    ? `Your Signup Verification Code: ${otp}`
    : `Your Account Recovery Code: ${otp}`;

  const stickerPath = path.join(process.cwd(), 'assets', 'img', 'sticker.png');
  const attachments = [];

  if (fs.existsSync(stickerPath)) {
    attachments.push({
      filename: 'sticker.png',
      path: stickerPath,
      cid: 'sticker'
    });
  }

  try {
    const info = await transporter.sendMail({
      from: `"Materio" <${SMTP_EMAIL}>`,
      to,
      subject,
      html,
      attachments
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Mailer] OTP email failed:', err.message);
    return { success: false, error: err.message };
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = {
  sendIncidentEmail,
  sendAlertEmail,
  sendOTPEmail,
  ALERT_EMAIL,
};
