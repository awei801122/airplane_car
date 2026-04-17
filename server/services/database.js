import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DATABASE_PATH || './data/yjova.db'

let db = null

export function getDb() {
  if (!db) {
    const dbDir = path.dirname(DB_PATH)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function initDatabase() {
  const db = getDb()

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      line_user_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT CHECK(role IN ('CUSTOMER', 'DRIVER', 'ADMIN')) NOT NULL,
      telegram_chat_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Drivers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      license_plate TEXT NOT NULL,
      vehicle_model TEXT NOT NULL,
      vehicle_photo_url TEXT,
      rating REAL DEFAULT 5.0,
      total_rides INTEGER DEFAULT 0,
      status TEXT CHECK(status IN ('AVAILABLE', 'BUSY', 'OFFLINE')) DEFAULT 'OFFLINE',
      is_confirmed INTEGER DEFAULT 0,
      confirmed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  // Bookings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      driver_id TEXT,
      pickup_address TEXT NOT NULL,
      dropoff_address TEXT NOT NULL,
      pickup_time DATETIME NOT NULL,
      passenger_count INTEGER DEFAULT 1,
      luggage_count INTEGER DEFAULT 0,
      flight_number TEXT,
      notes TEXT,
      estimated_fare REAL NOT NULL,
      actual_fare REAL,
      payment_status TEXT CHECK(payment_status IN ('UNPAID', 'DEPOSIT_PAID', 'PAID', 'REFUNDED')) DEFAULT 'UNPAID',
      deposit_amount REAL DEFAULT 300,
      payment_method TEXT,
      booking_type TEXT CHECK(booking_type IN ('IMMEDIATE', 'SCHEDULED')) DEFAULT 'SCHEDULED',
      category TEXT CHECK(category IN ('GENERAL', 'AIRPORT')) DEFAULT 'AIRPORT',
      status TEXT CHECK(status IN ('PENDING', 'ASSIGNED', 'CONFIRMED', 'STARTING', 'COMPLETED', 'CANCELLED')) DEFAULT 'PENDING',
      reply_token TEXT,
      reply_token_expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      cancelled_at DATETIME,
      cancel_reason TEXT,
      FOREIGN KEY (customer_id) REFERENCES users(id),
      FOREIGN KEY (driver_id) REFERENCES drivers(id)
    )
  `)

  // Notification log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      channel TEXT CHECK(channel IN ('LINE_REPLY', 'LINE_PUSH', 'TELEGRAM')) NOT NULL,
      content TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  // Operation logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  // Insert default settings
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  insertSetting.run('baseFare', '150')
  insertSetting.run('pricePerKm', '25')
  insertSetting.run('nightSurcharge', '20')

  console.log('Database initialized successfully')
  return db
}

export default { getDb, initDatabase }