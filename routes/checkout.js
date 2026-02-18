const express = require('express');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../database');
const { sendLicenseEmail } = require('../services/email');

const router = express.Router();

// PayPal SDK
let paypalClient = null;
let OrdersController = null;

// Initialize PayPal client
function initPayPal() {
  if (!config.PAYPAL_CLIENT_ID || !config.PAYPAL_CLIENT_SECRET) {
    console.log('PayPal not configured');
    return false;
  }

  try {
    const { Client, Environment, LogLevel, OrdersController: OC } = require('@paypal/paypal-server-sdk');

    const environment = config.PAYPAL_MODE === 'live'
      ? Environment.Production
      : Environment.Sandbox;

    paypalClient = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: config.PAYPAL_CLIENT_ID,
        oAuthClientSecret: config.PAYPAL_CLIENT_SECRET
      },
      environment,
      logging: {
        logLevel: LogLevel.Info,
        logRequest: { logBody: false },
        logResponse: { logHeaders: false }
      }
    });

    OrdersController = new OC(paypalClient);
    console.log('PayPal initialized in', config.PAYPAL_MODE, 'mode');
    return true;
  } catch (error) {
    console.error('PayPal initialization failed:', error);
    return false;
  }
}

// Initialize on module load
initPayPal();

// Generate license key
function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [];
  for (let i = 0; i < 4; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return segments.join('-');
}

// Calculate price
function calculatePrice(tier, includeHardware = false) {
  const basePrice = config.TIER_PRICES[tier] || 0;
  const hardwarePrice = includeHardware ? config.HARDWARE_ADDON_PRICE : 0;
  return basePrice + hardwarePrice;
}

// GET /api/checkout/prices - Get current pricing
router.get('/prices', (req, res) => {
  res.json({
    tiers: config.TIER_PRICES,
    hardwareAddon: config.HARDWARE_ADDON_PRICE,
    currency: 'EUR'
  });
});

