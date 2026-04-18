const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN

export async function replyMessage(replyToken, messages) {
  const url = 'https://api.line.me/v2/bot/message/reply'
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      replyToken,
      messages
    })
  })
  return response.json()
}

export async function pushMessage(to, messages) {
  const url = 'https://api.line.me/v2/bot/message/push'
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      to,
      messages
    })
  })
  return response.json()
}

export function createTextMessage(text) {
  return {
    type: 'text',
    text
  }
}

export function createFlexMessage(altText, contents) {
  return {
    type: 'flex',
    altText,
    contents
  }
}

export function createDriverCard(driver, booking) {
  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '🚗 司機已派任',
          weight: 'bold',
          color: '#FF8C00'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: `司機：${driver.name}`,
          weight: 'bold'
        },
        {
          type: 'text',
          text: `車牌：${driver.license_plate}`
        },
        {
          type: 'text',
          text: `車型：${driver.vehicle_model}`
        },
        {
          type: 'text',
          text: `電話：${driver.phone || '無'}`
        },
        {
          type: 'separator'
        },
        {
          type: 'text',
          text: `上車：${booking.pickup_address}`
        },
        {
          type: 'text',
          text: `目的地：${booking.dropoff_address}`
        },
        {
          type: 'text',
          text: `時間：${new Date(booking.pickup_time).toLocaleString('zh-TW')}`
        }
      ]
    }
  }
}

export default {
  replyMessage,
  pushMessage,
  createTextMessage,
  createFlexMessage,
  createDriverCard
}