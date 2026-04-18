import cron from 'node-cron'
import { getDb } from './database.js'
import { sendHourlyReport, sendDailyReport, remindDriverDeparture, sendToAdmin, notifyDriverNewTask, createInlineKeyboard } from './telegramService.js'
import { replyMessage, createTextMessage, createDriverCard } from './lineService.js'

export function startScheduler() {
  console.log('Starting scheduler...')

  // Every hour: send report to admin
  cron.schedule('0 * * * *', async () => {
    console.log('Running hourly report...')
    await sendHourlyReportToAdmin()
  })

  // Every day at 20:00: send tomorrow's booking summary
  cron.schedule('0 20 * * *', async () => {
    console.log('Running daily report...')
    await sendDailyReportToAdmin()
  })

  // Every 5 minutes: check for various conditions
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running scheduled checks...')
    await checkDepartureReminders()      // 30-min departure reminder
    await check2HourDeparture()            // 2-hour warning for unassigned
    await checkPendingTimeout()            // 30-min timeout warning
    await autoAssignPending()              // auto-assign if possible
  })
}

async function sendHourlyReportToAdmin() {
  const db = getDb()

  const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

  const pendingCount = db.prepare(`
    SELECT COUNT(*) as count FROM bookings
    WHERE status = 'PENDING' AND pickup_time BETWEEN datetime('now') AND ?
  `).get(twoHoursLater)

  const assignedCount = db.prepare(`
    SELECT COUNT(*) as count FROM bookings
    WHERE status = 'ASSIGNED' AND pickup_time BETWEEN datetime('now') AND ?
  `).get(twoHoursLater)

  const startingCount = db.prepare(`
    SELECT COUNT(*) as count FROM bookings
    WHERE status IN ('CONFIRMED', 'STARTING') AND pickup_time BETWEEN datetime('now') AND ?
  `).get(twoHoursLater)

  const onlineDrivers = db.prepare("SELECT COUNT(*) as count FROM drivers WHERE status = 'AVAILABLE'").get()
  const busyDrivers = db.prepare("SELECT COUNT(*) as count FROM drivers WHERE status = 'BUSY'").get()
  const offlineDrivers = db.prepare("SELECT COUNT(*) as count FROM drivers WHERE status = 'OFFLINE'").get()

  const unconfirmedCount = db.prepare(`
    SELECT COUNT(*) as count FROM bookings
    WHERE status = 'ASSIGNED' AND is_confirmed = 0
    AND datetime(pickup_time, '-15 minutes') < datetime('now')
  `).get()

  const stats = {
    pendingCount: pendingCount.count,
    assignedCount: assignedCount.count,
    startingCount: startingCount.count,
    onlineDrivers: onlineDrivers.count,
    busyDrivers: busyDrivers.count,
    offlineDrivers: offlineDrivers.count,
    alerts: unconfirmedCount.count > 0 ? [{ message: `${unconfirmedCount.count} 筆司機未確認出發` }] : []
  }

  await sendHourlyReport(stats)
}

async function sendDailyReportToAdmin() {
  const db = getDb()

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const tomorrowBookings = db.prepare(`
    SELECT b.*, u.name as customer_name
    FROM bookings b
    LEFT JOIN users u ON b.customer_id = u.id
    WHERE DATE(b.pickup_time) = ? AND b.status != 'CANCELLED'
    ORDER BY b.pickup_time ASC
  `).all(tomorrow)

  await sendDailyReport(tomorrowBookings)
}

