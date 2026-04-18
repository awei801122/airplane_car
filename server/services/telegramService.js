const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const ADMIN_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

export async function sendMessage(chatId, text, keyboard = null) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML'
  }

  if (keyboard) {
    payload.reply_markup = keyboard
  }

  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  return response.json()
}

export async function sendToAdmin(text, keyboard = null) {
  if (!ADMIN_CHAT_ID) {
    console.log('Admin chat ID not configured, skipping message:', text)
    return
  }
  return sendMessage(ADMIN_CHAT_ID, text, keyboard)
}

export async function sendToDriver(telegramChatId, text, keyboard = null) {
  return sendMessage(telegramChatId, text, keyboard)
}

export function createInlineKeyboard(buttons) {
  return {
    inline_keyboard: buttons.map(row =>
      row.map(btn => ({
        text: btn.text,
        callback_data: btn.data
      }))
    )
  }
}

export async function notifyDriverNewTask(driver, booking) {
  const message = `
🚕 <b>新任務指派</b>

📍 上車地點：${booking.pickup_address}
📍 目的地：${booking.dropoff_address}
🕐 用車時間：${new Date(booking.pickup_time).toLocaleString('zh-TW')}
👤 乘客：${booking.passenger_count}人 / ${booking.luggage_count}件行李
${booking.flight_number ? `✈️ 航班：${booking.flight_number}` : ''}
${booking.notes ? `📝 備註：${booking.notes}` : ''}
  `.trim()

  const keyboard = createInlineKeyboard([
    [
      { text: '✅ 承接', data: `accept:${booking.id}` },
      { text: '❌ 拒絕', data: `reject:${booking.id}` }
    ]
  ])

  return sendToDriver(driver.telegram_chat_id, message, keyboard)
}

export async function remindDriverDeparture(driver, booking) {
  const message = `
⏰ <b>出發提醒</b>

即將開始的任務：
📍 上車：${booking.pickup_address}
🕐 時間：${new Date(booking.pickup_time).toLocaleString('zh-TW')}
  `.trim()

  const keyboard = createInlineKeyboard([
    [
      { text: '🚗 確認出發', data: `depart:${booking.id}` },
      { text: '❌ 取消任務', data: `cancel:${booking.id}` }
    ]
  ])

  return sendToDriver(driver.telegram_chat_id, message, keyboard)
}

export async function notifyAdminDriverConfirmed(driverName, bookingId) {
  const message = `🚕 <b>司機已確認出發</b>\n\n司機：${driverName}\n預約編號：#${bookingId}`
  return sendToAdmin(message)
}

export async function notifyAdminDriverRejected(driverName, bookingId) {
  const message = `⚠️ <b>司機拒絕任務</b>\n\n司機：${driverName}\n預約編號：#${bookingId}\n請重新指派司機`
  return sendToAdmin(message)
}

export async function sendHourlyReport(stats) {
  const message = `
📊 <b>每小時訂單狀態報告</b>

⏰ 統計時間：${new Date().toLocaleString('zh-TW')}

📋 未來2小時訂單：
- 未派車：${stats.pendingCount} 筆
- 已派車：${stats.assignedCount} 筆
- 司機已出發：${stats.startingCount} 筆

👥 司機狀態：
- 上線中：${stats.onlineDrivers} 人
- 任務中：${stats.busyDrivers} 人
- 離線：${stats.offlineDrivers} 人

⚠️ 警示：${stats.alerts.length} 筆
  `.trim()

  return sendToAdmin(message)
}

export async function answerCallbackQuery(callbackQueryId, text = '') {
  const payload = { callback_query_id: callbackQueryId }
  if (text) payload.text = text

  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

export async function sendDailyReport(tomorrowBookings) {
  const message = `
📋 <b>明日預約總表</b>

日期：${new Date(Date.now() + 86400000).toLocaleDateString('zh-TW')}

總預約數：${tomorrowBookings.length} 筆

${tomorrowBookings.map((b, i) => `
${i + 1}. #${b.id.slice(-4)}
   ${b.pickup_time.slice(11, 16)} ${b.pickup_address} → ${b.dropoff_address}
   ${b.driver_id ? '✅ 已派車' : '❌ 未派車'}
`).join('')}
  `.trim()

  return sendToAdmin(message)
}

export default {
  sendMessage,
  sendToAdmin,
  sendToDriver,
  answerCallbackQuery,
  notifyDriverNewTask,
  remindDriverDeparture,
  notifyAdminDriverConfirmed,
  notifyAdminDriverRejected,
  sendHourlyReport,
  sendDailyReport
}