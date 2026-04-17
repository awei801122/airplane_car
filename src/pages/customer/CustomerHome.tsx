import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Booking, BookingStatus } from '../../types'
import BookingForm from '../../components/booking/BookingForm'

const API_BASE = 'http://localhost:3000/api'

const CustomerHome: React.FC = () => {
  const navigate = useNavigate()
  const { currentUser, setBookings, addBooking } = useApp()
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [recentBookings, setRecentBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (currentUser?.line_user_id) {
      fetchBookings()
    }
  }, [currentUser])

  const fetchBookings = async () => {
    if (!currentUser?.line_user_id) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/bookings/customer/${currentUser.line_user_id}`)
      const data = await res.json()
      if (data.success) {
        setBookings(data.data)
        setRecentBookings(data.data.slice(0, 5))
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error)
    } finally {
      setLoading(false)
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

  if (showBookingForm) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 bg-surface border-b border-border z-10 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <button
              onClick={() => setShowBookingForm(false)}
              className="text-textSecondary hover:text-primary"
            >
              <i className="fa-solid fa-arrow-left mr-2"></i>
              返回
            </button>
            <h1 className="text-lg font-bold text-textPrimary">預約叫車</h1>
            <div className="w-16"></div>
          </div>
        </div>
        <BookingForm
          lineUserId={currentUser?.line_user_id || ''}
          onSuccess={(booking) => {
            addBooking(booking)
            setRecentBookings(prev => [booking, ...prev])
            setShowBookingForm(false)
          }}
          onCancel={() => setShowBookingForm(false)}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary to-primaryHover text-white px-4 py-6">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold mb-1">
            <i className="fa-solid fa-car-side mr-2"></i>
            歡迎使用 YJOVA 車來了
          </h1>
          <p className="text-white/80 text-sm">
            您好，{currentUser?.name || '貴賓'}！需要叫車服務嗎？
          </p>
        </div>
      </div>

      {/* Quick Booking Button */}
      <div className="max-w-lg mx-auto px-4 -mt-4">
        <button
          onClick={() => setShowBookingForm(true)}
          className="w-full bg-primary hover:bg-primaryHover text-white font-bold py-4 px-6 rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all active:scale-98"
        >
          <i className="fa-solid fa-plane-departure text-xl"></i>
          <span className="text-lg">機場接送 立即預約</span>
        </button>
      </div>

      {/* Recent Bookings */}
      <div className="max-w-lg mx-auto px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-textPrimary">
            <i className="fa-solid fa-clock-rotate-left mr-2 text-primary"></i>
            最近行程
          </h2>
          <button
            onClick={() => navigate('/customer/history')}
            className="text-sm text-primary hover:text-primaryHover"
          >
            查看全部
          </button>
        </div>

        {loading ? (
          <div className="bg-surface rounded-xl p-6 text-center">
            <i className="fa-solid fa-spinner fa-spin text-2xl text-primary"></i>
            <p className="mt-2 text-textSecondary text-sm">載入中...</p>
          </div>
        ) : recentBookings.length === 0 ? (
          <div className="bg-surface rounded-xl p-6 text-center">
            <i className="fa-solid fa-car text-4xl text-gray-300 mb-3"></i>
            <p className="text-textSecondary text-sm">尚無預約記錄</p>
            <p className="text-textSecondary text-xs mt-1">點擊上方按鈕預約您的第一趟行程</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentBookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-surface rounded-xl p-4 shadow-sm border border-border"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-xs text-textSecondary">訂單</span>
                    <p className="font-bold text-textPrimary">#{booking.id.slice(-4)}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                    {getStatusText(booking.status)}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-circle-notch text-primary mt-1.5 text-xs"></i>
                    <span className="text-textPrimary">{booking.pickup_address}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-location-dot text-error mt-1.5 text-xs"></i>
                    <span className="text-textPrimary">{booking.dropoff_address}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="text-xs text-textSecondary">
                    {formatDateTime(booking.pickup_time)}
                  </span>
                  <span className="font-bold text-primary">
                    NT$ {booking.estimated_fare}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="max-w-lg mx-auto px-4 mt-6 mb-6">
        <h2 className="text-lg font-bold text-textPrimary mb-3">
          <i className="fa-solid fa-bolt mr-2 text-primary"></i>
          快捷服務
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowBookingForm(true)}
            className="bg-surface rounded-xl p-4 shadow-sm border border-border flex flex-col items-center gap-2 hover:border-primary transition-colors"
          >
            <i className="fa-solid fa-plane text-2xl text-primary"></i>
            <span className="text-sm font-medium text-textPrimary">機場接送</span>
          </button>
          <button
            onClick={() => navigate('/customer/history')}
            className="bg-surface rounded-xl p-4 shadow-sm border border-border flex flex-col items-center gap-2 hover:border-primary transition-colors"
          >
            <i className="fa-solid fa-list text-2xl text-primary"></i>
            <span className="text-sm font-medium text-textPrimary">行程紀錄</span>
          </button>
          <button
            onClick={() => {/* TODO: Contact feature */}}
            className="bg-surface rounded-xl p-4 shadow-sm border border-border flex flex-col items-center gap-2 hover:border-primary transition-colors"
          >
            <i className="fa-solid fa-headset text-2xl text-primary"></i>
            <span className="text-sm font-medium text-textPrimary">聯絡客服</span>
          </button>
          <button
            onClick={() => {/* TODO: Help feature */}}
            className="bg-surface rounded-xl p-4 shadow-sm border border-border flex flex-col items-center gap-2 hover:border-primary transition-colors"
          >
            <i className="fa-solid fa-circle-question text-2xl text-primary"></i>
            <span className="text-sm font-medium text-textPrimary">使用說明</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default CustomerHome
