import express from 'express'
import crypto from 'crypto'
import { getDb } from '../services/database.js'
import { replyMessage, createTextMessage, createFlexMessage, createDriverCard } from '../services/lineService.js'
import { sendToAdmin, notifyDriverNewTask, answerCallbackQuery } from '../services/telegramService.js'

const router = express.Router()

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

// Verify LINE signature
function verifyLineSignature(body, signature) {
  if (!signature || !LINE_CHANNEL_SECRET) return true // Skip in dev
  const hash = crypto.createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(Buffer.from(JSON.stringify(body)))
    .digest('base64')
  return hash === signature
}

// LINE Webhook endpoint
router.post('/line', async (req, res) => {
  const signature = req.headers['x-line-signature']

  if (!verifyLineSignature(req.body, signature)) {
    console.error('Invalid LINE signature')
    return res.status(403).json({ error: 'Invalid signature' })
  }

  const events = req.body.events || []

  for (const event of events) {
    try {
      if (event.type === 'postback') {
        await handlePostback(event)
      } else if (event.type === 'message') {
        await handleMessage(event)
      } else if (event.type === 'follow') {
        // New user added LINE OA
        const { replyToken, source } = event
        await replyMessage(replyToken, [
          createTextMessage('感謝您加入 YJOVA 車來了！\n\n請點擊下方圖文選單來使用服務：')
        ])
      }
    } catch (error) {
      console.error('Webhook error:', error)
    }
  }

  res.status(200).json({ status: 'ok' })
})

async function handlePostback(event) {
  const db = getDb()
  const { replyToken, data } = event
  const [action, ...params] = data.split(':')

  switch (action) {
    case 'CONFIRM_BOOKING': {
      const bookingId = params[0]
      const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId)

      if (booking) {
        db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('CONFIRMED', bookingId)
        await replyMessage(replyToken, [
          createTextMessage('✅ 您的預約已確認！\n司機將在出發前與您聯繫。')
        ])
      }
      break
    }

    case 'CHANGE_DRIVER': {
      const bookingId = params[0]
      // Unassign driver, set back to PENDING
      db.prepare('UPDATE bookings SET driver_id = NULL, status = ? WHERE id = ?')
        .run('PENDING', bookingId)

      await replyMessage(replyToken, [
        createTextMessage('已解除司機指派，管理員將重新安排車輛。')
      ])

      // Notify admin
      const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId)
      if (booking) {
        await sendToAdmin(`⚠️ 客戶更換司機，訂單 #${bookingId.slice(-4)} 需要重新指派`)
      }
      break
    }

    case 'MODIFY_BOOKING': {
      const bookingId = params[0]
      await replyMessage(replyToken, [
        createTextMessage('請重新填寫預約資訊來修改您的預約。')
      ])
      break
    }

    case 'CANCEL': {
      const bookingId = params[0]
      const reason = params[1] || '客戶取消'

      db.prepare('UPDATE bookings SET status = ?, cancelled_at = ?, cancel_reason = ? WHERE id = ?')
        .run('CANCELLED', new Date().toISOString(), reason, bookingId)

      await replyMessage(replyToken, [
        createTextMessage('您的預約已取消。')
      ])

      // Notify admin
      await sendToAdmin(`❌ 客戶取消預約 #${bookingId.slice(-4)}，原因：${reason}`)
      break
    }
  }
}

async function handleMessage(event) {
  const { replyToken, message } = event

  if (message.text === '查詢訂單') {
    await replyMessage(replyToken, [
      createTextMessage('請點擊圖文選單中的「查詢訂單」按鈕來查看您的預約記錄。')
    ])
  }
}