async function checkDepartureReminders() {
  const db = getDb()

  // Find bookings starting in 25-35 minutes that haven't been confirmed
  const targetTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const targetTimeMinus10 = new Date(Date.now() + 20 * 60 * 1000).toISOString()

  const bookings = db.prepare(`
    SELECT b.*, d.user_id, u.telegram_chat_id, u.name as driver_name
    FROM bookings b
    JOIN drivers d ON b.driver_id = d.id
    JOIN users u ON d.user_id = u.id
    WHERE b.status = 'CONFIRMED'
    AND b.is_confirmed = 0
    AND b.pickup_time BETWEEN ? AND ?
  `).all(targetTimeMinus10, targetTime)

  for (const booking of bookings) {
    await remindDriverDeparture(
      { telegram_chat_id: booking.telegram_chat_id, name: booking.driver_name },
      booking
    )
  }
}

// Check 2 hours before departure - warn if no driver assigned
async function check2HourDeparture() {
  const db = getDb()

  // Find PENDING bookings between 1.5-2.5 hours from now
  const targetTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  const targetTimeMinus1h = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString()

  const pendingBookings = db.prepare(`
    SELECT b.*, u.name as customer_name, u.reply_token
    FROM bookings b
    JOIN users u ON b.customer_id = u.id
    WHERE b.status = 'PENDING'
    AND b.pickup_time BETWEEN ? AND ?
  `).all(targetTimeMinus1h, targetTime)

  for (const booking of pendingBookings) {
    await sendToAdmin(
      `⚠️ 警示：訂單 #${booking.id.slice(-4)} 在 2 小時後，但尚未指派司機！\n` +
      `路線：${booking.pickup_address} → ${booking.dropoff_address}\n` +
      `時間：${new Date(booking.pickup_time).toLocaleString('zh-TW')}`
    )
  }
}

// Check for PENDING bookings older than 30 minutes
async function checkPendingTimeout() {
  const db = getDb()

  const overdueBookings = db.prepare(`
    SELECT b.*, u.name as customer_name
    FROM bookings b
    JOIN users u ON b.customer_id = u.id
    WHERE b.status = 'PENDING'
    AND datetime(b.created_at, '+30 minutes') < datetime('now')
  `).all()

  for (const booking of overdueBookings) {
    await sendToAdmin(
      `🚨 逾期警示：訂單 #${booking.id.slice(-4)} 已等待超過 30 分鐘未指派！\n` +
      `客戶：${booking.customer_name}\n` +
      `路線：${booking.pickup_address} → ${booking.dropoff_address}`
    )
  }
}

// Auto-assign available drivers to pending bookings
async function autoAssignPending() {
  const db = getDb()

  // Find PENDING bookings 1-2 hours from now
  const bookings = db.prepare(`
    SELECT * FROM bookings
    WHERE status = 'PENDING'
    AND pickup_time > datetime('now', '+1 hour')
    AND pickup_time < datetime('now', '+2 hours')
    ORDER BY pickup_time ASC
    LIMIT 5
  `).all()

  if (bookings.length === 0) return

  // Find available drivers
  const availableDrivers = db.prepare(`
    SELECT d.*, u.name, u.phone, u.telegram_chat_id
    FROM drivers d
    JOIN users u ON d.user_id = u.id
    WHERE d.status = 'AVAILABLE'
    LIMIT ?
  `).all(bookings.length)

  for (let i = 0; i < Math.min(bookings.length, availableDrivers.length); i++) {
    const booking = bookings[i]
    const driver = availableDrivers[i]

    // Auto-assign
    db.prepare('UPDATE bookings SET driver_id = ?, status = ? WHERE id = ?')
      .run(driver.id, 'ASSIGNED', booking.id)

    // Notify driver
    await notifyDriverNewTask(driver, booking)

    // Send driver card to customer
    if (booking.reply_token) {
      const flexMessage = {
        type: 'flex',
        altText: '司機已派任（自動指派）',
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

    // Log
    db.prepare('INSERT INTO operation_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)')
      .run(driver.user_id, 'AUTO_ASSIGN', 'booking', booking.id, `自動指派司機: ${driver.name}`)

    await sendToAdmin(`🤖 系統自動指派司機 ${driver.name} 給訂單 #${booking.id.slice(-4)}`)
  }
}
