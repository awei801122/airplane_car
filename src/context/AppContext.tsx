import React, { createContext, useContext, useState, ReactNode } from 'react'
import { User, Booking, Driver, SystemSettings } from '../types'

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
