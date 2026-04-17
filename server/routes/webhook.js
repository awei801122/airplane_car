import express from 'express'
import { getDb } from '../services/database.js'
import { replyMessage, createTextMessage } from '../services/lineService.js'

const router = express.Router()

// LINE Webhook endpoint
router.post('/line', async (req, res) => {
  const events = req.body.events

  for (const event of events) {
    try {
      if (event.type === 'postback') {
        await handlePostback(event)
      } else if (event.type === 'message') {
        await handleMessage(event)
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
  const action = data.split(':')[0]

  if (action === 'CONFIRM_BOOKING') {
    const bookingId = data.split(':')[1]
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId)

    if (booking) {
      db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('CONFIRMED', bookingId)

      await replyMessage(replyToken, [
        createTextMessage('✅ 您的預約已確認！\n司機將在出發前與您聯繫。')
      ])
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

export default router