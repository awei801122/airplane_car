import cron from 'node-cron'
import { getDb } from './database.js'
import { sendHourlyReport, sendDailyReport, remindDriverDeparture } from './telegramService.js'

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

  // Every 5 minutes: check for departure reminders
  cron.schedule('*/5 * * * *', async () => {
    console.log('Checking departure reminders...')
    await checkDepartureReminders()
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
