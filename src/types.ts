// User roles
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN'
}

// Driver status
export enum DriverStatus {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  OFFLINE = 'OFFLINE'
}

// Booking status
export enum BookingStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  CONFIRMED = 'CONFIRMED',
  STARTING = 'STARTING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

// Payment status
export enum PaymentStatus {
  UNPAID = 'UNPAID',
  DEPOSIT_PAID = 'DEPOSIT_PAID',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED'
}

// Booking type
export enum BookingType {
  IMMEDIATE = 'IMMEDIATE',
  SCHEDULED = 'SCHEDULED'
}

// Category
export enum BookingCategory {
  GENERAL = 'GENERAL',
  AIRPORT = 'AIRPORT'
}

// User interface
export interface User {
  id: string
  line_user_id: string
  name: string
  phone?: string
  role: UserRole
  telegram_chat_id?: string
  created_at: string
}

// Driver interface
export interface Driver {
  id: string
  user_id: string
  license_plate: string
  vehicle_model: string
  vehicle_photo_url?: string
  rating: number
  total_rides: number
  status: DriverStatus
  is_confirmed: boolean
  confirmed_at?: string
}

// Booking interface
export interface Booking {
  id: string
  customer_id: string
  driver_id?: string
  pickup_address: string
  dropoff_address: string
  pickup_time: string
  passenger_count: number
  luggage_count: number
  flight_number?: string
  notes?: string
  estimated_fare: number
  actual_fare?: number
  payment_status: PaymentStatus
  deposit_amount: number
  payment_method?: string
  booking_type: BookingType
  category: BookingCategory
  status: BookingStatus
  reply_token?: string
  reply_token_expires_at?: string
  created_at: string
  cancelled_at?: string
  cancel_reason?: string
  // Joined fields
  customer_name?: string
  customer_phone?: string
  driver_name?: string
  license_plate?: string
  vehicle_model?: string
  driver_phone?: string
}

// Notification log
export interface NotificationLog {
  id: number
  booking_id?: string
  user_id: string
  type: string
  channel: 'LINE_REPLY' | 'LINE_PUSH' | 'TELEGRAM'
  content: string
  sent_at: string
}

// Operation log
export interface OperationLog {
  id: number
  user_id: string
  action: string
  target_type: string
  target_id?: string
  details?: string
  ip_address?: string
  created_at: string
}

// System settings
export interface SystemSettings {
  baseFare: number
  pricePerKm: number
  nightSurcharge: number
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Dashboard stats
export interface DashboardStats {
  pendingBookings: number
  assignedBookings: number
  confirmedBookings: number
  onlineDrivers: number
  busyDrivers: number
  offlineDrivers: number
  alerts: Alert[]
}

export interface Alert {
  id: string
  type: 'UNCONFIRMED' | 'UNASSIGNED' | 'REJECTED'
  message: string
  booking_id: string
  created_at: string
}
