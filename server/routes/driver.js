import express from 'express'
import { getDb } from '../services/database.js'
import crypto from 'crypto'

const router = express.Router()

// Get driver tasks
router.get('/:lineUserId/tasks', (req, res) => {
  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE line_user_id = ?').get(req.params.lineUserId)

  if (!user || user.role !== 'DRIVER') {
    return res.status(403).json({ success: false, error: 'Not a driver' })
  }

  const driver = db.prepare('SELECT * FROM drivers WHERE user_id = ?').get(user.id)
  if (!driver) {
    return res.json({ success: true, data: [] })
  }

  const tasks = db.prepare(`
    SELECT b.*, u.name as customer_name, u.phone as customer_phone
    FROM bookings b
    LEFT JOIN users u ON b.customer_id = u.id
    WHERE b.driver_id = ?
    AND b.status IN ('ASSIGNED', 'CONFIRMED', 'STARTING')
    AND b.pickup_time > datetime('now', '-1 hour')
    ORDER BY b.pickup_time ASC
  `).all(driver.id)

  res.json({ success: true, data: tasks })
})

// Toggle driver status (online/offline)
router.post('/toggle-status', (req, res) => {
  const db = getDb()
  const { line_user_id } = req.body

  const user = db.prepare('SELECT * FROM users WHERE line_user_id = ?').get(line_user_id)
  if (!user || user.role !== 'DRIVER') {
    return res.status(403).json({ success: false, error: 'Not a driver' })
  }

  const driver = db.prepare('SELECT * FROM drivers WHERE user_id = ?').get(user.id)
  if (!driver) {
    return res.status(404).json({ success: false, error: 'Driver not found' })
  }

  const newStatus = driver.status === 'OFFLINE' ? 'AVAILABLE' : 'OFFLINE'
  db.prepare('UPDATE drivers SET status = ? WHERE user_id = ?').run(newStatus, user.id)

  res.json({ success: true, status: newStatus })
})

// Bind Telegram
router.post('/bind-telegram', (req, res) => {
  const db = getDb()
  const { line_user_id, telegram_chat_id } = req.body

  const user = db.prepare('SELECT * FROM users WHERE line_user_id = ?').get(line_user_id)
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' })
  }

  db.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(telegram_chat_id, user.id)

  res.json({ success: true })
})

// Accept task
router.post('/task/:bookingId/accept', async (req, res) => {
  const db = getDb()
  const { bookingId } = req.params
  const { driver_id } = req.body

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId)
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' })
  }

  db.prepare('UPDATE bookings SET status = ?, is_confirmed = 0 WHERE id = ?').run('CONFIRMED', bookingId)

  res.json({ success: true })
})

// Reject task
router.post('/task/:bookingId/reject', (req, res) => {
  const db = getDb()
  const { bookingId } = req.params
  const { driver_id, reason } = req.body

  db.prepare('UPDATE bookings SET driver_id = NULL, status = ? WHERE id = ?').run('PENDING', bookingId)

  db.prepare('INSERT INTO operation_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)')
    .run(driver_id, 'REJECT_TASK', 'booking', bookingId, reason || '司機拒絕任務')

  res.json({ success: true })
})

// Confirm start (departure)
router.post('/task/:bookingId/confirm-start', (req, res) => {
  const db = getDb()
  const { bookingId } = req.params
  const { driver_id } = req.body

  const now = new Date().toISOString()
  db.prepare('UPDATE bookings SET status = ?, is_confirmed = 1, confirmed_at = ? WHERE id = ?')
    .run('STARTING', now, bookingId)

  db.prepare('INSERT INTO operation_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)')
    .run(driver_id, 'CONFIRM_START', 'booking', bookingId, now)

  res.json({ success: true })
})

// Complete task
router.post('/task/:bookingId/complete', (req, res) => {
  const db = getDb()
  const { bookingId } = req.params
  const { driver_id, actual_fare } = req.body

  db.prepare('UPDATE bookings SET status = ?, actual_fare = ? WHERE id = ?')
    .run('COMPLETED', actual_fare || null, bookingId)

  db.prepare('UPDATE drivers SET total_rides = total_rides + 1 WHERE id = ?').run(driver_id)

  db.prepare('INSERT INTO operation_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)')
    .run(driver_id, 'COMPLETE', 'booking', bookingId, actual_fare ? `實際車資: ${actual_fare}` : '')

  res.json({ success: true })
})

export default router
