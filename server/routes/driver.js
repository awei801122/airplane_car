import express from 'express'
import { getDb } from '../services/database.js'
import { sendToAdmin } from '../services/telegramService.js'
import { replyMessage, createTextMessage, createDriverCard } from '../services/lineService.js'
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
  const { driver_id, line_user_id } = req.body

  // Get driver info
  const driver = db.prepare('SELECT d.*, u.name, u.phone, u.telegram_chat_id FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?').get(driver_id)

  // Get booking
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId)
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' })
  }

  // Update booking status
  db.prepare('UPDATE bookings SET status = ?, driver_id = ?, is_confirmed = 0 WHERE id = ?')
    .run('CONFIRMED', driver_id, bookingId)

  // Update driver status to BUSY
  db.prepare('UPDATE drivers SET status = ? WHERE id = ?').run('BUSY', driver_id)

  // Notify admin
  await sendToAdmin(`✅ 司機 ${driver?.name || '司機'} 已承接任務 #${bookingId.slice(-4)}`)

  // Send driver card to customer
  if (booking.reply_token && driver) {
    const flexMessage = {
      type: 'flex',
      altText: '司機已派任',
      contents: {
        type: 'bubble',
        ...createDriverCard(
          { name: driver.name, license_plate: driver.license_plate, vehicle_model: driver.vehicle_model, phone: driver.phone },
          booking
        )
      }
    }
    await replyMessage(booking.reply_token, [flexMessage])
  }

  res.json({ success: true })
})

// Reject task
router.post('/task/:bookingId/reject', async (req, res) => {
  const db = getDb()
  const { bookingId } = req.params
  const { driver_id, reason } = req.body

  // Get driver name
  const driver = db.prepare('SELECT u.name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?').get(driver_id)

  // Reset booking to PENDING
  db.prepare('UPDATE bookings SET driver_id = NULL, status = ? WHERE id = ?').run('PENDING', bookingId)

  // Log
  db.prepare('INSERT INTO operation_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)')
    .run(driver_id, 'REJECT_TASK', 'booking', bookingId, reason || '司機拒絕任務')

  // Notify admin
  await sendToAdmin(`⚠️ 司機 ${driver?.name || '未知'} 拒絕任務 #${bookingId.slice(-4)}，請重新指派`)

  res.json({ success: true })
})

// Confirm start (departure)
router.post('/task/:bookingId/confirm-start', async (req, res) => {
  const db = getDb()
  const { bookingId } = req.params
  const { driver_id } = req.body

  const now = new Date().toISOString()
  db.prepare('UPDATE bookings SET status = ?, is_confirmed = 1, confirmed_at = ? WHERE id = ?')
    .run('STARTING', now, bookingId)

  // Get driver name
  const driver = db.prepare('SELECT u.name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?').get(driver_id)

  // Notify admin
  await sendToAdmin(`🚕 ${driver?.name || '司機'} 已確認出發，預約 #${bookingId.slice(-4)}`)

  db.prepare('INSERT INTO operation_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)')
    .run(driver_id, 'CONFIRM_START', 'booking', bookingId, now)

  res.json({ success: true })
})

// Complete task
router.post('/task/:bookingId/complete', async (req, res) => {
  const db = getDb()
  const { bookingId } = req.params
  const { driver_id, actual_fare } = req.body

  db.prepare('UPDATE bookings SET status = ?, actual_fare = ? WHERE id = ?')
    .run('COMPLETED', actual_fare || null, bookingId)

  // Reset driver status to AVAILABLE
  db.prepare('UPDATE drivers SET status = ?, total_rides = total_rides + 1 WHERE id = ?').run('AVAILABLE', driver_id)

  // Get driver name
  const driver = db.prepare('SELECT u.name FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.id = ?').get(driver_id)

  // Notify admin
  await sendToAdmin(`✅ 司機 ${driver?.name || '司機'} 已完成行程 #${bookingId.slice(-4)}`)

  db.prepare('INSERT INTO operation_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)')
    .run(driver_id, 'COMPLETE', 'booking', bookingId, actual_fare ? `實際車資: ${actual_fare}` : '')

  res.json({ success: true })
})

export default router
