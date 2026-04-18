import express from 'express'
import { getDb } from '../services/database.js'
import crypto from 'crypto'

const router = express.Router()

// LINE Login callback - verify and create/update user
router.post('/line-login', async (req, res) => {
  const db = getDb()
  const { line_user_id, name } = req.body

  if (!line_user_id) {
    return res.status(400).json({ success: false, error: 'Missing line_user_id' })
  }

  // Query existing user
  let user = db.prepare('SELECT * FROM users WHERE line_user_id = ?').get(line_user_id)

  if (!user) {
    // New user - default to CUSTOMER role
    const id = 'u_' + crypto.randomUUID().slice(0, 8)
    const role = 'CUSTOMER'
    const phone = null
    db.prepare('INSERT INTO users (id, line_user_id, name, role, phone) VALUES (?, ?, ?, ?, ?)')
      .run(id, line_user_id, name || '客戶', role, phone)
    user = db.prepare('SELECT * FROM users WHERE line_user_id = ?').get(line_user_id)
  }

  res.json({ success: true, data: user })
})

// Get user by line_user_id
router.get('/user/:lineUserId', async (req, res) => {
  const db = getDb()
  const { lineUserId } = req.params

  const user = db.prepare('SELECT * FROM users WHERE line_user_id = ?').get(lineUserId)

  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' })
  }

  res.json({ success: true, data: user })
})

export default router