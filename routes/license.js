const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../database');
const { verifyAdminToken } = require('../middleware/auth');

const router = express.Router();

// Generate license key in format XXXX-XXXX-XXXX-XXXX
const generateLicenseKey = () => {
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
};

// Validate license key format
const isValidLicenseFormat = (key) => {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key);
};

// POST /api/license/validate - Validate license key + hardware ID
router.post('/validate', (req, res) => {
  const { licenseKey, hardwareId } = req.body;

  if (!licenseKey || !hardwareId) {
    return res.status(400).json({
      valid: false,
      error: 'License key and hardware ID required'
    });
  }

  if (!isValidLicenseFormat(licenseKey)) {
    return res.status(400).json({
      valid: false,
      error: 'Invalid license key format'
    });
  }

  const license = db.getLicenseByKey(licenseKey);

  if (!license) {
    return res.status(404).json({
      valid: false,
      error: 'License not found'
    });
  }

  if (!license.is_active) {
    return res.status(403).json({
      valid: false,
      error: 'License has been deactivated'
    });
  }

  // Check expiration
  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return res.status(403).json({
      valid: false,
      error: 'License has expired'
    });
  }

  // Check hardware binding
  if (license.hardware_id && license.hardware_id !== hardwareId) {
    return res.status(403).json({
      valid: false,
      error: 'License is bound to a different device'
    });
  }

  // Bind hardware ID if not already bound
  if (!license.hardware_id) {
    db.bindHardwareId(licenseKey, hardwareId);
  } else {
    db.updateLastValidated(licenseKey);
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      licenseKey,
      hardwareId,
      tier: license.tier,
      ownerEmail: license.owner_email
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRY }
  );

  res.json({
    valid: true,
    token,
    tier: license.tier,
    expiresIn: config.JWT_EXPIRY
  });
});

// POST /api/license/create - Create new license (admin only)
router.post('/create', verifyAdminToken, (req, res) => {
  const { tier, ownerEmail, ownerName, expiresAt, customKey } = req.body;

  if (!tier || !config.LICENSE_TIERS.includes(tier)) {
    return res.status(400).json({
      error: `Invalid tier. Must be one of: ${config.LICENSE_TIERS.join(', ')}`
    });
  }

  let licenseKey = customKey || generateLicenseKey();

  // Validate custom key format if provided
  if (customKey && !isValidLicenseFormat(customKey)) {
    return res.status(400).json({
      error: 'Invalid custom license key format. Must be XXXX-XXXX-XXXX-XXXX'
    });
  }

  // Ensure unique key
  let attempts = 0;
  while (!customKey && db.getLicenseByKey(licenseKey) && attempts < 10) {
    licenseKey = generateLicenseKey();
    attempts++;
  }

  if (db.getLicenseByKey(licenseKey)) {
    return res.status(409).json({ error: 'License key already exists' });
  }

  try {
    db.createLicense(licenseKey, tier, ownerEmail || null, ownerName || null, expiresAt || null);

    res.status(201).json({
      success: true,
      license: {
        licenseKey,
        tier,
        ownerEmail,
        ownerName,
        expiresAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create license' });
  }
});

// GET /api/license/list - List all licenses (admin only)
router.get('/list', verifyAdminToken, (req, res) => {
  const licenses = db.listLicenses();

  res.json({
    count: licenses.length,
    licenses: licenses.map(l => ({
      id: l.id,
      licenseKey: l.license_key,
      tier: l.tier,
      ownerEmail: l.owner_email,
      ownerName: l.owner_name,
      isActive: !!l.is_active,
      hardwareId: l.hardware_id,
      createdAt: l.created_at,
      lastValidatedAt: l.last_validated_at,
      expiresAt: l.expires_at
    }))
  });
});

// POST /api/license/deactivate - Deactivate license (admin only)
router.post('/deactivate', verifyAdminToken, (req, res) => {
  const { licenseKey } = req.body;

  if (!licenseKey) {
    return res.status(400).json({ error: 'License key required' });
  }

  const license = db.getLicenseByKey(licenseKey);
  if (!license) {
    return res.status(404).json({ error: 'License not found' });
  }

  db.deactivateLicense(licenseKey);
  res.json({ success: true, message: 'License deactivated' });
});

// POST /api/license/activate - Activate license (admin only)
router.post('/activate', verifyAdminToken, (req, res) => {
  const { licenseKey } = req.body;

  if (!licenseKey) {
    return res.status(400).json({ error: 'License key required' });
  }

  const license = db.getLicenseByKey(licenseKey);
  if (!license) {
    return res.status(404).json({ error: 'License not found' });
  }

  db.activateLicense(licenseKey);
  res.json({ success: true, message: 'License activated' });
});

// POST /api/license/reset-hardware - Reset hardware binding (admin only)
router.post('/reset-hardware', verifyAdminToken, (req, res) => {
  const { licenseKey } = req.body;

  if (!licenseKey) {
    return res.status(400).json({ error: 'License key required' });
  }

  const license = db.getLicenseByKey(licenseKey);
  if (!license) {
    return res.status(404).json({ error: 'License not found' });
  }

  db.resetHardwareId(licenseKey);
  res.json({ success: true, message: 'Hardware binding reset' });
});

module.exports = router;
