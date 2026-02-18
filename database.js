const Database = require('better-sqlite3');
const config = require('./config');

const db = new Database(config.DATABASE_PATH);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL CHECK(tier IN ('trader', 'pro', 'enterprise')),
    price REAL DEFAULT 0,
    hardware_id TEXT,
    owner_email TEXT,
    owner_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    last_validated_at TEXT,
    expires_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_license_key ON licenses(license_key);
  CREATE INDEX IF NOT EXISTS idx_hardware_id ON licenses(hardware_id);

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL,
    include_hardware INTEGER DEFAULT 0,
    customer_email TEXT NOT NULL,
    customer_name TEXT,
    total_amount REAL NOT NULL,
    currency TEXT DEFAULT 'EUR',
    status TEXT DEFAULT 'pending',
    license_key TEXT,
    paypal_transaction_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_order_id ON orders(order_id);
  CREATE INDEX IF NOT EXISTS idx_order_email ON orders(customer_email);
`);

// Add price column if not exists
try { db.exec("ALTER TABLE licenses ADD COLUMN price REAL DEFAULT 0"); } catch(e) {}

module.exports = {
  // Get license by key
  getLicenseByKey: (licenseKey) => {
    const stmt = db.prepare('SELECT * FROM licenses WHERE license_key = ?');
    return stmt.get(licenseKey);
  },

  // Get license by key and hardware ID
  getLicenseByKeyAndHardware: (licenseKey, hardwareId) => {
    const stmt = db.prepare('SELECT * FROM licenses WHERE license_key = ? AND (hardware_id IS NULL OR hardware_id = ?)');
    return stmt.get(licenseKey, hardwareId);
  },

  // Update hardware ID for license (first activation)
  bindHardwareId: (licenseKey, hardwareId) => {
    const now = new Date().toISOString();
    const stmt = db.prepare('UPDATE licenses SET hardware_id = ?, last_validated_at = ? WHERE license_key = ? AND hardware_id IS NULL');
    return stmt.run(hardwareId, now, licenseKey);
  },

  // Update last validated timestamp
  updateLastValidated: (licenseKey) => {
    const now = new Date().toISOString();
    const stmt = db.prepare('UPDATE licenses SET last_validated_at = ? WHERE license_key = ?');
    return stmt.run(now, licenseKey);
  },

  // Create new license
  createLicense: (licenseKey, tier, ownerEmail, ownerName, expiresAt, price = 0) => {
    const stmt = db.prepare(`
      INSERT INTO licenses (license_key, tier, owner_email, owner_name, expires_at, price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(licenseKey, tier, ownerEmail, ownerName, expiresAt, price);
  },

  // List all licenses
  listLicenses: () => {
    const stmt = db.prepare('SELECT * FROM licenses ORDER BY created_at DESC');
    return stmt.all();
  },

  // Deactivate license
  deactivateLicense: (licenseKey) => {
    const stmt = db.prepare('UPDATE licenses SET is_active = 0 WHERE license_key = ?');
    return stmt.run(licenseKey);
  },

  // Reactivate license
  activateLicense: (licenseKey) => {
    const stmt = db.prepare('UPDATE licenses SET is_active = 1 WHERE license_key = ?');
    return stmt.run(licenseKey);
  },

  // Reset hardware ID (allow re-binding)
  resetHardwareId: (licenseKey) => {
    const stmt = db.prepare('UPDATE licenses SET hardware_id = NULL WHERE license_key = ?');
    return stmt.run(licenseKey);
  },

  // Delete license
  deleteLicense: (licenseKey) => {
    const stmt = db.prepare('DELETE FROM licenses WHERE license_key = ?');
    return stmt.run(licenseKey);
  },

  // ========== ORDER FUNCTIONS ==========

  // Create new order
  createOrder: (orderId, tier, includeHardware, customerEmail, customerName, totalAmount) => {
    const stmt = db.prepare(`
      INSERT INTO orders (order_id, tier, include_hardware, customer_email, customer_name, total_amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(orderId, tier, includeHardware ? 1 : 0, customerEmail, customerName, totalAmount);
  },

  // Get order by ID
  getOrder: (orderId) => {
    const stmt = db.prepare('SELECT * FROM orders WHERE order_id = ?');
    return stmt.get(orderId);
  },

  // Complete order with license
  completeOrder: (orderId, licenseKey, paypalTransactionId) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE orders
      SET status = 'completed', license_key = ?, paypal_transaction_id = ?, completed_at = ?
      WHERE order_id = ?
    `);
    return stmt.run(licenseKey, paypalTransactionId, now, orderId);
  },

  // List all orders
  listOrders: () => {
    const stmt = db.prepare('SELECT * FROM orders ORDER BY created_at DESC');
    return stmt.all();
  },

  // Get orders by email
  getOrdersByEmail: (email) => {
    const stmt = db.prepare('SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC');
    return stmt.all(email);
  }
};
