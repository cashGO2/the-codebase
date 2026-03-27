/**
 * Materio OTP Email Template
 * Includes sticker.png as a CID.
 */

function getOTPTemplate(otp, type, email) {
  const typeText = type === 'signup' ? 'Complete your Registration' : 'Recover your Account';
  const instruction = type === 'signup' 
    ? 'Use the verification code below to complete your Signup on Materio.' 
    : 'Use the verification code below to reset your account password.';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 20px; background: #ffffff; font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>
  <div style="max-width:500px;margin:24px auto;">
    <!-- Logo/Sticker -->
    <div style="margin-bottom:24px; text-align: center;">
      <img src="cid:sticker" alt="materio." width="140" style="display:block; margin: 0 auto;" />
    </div>
    
    <!-- Outer card container -->
    <div style="background:#fff;border-radius:24px;overflow:hidden;border:1px solid #f1f5f9;padding:32px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;line-height:1.4;color:#0f172a; text-align: center;">${typeText}</h2>
      <p style="text-align: center; color: #64748b; font-size: 14px; margin-bottom: 24px;">${instruction}</p>
      
      <div style="background:#f8fafc; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="font-family: 'Monospace', monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e293b;">${otp}</span>
      </div>
      
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-bottom: 0;">This code will expire in 10 minutes. <br>If you didn't request this, you can safely ignore this email.</p>
    </div>
    
    <!-- Footer -->
    <div style="text-align:center;font-size:11px;color:#cbd5e1; margin-top: 24px;">
      Sent to ${email} • Materio Account Services
    </div>
  </div>
</body>
</html>
`;
}

module.exports = { getOTPTemplate };
