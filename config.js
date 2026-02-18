const bcrypt = require('bcryptjs');

// Admin password hash for "AlekosAdmin2024!"
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('AlekosAdmin2024!', 10);

// Tier pricing in EUR
const TIER_PRICES = {
  trader: 180,
  pro: 250,
  enterprise: 800
};

// Hardware add-on price
const HARDWARE_ADDON_PRICE = 150;

module.exports = {
  PORT: process.env.PORT || 3002,
  JWT_SECRET: process.env.JWT_SECRET || 'alekos-license-secret-key-change-in-production',
  JWT_EXPIRY: '30m',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD_HASH,
  CORS_ORIGINS: [
    'https://alekos.devsoundfusion.com',
    'https://alekosbot.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173'
  ],
  LICENSE_TIERS: ['trader', 'pro', 'enterprise'],
  DATABASE_PATH: './licenses.db',

  // Pricing
  TIER_PRICES,
  HARDWARE_ADDON_PRICE,

  // PayPal configuration
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID || '',
  PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET || '',
  PAYPAL_MODE: process.env.PAYPAL_MODE || 'sandbox', // 'sandbox' or 'live'

  // Email configuration (Migadu SMTP)
  EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.migadu.com',
  EMAIL_PORT: process.env.EMAIL_PORT || 465,
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASS: process.env.EMAIL_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@alekosbot.com'
};
