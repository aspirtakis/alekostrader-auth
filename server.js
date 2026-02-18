const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const authRoutes = require('./routes/auth');
const licenseRoutes = require('./routes/license');
const checkoutRoutes = require('./routes/checkout');

const app = express();

// CORS configuration
app.use(cors({
  origin: config.CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'alekostrader-auth'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/checkout', checkoutRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(config.PORT, () => {
  console.log(`AlekosTrader Auth Server running on port ${config.PORT}`);
  console.log(`Health check: http://localhost:${config.PORT}/api/health`);
});
