import express from 'express'
import { getDb } from '../services/database.js'
import { replyMessage, createTextMessage } from '../services/lineService.js'
import crypto from 'crypto'

const router = express.Router()

// Create new booking
router.post('/', async (req, res) => {
  try {
    const db = getDb()
    const {
      line_user_id,
      pickup_address,
      dropoff_address,
      pickup_time,
      passenger_count = 1,
      luggage_count = 0,
      flight_number,
      notes,
      estimated_fare,
      payment_type, // 'deposit' or 'full'
      reply_token,
      reply_token_expires_at
    } = req.body

    // Get or create customer
    let customer = db.prepare('SELECT * FROM users WHERE line_user_id = ?').get(line_user_id)
    if (!customer) {
      const customerId = 'c_' + crypto.randomUUID().slice(0, 8)
      db.prepare('INSERT INTO users (id, line_user_id, name, role) VALUES (?, ?, ?, ?)').run(
        customerId,
        line_user_id,
        '客戶',
        'CUSTOMER'
      )
      customer = db.prepare('SELECT * FROM users WHERE line_user_id = ?').get(line_user_id)
    }

    // Create booking
    const bookingId = 'b_' + crypto.randomUUID().slice(0, 8)
    const paymentStatus = payment_type === 'deposit' ? 'DEPOSIT_PAID' : 'UNPAID'
    const depositAmount = payment_type === 'deposit' ? 300 : 0

    db.prepare(`
      INSERT INTO bookings (
        id, customer_id, pickup_address, dropoff_address, pickup_time,
        passenger_count, luggage_count, flight_number, notes, estimated_fare,
        payment_status, deposit_amount, status, reply_token, reply_token_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bookingId,
      customer.id,
      pickup_address,
      dropoff_address,
      pickup_time,
      passenger_count,
      luggage_count,
      flight_number || null,
      notes || null,
      estimated_fare,
      paymentStatus,
      depositAmount,
      'PENDING',
      reply_token || null,
      reply_token_expires_at || null
    )

    // Reply to customer if we have reply token
    if (reply_token) {
      await replyMessage(reply_token, [
        createTextMessage(`✅ 預約成功！\n訂單編號：#${bookingId.slice(-4)}\n上車：${pickup_address}\n目的地：${dropoff_address}\n時間：${new Date(pickup_time).toLocaleString('zh-TW')}\n預估車資：$${estimated_fare}\n\n我們將儘快為您派車，請留意通知。`)
      ])
    }

    res.json({ success: true, booking_id: bookingId })
  } catch (error) {
    console.error('Create booking error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get booking by ID
router.get('/:id', (req, res) => {
  const db = getDb()
  const booking = db.prepare(`
    SELECT b.*, u.name as customer_name,
           d.name as driver_name, d.license_plate, d.vehicle_model, d.phone as driver_phone
    FROM bookings b
    LEFT JOIN users u ON b.customer_id = u.id
    LEFT JOIN users d ON b.driver_id = d.id
    WHERE b.id = ?
  `).get(req.params.id)

  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' })
  }

  res.json({ success: true, data: booking })
})

// Get customer bookings
router.get('/customer/:lineUserId', (req, res) => {
  const db = getDb()
  const customer = db.prepare('SELECT * FROM users WHERE line_user_id = ?').get(req.params.lineUserId)

  if (!customer) {
    return res.json({ success: true, data: [] })
  }

  const bookings = db.prepare(`
    SELECT b.*, d.name as driver_name, d.license_plate, d.vehicle_model, d.phone as driver_phone
    FROM bookings b
    LEFT JOIN users d ON b.driver_id = d.id
    WHERE b.customer_id = ?
    ORDER BY b.created_at DESC
  `).all(customer.id)

  res.json({ success: true, data: bookings })
})

// Simulate payment
router.post('/:id/pay', async (req, res) => {
  const db = getDb()
  const { payment_type } = req.body // 'deposit' or 'full'

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id)
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' })
  }

  const paymentStatus = payment_type === 'deposit' ? 'DEPOSIT_PAID' : 'PAID'
  const depositAmount = payment_type === 'deposit' ? 300 : 0

  db.prepare('UPDATE bookings SET payment_status = ?, deposit_amount = ? WHERE id = ?')
    .run(paymentStatus, depositAmount, req.params.id)

  // Reply to customer if we have reply token
  if (booking.reply_token) {
    const message = payment_type === 'deposit'
      ? `💰 訂金 $300 已繳納成功！\n尾款 $${booking.estimated_fare - 300} 將於乘車後以現金支付。`
      : `💰 付款成功！\n已全額支付 $${booking.estimated_fare}`

    await replyMessage(booking.reply_token, [createTextMessage(message)])
  }

  res.json({ success: true })
})

// Cancel booking
router.post('/:id/cancel', async (req, res) => {
  const db = getDb()
  const { reason } = req.body

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id)
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' })
  }

  if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
    return res.status(400).json({ success: false, error: 'Cannot cancel this booking' })
  }

  db.prepare('UPDATE bookings SET status = ?, cancelled_at = ?, cancel_reason = ? WHERE id = ?')
    .run('CANCELLED', new Date().toISOString(), reason || null, req.params.id)

  // Reply to customer if we have reply token
  if (booking.reply_token) {
    await replyMessage(booking.reply_token, [
      createTextMessage('❌ 您的預約已取消。\n如有疑問請聯繫我們。')
    ])
  }

  res.json({ success: true })
})

export default router
