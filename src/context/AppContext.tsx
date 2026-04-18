import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, Booking, Driver, SystemSettings } from '../types'
import { getProfile, isLoggedIn } from '../lib/liff'
import { API_BASE } from '../config/api'

interface AppContextType {
  currentUser: User | null
  bookings: Booking[]
  drivers: Driver[]
  settings: SystemSettings
  setCurrentUser: (user: User | null) => void
  setBookings: (bookings: Booking[]) => void
  addBooking: (booking: Booking) => void
  updateBooking: (id: string, updates: Partial<Booking>) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [drivers] = useState<Driver[]>([])
  const [settings] = useState<SystemSettings>({
    baseFare: 150,
    pricePerKm: 25,
    nightSurcharge: 20
  })

  useEffect(() => {
    const initUser = async () => {
      try {
        if (isLoggedIn()) {
          const profile = await getProfile()
          if (profile) {
            // Verify/get user from backend
            const res = await fetch(`${API_BASE}/auth/line-login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                line_user_id: profile.userId,
                name: profile.displayName
              })
            })
            const data = await res.json()
            if (data.success && data.data) {
              setCurrentUser(data.data as User)
            }
          }
        }
      } catch (err) {
        console.error('LIFF init error:', err)
      }
    }
    initUser()
  }, [])

  const addBooking = (booking: Booking) => {
    setBookings(prev => [booking, ...prev])
  }

  const updateBooking = (id: string, updates: Partial<Booking>) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  return (
    <AppContext.Provider value={{
      currentUser,
      bookings,
      drivers,
      settings,
      setCurrentUser,
      setBookings,
      addBooking,
      updateBooking
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