// POST /api/checkout/create-order - Create PayPal order
router.post('/create-order', async (req, res) => {
  const { tier, includeHardware, customerEmail, customerName } = req.body;

  // Validate tier
  if (!tier || !config.LICENSE_TIERS.includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  if (!customerEmail) {
    return res.status(400).json({ error: 'Customer email required' });
  }

  // Check PayPal configured
  if (!OrdersController) {
    // For testing without PayPal - create a test order
    const orderId = 'TEST-' + uuidv4().substring(0, 8).toUpperCase();
    const totalPrice = calculatePrice(tier, includeHardware);

    return res.json({
      orderId,
      tier,
      includeHardware: !!includeHardware,
      customerEmail,
      customerName,
      totalPrice,
      currency: 'EUR',
      testMode: true,
      message: 'PayPal not configured - test mode enabled'
    });
  }

  try {
    const totalPrice = calculatePrice(tier, includeHardware);
    const tierNames = { trader: 'Trader', pro: 'Pro Trader', enterprise: 'Enterprise' };

    const orderRequest = {
      body: {
        intent: 'CAPTURE',
        purchaseUnits: [{
          referenceId: uuidv4(),
          description: `AlekosTrader ${tierNames[tier]} License${includeHardware ? ' + Raspberry Pi Kit' : ''}`,
          amount: {
            currencyCode: 'EUR',
            value: totalPrice.toFixed(2),
            breakdown: {
              itemTotal: { currencyCode: 'EUR', value: totalPrice.toFixed(2) }
            }
          },
          items: [
            {
              name: `AlekosTrader ${tierNames[tier]} License`,
              description: '1 Year License',
              unitAmount: { currencyCode: 'EUR', value: config.TIER_PRICES[tier].toFixed(2) },
              quantity: '1',
              category: 'DIGITAL_GOODS'
            },
            ...(includeHardware ? [{
              name: 'Raspberry Pi 4 Kit',
              description: 'Pre-configured trading hardware',
              unitAmount: { currencyCode: 'EUR', value: config.HARDWARE_ADDON_PRICE.toFixed(2) },
              quantity: '1',
              category: 'PHYSICAL_GOODS'
            }] : [])
          ]
        }],
        applicationContext: {
          brandName: 'AlekosTrader',
          landingPage: 'NO_PREFERENCE',
          userAction: 'PAY_NOW',
          returnUrl: 'https://alekosbot.com/checkout/success',
          cancelUrl: 'https://alekosbot.com/checkout/cancel'
        }
      },
      prefer: 'return=representation'
    };

    const response = await OrdersController.createOrder(orderRequest);
    const order = response.result;

    // Store order metadata
    db.createOrder(order.id, tier, includeHardware, customerEmail, customerName, totalPrice);

    res.json({
      orderId: order.id,
      status: order.status,
      tier,
      includeHardware: !!includeHardware,
      customerEmail,
      totalPrice,
      currency: 'EUR',
      approveUrl: order.links?.find(l => l.rel === 'approve')?.href
    });
  } catch (error) {
    console.error('PayPal create order error:', error);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
});

// POST /api/checkout/capture-order - Capture payment and create license
router.post('/capture-order', async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: 'Order ID required' });
  }

  // Handle test orders (without PayPal)
  if (orderId.startsWith('TEST-')) {
    const { tier, customerEmail, customerName } = req.body;

    if (!tier || !customerEmail) {
      return res.status(400).json({ error: 'Tier and email required for test orders' });
    }

    // Generate license
    const licenseKey = generateLicenseKey();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    const expiresAtStr = expiresAt.toISOString();

    // Create license in database
    db.createLicense(licenseKey, tier, customerEmail, customerName || null, expiresAtStr, config.TIER_PRICES[tier]);

    // Send email
    const emailResult = await sendLicenseEmail(
      customerEmail,
      customerName,
      licenseKey,
      tier,
      expiresAtStr,
      orderId
    );

    return res.json({
      success: true,
      testMode: true,
      orderId,
      licenseKey,
      tier,
      customerEmail,
      expiresAt: expiresAtStr,
      emailSent: emailResult.success
    });
  }

  // Check PayPal configured
  if (!OrdersController) {
    return res.status(500).json({ error: 'PayPal not configured' });
  }

  try {
    // Capture the payment
    const response = await OrdersController.captureOrder({
      id: orderId,
      prefer: 'return=representation'
    });

    const capturedOrder = response.result;

    if (capturedOrder.status !== 'COMPLETED') {
      return res.status(400).json({
        error: 'Payment not completed',
        status: capturedOrder.status
      });
    }

    // Get order details from our database
    const orderData = db.getOrder(orderId);
    if (!orderData) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Generate license
    const licenseKey = generateLicenseKey();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    const expiresAtStr = expiresAt.toISOString();

    // Create license
    db.createLicense(
      licenseKey,
      orderData.tier,
      orderData.customer_email,
      orderData.customer_name,
      expiresAtStr,
      orderData.total_amount
    );

    // Update order with license key
    db.completeOrder(orderId, licenseKey, capturedOrder.id);

    // Send confirmation email
    const emailResult = await sendLicenseEmail(
      orderData.customer_email,
      orderData.customer_name,
      licenseKey,
      orderData.tier,
      expiresAtStr,
      orderId
    );

    res.json({
      success: true,
      orderId,
      paypalTransactionId: capturedOrder.purchase_units?.[0]?.payments?.captures?.[0]?.id,
      licenseKey,
      tier: orderData.tier,
      customerEmail: orderData.customer_email,
      expiresAt: expiresAtStr,
      emailSent: emailResult.success
    });
  } catch (error) {
    console.error('PayPal capture error:', error);
    res.status(500).json({ error: 'Failed to capture payment', details: error.message });
  }
});

// POST /api/checkout/test-purchase - For testing without PayPal
router.post('/test-purchase', async (req, res) => {
  const { tier, customerEmail, customerName, includeHardware } = req.body;

  if (!tier || !config.LICENSE_TIERS.includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  if (!customerEmail) {
    return res.status(400).json({ error: 'Customer email required' });
  }

  const orderId = 'TEST-' + uuidv4().substring(0, 8).toUpperCase();
  const totalPrice = calculatePrice(tier, includeHardware);

  // Generate license
  const licenseKey = generateLicenseKey();
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  const expiresAtStr = expiresAt.toISOString();

  // Create license
  db.createLicense(licenseKey, tier, customerEmail, customerName || null, expiresAtStr, totalPrice);

  // Send email
  const emailResult = await sendLicenseEmail(
    customerEmail,
    customerName,
    licenseKey,
    tier,
    expiresAtStr,
    orderId
  );

  res.json({
    success: true,
    testMode: true,
    orderId,
    licenseKey,
    tier,
    totalPrice,
    currency: 'EUR',
    customerEmail,
    expiresAt: expiresAtStr,
    emailSent: emailResult.success
  });
});

module.exports = router;