// Telegram Bot Webhook
router.post('/telegram', async (req, res) => {
  const { callback_query, message } = req.body

  // Handle callback query from inline keyboard
  if (callback_query) {
    const { id: callbackQueryId, data, from, message: callbackMessage } = callback_query
    const chatId = callback_query.message?.chat?.id
    const [action, bookingId] = data.split(':')

    const db = getDb()

    switch (action) {
      case 'accept': {
        // Driver accepts the task
        const driver = db.prepare(`
          SELECT d.*, u.name, u.phone, u.telegram_chat_id
          FROM drivers d
          JOIN users u ON d.user_id = u.id
          WHERE u.telegram_chat_id = ?
        `).get(String(chatId))

        if (driver) {
          // Update booking status
          db.prepare('UPDATE bookings SET status = ?, driver_id = ? WHERE id = ?')
            .run('CONFIRMED', driver.id, bookingId)

          // Update driver status to BUSY
          db.prepare('UPDATE drivers SET status = ? WHERE id = ?').run('BUSY', driver.id)

          // Notify admin
          await sendToAdmin(`✅ 司機 ${driver.name} 已承接任務 #${bookingId.slice(-4)}`)

          // Send driver card to customer
          const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId)
          if (booking && booking.reply_token) {
            await sendDriverCardToCustomer(booking.reply_token, driver, booking)
          }

          // Answer callback
          await answerCallbackQuery(callbackQueryId, '已承接任務')
        }
        break
      }

      case 'reject': {
        // Driver rejects the task
        const driver = db.prepare(`
          SELECT d.*, u.name, u.telegram_chat_id
          FROM drivers d
          JOIN users u ON d.user_id = u.id
          WHERE u.telegram_chat_id = ?
        `).get(String(chatId))

        // Reset booking to PENDING
        db.prepare('UPDATE bookings SET driver_id = NULL, status = ? WHERE id = ?')
          .run('PENDING', bookingId)

        // Notify admin
        const driverName = driver?.name || '未知司機'
        await sendToAdmin(`⚠️ 司機 ${driverName} 拒絕任務 #${bookingId.slice(-4)}，請重新指派`)

        await answerCallbackQuery(callbackQueryId, '已拒絕任務')
        break
      }

      case 'depart': {
        // Driver confirms departure
        const now = new Date().toISOString()
        db.prepare('UPDATE bookings SET status = ?, is_confirmed = 1, confirmed_at = ? WHERE id = ?')
          .run('STARTING', now, bookingId)

        // Get driver name for notification
        const driver = db.prepare(`
          SELECT u.name
          FROM drivers d
          JOIN users u ON d.user_id = u.id
          WHERE d.id = (SELECT driver_id FROM bookings WHERE id = ?)
        `).get(bookingId)

        await sendToAdmin(`🚕 ${driver?.name || '司機'} 已確認出發，預約 #${bookingId.slice(-4)}`)

        await answerCallbackQuery(callbackQueryId, '已確認出發')
        break
      }

      case 'cancel': {
        // Driver cancels task
        const driver = db.prepare(`
          SELECT u.name
          FROM drivers d
          JOIN users u ON d.user_id = u.id
          WHERE d.id = (SELECT driver_id FROM bookings WHERE id = ?)
        `).get(bookingId)

        db.prepare('UPDATE bookings SET driver_id = NULL, status = ? WHERE id = ?')
          .run('PENDING', bookingId)

        await sendToAdmin(`⚠️ 司機 ${driver?.name || '未知'} 取消任務 #${bookingId.slice(-4)}，請重新指派`)

        await answerCallbackQuery(callbackQueryId, '已取消任務')
        break
      }

      case 'complete': {
        // Driver completes the trip
        db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('COMPLETED', bookingId)

        // Reset driver status to AVAILABLE
        db.prepare(`
          UPDATE drivers SET status = 'AVAILABLE'
          WHERE id = (SELECT driver_id FROM bookings WHERE id = ?)
        `).run(bookingId)

        const driver = db.prepare(`
          SELECT u.name
          FROM drivers d
          JOIN users u ON d.user_id = u.id
          WHERE d.id = (SELECT driver_id FROM bookings WHERE id = ?)
        `).get(bookingId)

        await sendToAdmin(`✅ 司機 ${driver?.name || '司機'} 已完成行程 #${bookingId.slice(-4)}`)

        await answerCallbackQuery(callbackQueryId, '行程已完成')
        break
      }
    }

    res.status(200).json({ status: 'ok' })
    return
  }

  // Handle /start command
  if (message && message.text === '/start') {
    res.status(200).json({ status: 'ok' })
    return
  }

  res.status(200).json({ status: 'ok' })
})

// Send driver card Flex Message to customer
async function sendDriverCardToCustomer(replyToken, driver, booking) {
  const flexContent = createDriverCard(driver, booking)
  const flexMessage = {
    type: 'flex',
    altText: '司機已派任',
    contents: {
      type: 'bubble',
      ...flexContent
    }
  }

  await replyMessage(replyToken, [flexMessage])
}

export default router