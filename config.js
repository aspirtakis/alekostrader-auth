const bcrypt = require('bcryptjs');

// Admin password hash for "AlekosAdmin2024!"
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('AlekosAdmin2024!', 10);

// Tier pricing in EUR
const TIER_PRICES = {
  viewer: 29,       // Dashboard + portfolio only
  starter: 90,      // 1 bot, 1 exchange
  basic: 120,       // 2 bots, 1 exchange
  pro: 250,         // 5 bots, 2 exchanges (includes Pi 5 8GB)
  unlimited: 400    // Unlimited bots, 5 exchanges (needs server)
};

// ALK Token configuration
const ALK_TOKEN = {
  mint: 'FD2imiDmjYDrh4A66JWKLvrrSLXvZh5Jep1Kx67Z6WXu',
  decimals: 6,
  treasuryWallet: process.env.ALK_TREASURY_WALLET || '',
  // ALK prices per tier (1 ALK ≈ $0.01, prices in USD equivalent x100)
  prices: {
    viewer: 3000,     // ~$30
    starter: 10000,   // ~$100
    basic: 13000,     // ~$130
    pro: 27500,       // ~$275
    unlimited: 44000  // ~$440
  }
};

module.exports = {
  PORT: process.env.PORT || 3002,
  JWT_SECRET: process.env.JWT_SECRET || 'alekos-license-secret-key-change-in-production',
  JWT_EXPIRY: '30m',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD_HASH,
  CORS_ORIGINS: [
    'https://alekos.devsoundfusion.com',
    'https://alekosbot.com',
    'https://www.alekosbot.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173'
  ],
  LICENSE_TIERS: ['viewer', 'starter', 'basic', 'pro', 'unlimited'],
  DATABASE_PATH: './licenses.db',

  // Pricing
  TIER_PRICES,
  ALK_TOKEN,

  // PayPal configuration
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID || '',
  PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET || '',
  PAYPAL_MODE: process.env.PAYPAL_MODE || 'sandbox',

  // Email configuration (Migadu SMTP)
  EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.migadu.com',
  EMAIL_PORT: process.env.EMAIL_PORT || 465,
  EMAIL_USER: process.env.EMAIL_USER || 'info@alekosbot.com',
  EMAIL_PASS: process.env.EMAIL_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'info@alekosbot.com',

  // Solana RPC
  SOLANA_RPC: process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com'
};
