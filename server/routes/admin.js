import express from 'express'
import { getDb } from '../services/database.js'

const router = express.Router()

// Get all bookings with filters
router.get('/bookings', (req, res) => {
  const db = getDb()
  const { status, date } = req.query

  let query = `
    SELECT b.*, u.name as customer_name, u.phone as customer_phone,
           d.name as driver_name, d.license_plate, d.vehicle_model
    FROM bookings b
    LEFT JOIN users u ON b.customer_id = u.id
    LEFT JOIN drivers dr ON b.driver_id = dr.id
    LEFT JOIN users d ON dr.user_id = d.id
    WHERE 1=1
  `
  const params = []

  if (status) {
    query += ' AND b.status = ?'
    params.push(status)
  }

  if (date) {
    query += ' AND DATE(b.pickup_time) = ?'
    params.push(date)
  }

  query += ' ORDER BY b.pickup_time ASC'

  const bookings = db.prepare(query).all(...params)
  res.json({ success: true, data: bookings })
})

// Get all drivers
router.get('/drivers', (req, res) => {
  const db = getDb()
  const drivers = db.prepare(`
    SELECT d.*, u.name, u.phone, u.line_user_id, u.telegram_chat_id
    FROM drivers d
    JOIN users u ON d.user_id = u.id
  `).all()

  res.json({ success: true, data: drivers })
})

// Assign driver to booking
router.post('/booking/:id/assign', async (req, res) => {
  const db = getDb()
  const { id } = req.params
  const { driver_id } = req.body

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id)
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' })
  }

  const driver = db.prepare('SELECT d.*, u.name, u.phone, u.telegram_chat_id FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?').get(driver_id)
  if (!driver) {
    return res.status(404).json({ success: false, error: 'Driver not found' })
  }

  db.prepare('UPDATE bookings SET driver_id = ?, status = ? WHERE id = ?')
    .run(driver_id, 'ASSIGNED', id)

  // Log operation
  db.prepare('INSERT INTO operation_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)')
    .run(driver.user_id, 'ASSIGN_DRIVER', 'booking', id, `指派司機: ${driver.name}`)

  res.json({ success: true })
})

// Get dashboard stats
router.get('/dashboard', (req, res) => {
  const db = getDb()

  const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

  const pendingBookings = db.prepare(`
    SELECT COUNT(*) as count FROM bookings
    WHERE status = 'PENDING' AND pickup_time BETWEEN datetime('now') AND ?
  `).get(twoHoursLater)

  const assignedBookings = db.prepare(`
    SELECT COUNT(*) as count FROM bookings
    WHERE status = 'ASSIGNED' AND pickup_time BETWEEN datetime('now') AND ?
  `).get(twoHoursLater)

  const confirmedBookings = db.prepare(`
    SELECT COUNT(*) as count FROM bookings
    WHERE status IN ('CONFIRMED', 'STARTING') AND pickup_time BETWEEN datetime('now') AND ?
  `).get(twoHoursLater)

  const onlineDrivers = db.prepare("SELECT COUNT(*) as count FROM drivers WHERE status = 'AVAILABLE'").get()
  const busyDrivers = db.prepare("SELECT COUNT(*) as count FROM drivers WHERE status = 'BUSY'").get()
  const offlineDrivers = db.prepare("SELECT COUNT(*) as count FROM drivers WHERE status = 'OFFLINE'").get()

  const unconfirmedBookings = db.prepare(`
    SELECT b.id, b.pickup_time, b.pickup_address, u.name as driver_name
    FROM bookings b
    JOIN drivers d ON b.driver_id = d.id
    JOIN users u ON d.user_id = u.id
    WHERE b.status = 'ASSIGNED' AND b.is_confirmed = 0
    AND datetime(b.pickup_time, '-15 minutes') < datetime('now')
  `).all()

  const unassignedBookings = db.prepare(`
    SELECT COUNT(*) as count FROM bookings
    WHERE status = 'PENDING' AND pickup_time < datetime('now', '+30 minutes')
  `).get()

  const alerts = [
    ...unconfirmedBookings.map(b => ({
      id: b.id,
      type: 'UNCONFIRMED',
      message: `司機 ${b.driver_name} 尚未確認出發`,
      booking_id: b.id,
      created_at: new Date().toISOString()
    })),
    ...(unassignedBookings.count > 0 ? [{
      id: 'alert_unassigned',
      type: 'UNASSIGNED',
      message: `有 ${unassignedBookings.count} 筆訂單未指派司機`,
      booking_id: null,
      created_at: new Date().toISOString()
    }] : [])
  ]

  res.json({
    success: true,
    data: {
      pendingBookings: pendingBookings.count,
      assignedBookings: assignedBookings.count,
      confirmedBookings: confirmedBookings.count,
      onlineDrivers: onlineDrivers.count,
      busyDrivers: busyDrivers.count,
      offlineDrivers: offlineDrivers.count,
      alerts
    }
  })
})

// Update settings
router.put('/settings', (req, res) => {
  const db = getDb()
  const { baseFare, pricePerKm, nightSurcharge } = req.body

  const updateSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  updateSetting.run('baseFare', baseFare.toString())
  updateSetting.run('pricePerKm', pricePerKm.toString())
  updateSetting.run('nightSurcharge', nightSurcharge.toString())

  res.json({ success: true })
})

// Get settings
router.get('/settings', (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM settings').all()
  const settings = {}
  rows.forEach(row => {
    settings[row.key] = row.value
  })

  res.json({ success: true, data: settings })
})

// Get operation logs
router.get('/operation-logs', (req, res) => {
  const db = getDb()
  const { user_id, date, limit = 100 } = req.query

  let query = 'SELECT * FROM operation_logs WHERE 1=1'
  const params = []

  if (user_id) {
    query += ' AND user_id = ?'
    params.push(user_id)
  }

  if (date) {
    query += ' AND DATE(created_at) = ?'
    params.push(date)
  }

  query += ' ORDER BY created_at DESC LIMIT ?'
  params.push(parseInt(limit))

  const logs = db.prepare(query).all(...params)
  res.json({ success: true, data: logs })
})

export default router