import express from 'express'
import { initDatabase } from './services/database.js'
import bookingRoutes from './routes/booking.js'
import driverRoutes from './routes/driver.js'
import adminRoutes from './routes/admin.js'
import webhookRoutes from './routes/webhook.js'
import { startScheduler } from './services/scheduler.js'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Initialize database
initDatabase()

// Routes
app.use('/api/booking', bookingRoutes)
app.use('/api/driver', driverRoutes)
app.use('/api/admin', adminRoutes)
app.use('/webhook', webhookRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)

  // Start scheduled tasks
  startScheduler()
})