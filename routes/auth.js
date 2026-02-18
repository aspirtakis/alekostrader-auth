const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');

const router = express.Router();

// POST /api/auth/login - Admin login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (username !== config.ADMIN_USERNAME) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValidPassword = bcrypt.compareSync(password, config.ADMIN_PASSWORD_HASH);

  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    {
      username: config.ADMIN_USERNAME,
      isAdmin: true
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRY }
  );

  res.json({
    success: true,
    token,
    expiresIn: config.JWT_EXPIRY
  });
});

module.exports = router;
