import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { Booking, BookingStatus, DriverStatus } from '../../types'
import DriverCard from '../../components/driver/DriverCard'
import { API_BASE } from '../../config/api'

type FilterStatus = 'all' | BookingStatus.PENDING | BookingStatus.ASSIGNED | BookingStatus.CONFIRMED | BookingStatus.COMPLETED | BookingStatus.CANCELLED

interface CancelModalState {
  show: boolean
  bookingId: string | null
  reason: string
}

const CANCEL_REASONS = [
  '行程變更',
  '已預約其他交通工具',
  '天氣因素',
  '司機因素',
  '其他'
]

const BookingHistory: React.FC = () => {
  const { currentUser, updateBooking } = useApp()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [cancelModal, setCancelModal] = useState<CancelModalState>({ show: false, bookingId: null, reason: '' })
  const [cancelLoading, setCancelLoading] = useState(false)

  const fetchBookings = useCallback(async () => {
    if (!currentUser?.line_user_id) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/bookings/customer/${currentUser.line_user_id}`)
      const data = await res.json()
      if (data.success) {
        setBookings(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error)
    } finally {
      setLoading(false)
    }
  }, [currentUser?.line_user_id])

  useEffect(() => {
    if (currentUser?.line_user_id) {
      fetchBookings()
    }
  }, [currentUser?.line_user_id, fetchBookings])

  const filteredBookings = bookings.filter(booking => {
    if (filter === 'all') return true
    return booking.status === filter
  })

  const canCancel = (status: BookingStatus) => {
    return status === BookingStatus.PENDING || status === BookingStatus.ASSIGNED || status === BookingStatus.CONFIRMED
  }

  const handleCancelClick = (bookingId: string) => {
    setCancelModal({ show: true, bookingId, reason: '' })
  }

  const handleConfirmCancel = async () => {
    if (!cancelModal.bookingId || !cancelModal.reason) return

    setCancelLoading(true)
    try {
      const res = await fetch(`${API_BASE}/booking/${cancelModal.bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelModal.reason })
      })
      const data = await res.json()
      if (data.success) {
        updateBooking(cancelModal.bookingId, {
          status: BookingStatus.CANCELLED,
          cancelled_at: new Date().toISOString(),
          cancel_reason: cancelModal.reason
        })
        setBookings(prev => prev.map(b =>
          b.id === cancelModal.bookingId
            ? { ...b, status: BookingStatus.CANCELLED, cancelled_at: new Date().toISOString(), cancel_reason: cancelModal.reason }
            : b
        ))
        setCancelModal({ show: false, bookingId: null, reason: '' })
      } else {
        alert(data.error || '取消失敗，請稍後再試')
      }
    } catch (error) {
      console.error('Failed to cancel booking:', error)
      alert('網路錯誤，請檢查連線')
    } finally {
      setCancelLoading(false)
    }
  }

  const getStatusColor = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.PENDING: return 'bg-yellow-100 text-yellow-800'
      case BookingStatus.ASSIGNED: return 'bg-blue-100 text-blue-800'
      case BookingStatus.CONFIRMED: return 'bg-green-100 text-green-800'
      case BookingStatus.STARTING: return 'bg-orange-100 text-orange-800'
      case BookingStatus.COMPLETED: return 'bg-gray-100 text-gray-800'
      case BookingStatus.CANCELLED: return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.PENDING: return '等待派車'
      case BookingStatus.ASSIGNED: return '已派車'
      case BookingStatus.CONFIRMED: return '已確認'
      case BookingStatus.STARTING: return '行程進行中'
      case BookingStatus.COMPLETED: return '已完成'
      case BookingStatus.CANCELLED: return '已取消'
      default: return status
    }
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const renderBookingCard = (booking: Booking) => (
    <div key={booking.id} className="bg-surface rounded-xl p-4 shadow-sm border border-border">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs text-textSecondary">訂單</span>
          <p className="font-bold text-textPrimary">#{booking.id.slice(-4)}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
          {getStatusText(booking.status)}
        </span>
      </div>

      {/* Route */}
      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2">
          <i className="fa-solid fa-circle-notch text-primary mt-1.5 text-xs"></i>
          <span className="text-textPrimary">{booking.pickup_address}</span>
        </div>
        <div className="flex items-start gap-2">
          <i className="fa-solid fa-location-dot text-error mt-1.5 text-xs"></i>
          <span className="text-textPrimary">{booking.dropoff_address}</span>
        </div>
      </div>

      {/* Time & Fare */}
      <div className="flex items-center justify-between py-3 border-t border-b border-border">
        <span className="text-sm text-textSecondary">
          <i className="fa-solid fa-clock mr-1"></i>
          {formatDateTime(booking.pickup_time)}
        </span>
        <span className="font-bold text-primary text-lg">
          NT$ {booking.estimated_fare}
        </span>
      </div>

      {/* Driver Card (if driver assigned) */}
      {(booking.status === BookingStatus.ASSIGNED || booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.STARTING) &&
       booking.driver_id && (
        <div className="mt-3">
          {booking.license_plate && booking.vehicle_model && (
            <DriverCard
              driver={{
                id: booking.driver_id,
                user_id: '',
                license_plate: booking.license_plate,
                vehicle_model: booking.vehicle_model,
                rating: 4.8,
                total_rides: 0,
                status: booking.status === BookingStatus.STARTING ? DriverStatus.BUSY : DriverStatus.AVAILABLE,
                is_confirmed: true
              }}
              driverName={booking.driver_name}
              driverPhone={booking.driver_phone}
            />
          )}
        </div>
      )}

      {/* Cancel reason (if cancelled) */}
      {booking.status === BookingStatus.CANCELLED && booking.cancel_reason && (
        <div className="mt-3 bg-red-50 rounded-lg p-3 border border-red-200">
          <span className="text-xs text-error font-medium">
            <i className="fa-solid fa-ban mr-1"></i>
            取消原因：
          </span>
          <span className="text-sm text-error">{booking.cancel_reason}</span>
        </div>
      )}

      {/* Cancel button */}
      {canCancel(booking.status) && (
        <button
          onClick={() => handleCancelClick(booking.id)}
          className="w-full mt-3 bg-error/10 hover:bg-error/20 text-error font-medium py-2 rounded-xl transition-colors"
        >
          <i className="fa-solid fa-ban mr-2"></i>
          取消預約
        </button>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primaryHover text-white px-4 py-6">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold mb-1">
            <i className="fa-solid fa-clock-rotate-left mr-2"></i>
            行程紀錄
          </h1>
          <p className="text-white/80 text-sm">
            查看您的所有預約記錄
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="bg-surface border-b border-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex overflow-x-auto scrollbar-hide">
          {[
            { key: 'all', label: '全部' },
            { key: BookingStatus.PENDING, label: '等待派車' },
            { key: BookingStatus.ASSIGNED, label: '已派車' },
            { key: BookingStatus.CONFIRMED, label: '已確認' },
            { key: BookingStatus.COMPLETED, label: '已完成' },
            { key: BookingStatus.CANCELLED, label: '已取消' }
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key as FilterStatus)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                filter === item.key
                  ? 'text-primary border-primary'
                  : 'text-textSecondary border-transparent hover:text-textPrimary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Booking list */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="bg-surface rounded-xl p-8 text-center">
            <i className="fa-solid fa-spinner fa-spin text-2xl text-primary"></i>
            <p className="mt-2 text-textSecondary text-sm">載入中...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-surface rounded-xl p-8 text-center">
            <i className="fa-solid fa-inbox text-4xl text-gray-300 mb-3"></i>
            <p className="text-textSecondary text-sm">尚無預約記錄</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map(renderBookingCard)}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {cancelModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-surface w-full max-w-lg rounded-t-2xl p-6 animate-slide-up">
            <h3 className="text-lg font-bold text-textPrimary mb-4">
              <i className="fa-solid fa-ban mr-2 text-error"></i>
              取消預約
            </h3>
            <p className="text-textSecondary text-sm mb-4">
              請選擇取消原因：
            </p>
            <div className="space-y-2 mb-6">
              {CANCEL_REASONS.map(reason => (
                <button
                  key={reason}
                  onClick={() => setCancelModal(prev => ({ ...prev, reason }))}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    cancelModal.reason === reason
                      ? 'border-error bg-error/5 text-error'
                      : 'border-border bg-background hover:border-error/50'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelModal({ show: false, bookingId: null, reason: '' })}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-textPrimary font-bold py-3 rounded-xl transition-colors"
              >
                返回
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={!cancelModal.reason || cancelLoading}
                className="flex-1 bg-error hover:bg-error/90 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {cancelLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : '確認取消'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BookingHistory