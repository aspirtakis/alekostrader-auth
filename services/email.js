const nodemailer = require('nodemailer');
const config = require('../config');

// Create transporter
const transporter = nodemailer.createTransport({
  host: config.EMAIL_HOST,
  port: config.EMAIL_PORT,
  secure: true, // true for 465, false for other ports
  auth: {
    user: config.EMAIL_USER,
    pass: config.EMAIL_PASS
  }
});

// Check if email is configured
function isEmailConfigured() {
  return config.EMAIL_USER && config.EMAIL_PASS;
}

// Send license confirmation email
async function sendLicenseEmail(customerEmail, customerName, licenseKey, tier, expiresAt, orderId) {
  if (!isEmailConfigured()) {
    console.log('Email not configured, skipping email send');
    return { success: false, reason: 'not_configured' };
  }

  const tierNames = {
    trader: 'Trader',
    pro: 'Pro Trader',
    enterprise: 'Enterprise'
  };

  const tierName = tierNames[tier] || tier;
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; padding: 40px; }
    .logo { text-align: center; font-size: 32px; color: #00d4ff; margin-bottom: 20px; }
    h1 { color: #00d4ff; text-align: center; margin-bottom: 30px; }
    .license-box { background: rgba(0,212,255,0.1); border: 2px solid #00d4ff; border-radius: 12px; padding: 20px; text-align: center; margin: 30px 0; }
    .license-key { font-family: monospace; font-size: 24px; color: #00d4ff; letter-spacing: 2px; }
    .details { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 20px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .detail-row:last-child { border-bottom: none; }
    .label { color: #888; }
    .value { color: #fff; font-weight: 600; }
    .instructions { margin-top: 30px; padding: 20px; background: rgba(76,175,80,0.1); border-radius: 8px; border-left: 4px solid #4CAF50; }
    .footer { text-align: center; margin-top: 30px; color: #888; font-size: 14px; }
    a { color: #00d4ff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">&#128202; AlekosTrader</div>
    <h1>Your License is Ready!</h1>

    <p>Hello ${customerName || 'Trader'},</p>
    <p>Thank you for your purchase! Your AlekosTrader <strong>${tierName}</strong> license has been activated.</p>

    <div class="license-box">
      <div style="color:#888;margin-bottom:10px;">Your License Key</div>
      <div class="license-key">${licenseKey}</div>
    </div>

    <div class="details">
      <div class="detail-row">
        <span class="label">Plan</span>
        <span class="value">${tierName}</span>
      </div>
      <div class="detail-row">
        <span class="label">Order ID</span>
        <span class="value">${orderId}</span>
      </div>
      <div class="detail-row">
        <span class="label">Valid Until</span>
        <span class="value">${expiryDate}</span>
      </div>
      <div class="detail-row">
        <span class="label">Hardware Binding</span>
        <span class="value">License binds to first device activated</span>
      </div>
    </div>

    <div class="instructions">
      <strong>Getting Started:</strong>
      <ol style="margin-top:10px;padding-left:20px;">
        <li>Download AlekosTrader from <a href="https://alekosbot.com">alekosbot.com</a></li>
        <li>Launch the application and enter your license key</li>
        <li>Your license will bind to your device on first activation</li>
        <li>Start creating your trading strategies!</li>
      </ol>
    </div>

    <div class="footer">
      <p>Need help? Contact us at <a href="mailto:support@alekosbot.com">support@alekosbot.com</a></p>
      <p>&copy; ${new Date().getFullYear()} AlekosTrader. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `
AlekosTrader - Your License is Ready!

Hello ${customerName || 'Trader'},

Thank you for your purchase! Your AlekosTrader ${tierName} license has been activated.

YOUR LICENSE KEY: ${licenseKey}

Details:
- Plan: ${tierName}
- Order ID: ${orderId}
- Valid Until: ${expiryDate}

Getting Started:
1. Download AlekosTrader from https://alekosbot.com
2. Launch the application and enter your license key
3. Your license will bind to your device on first activation
4. Start creating your trading strategies!

Need help? Contact us at support@alekosbot.com

© ${new Date().getFullYear()} AlekosTrader. All rights reserved.
  `;

  try {
    const info = await transporter.sendMail({
      from: `"AlekosTrader" <${config.EMAIL_FROM}>`,
      to: customerEmail,
      subject: `Your AlekosTrader ${tierName} License - Order ${orderId}`,
      text: textContent,
      html: htmlContent
    });

    console.log('License email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendLicenseEmail,
  isEmailConfigured
};
