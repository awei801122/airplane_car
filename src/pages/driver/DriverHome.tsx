import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import '../../types'
import { API_BASE } from '../../config/api'

interface Task {
  id: string
  booking_id: string
  pickup_address: string
  dropoff_address: string
  pickup_time: string
  passenger_name: string
  passenger_phone?: string
  passenger_count: number
  luggage_count: number
  flight_number?: string
  estimated_fare: number
  status: string
  created_at: string
}

const DriverHome: React.FC = () => {
  const [searchParams] = useSearchParams()
  const lineUserId = searchParams.get('lineUserId') || searchParams.get('userId') || ''

  const [isOnline, setIsOnline] = useState(false)
  const [isTelegramBound, setIsTelegramBound] = useState(false)
  const [telegramBindingUrl, setTelegramBindingUrl] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState({ totalRides: 0, rating: 0 })
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    if (!lineUserId) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/driver/${lineUserId}/tasks`)
      const data = await res.json()
      if (data.success) {
        setTasks(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setLoading(false)
    }
  }, [lineUserId])

  const fetchStats = useCallback(async () => {
    if (!lineUserId) return
    try {
      const res = await fetch(`${API_BASE}/driver/${lineUserId}/stats`)
      const data = await res.json()
      if (data.success) {
        setStats({
          totalRides: data.data.total_rides || 0,
          rating: data.data.rating || 0
        })
        setIsOnline(data.data.status === 'AVAILABLE')
        setIsTelegramBound(!!data.data.telegram_chat_id)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }, [lineUserId])

  useEffect(() => {
    if (lineUserId) {
      fetchTasks()
      fetchStats()
    }
  }, [lineUserId, fetchTasks, fetchStats])

  const handleToggleStatus = async () => {
    setActionLoading('toggle')
    try {
      const res = await fetch(`${API_BASE}/driver/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId })
      })
      const data = await res.json()
      if (data.success) {
        setIsOnline(!isOnline)
      }
    } catch (error) {
      console.error('Failed to toggle status:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleBindTelegram = async () => {
    setActionLoading('bind')
    try {
      const res = await fetch(`${API_BASE}/driver/bind-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId })
      })
      const data = await res.json()
      if (data.success) {
        setTelegramBindingUrl(data.data.url || '')
        setIsTelegramBound(true)
      }
    } catch (error) {
      console.error('Failed to bind Telegram:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleAcceptTask = async (bookingId: string) => {
    setActionLoading(bookingId)
    try {
      const res = await fetch(`${API_BASE}/driver/task/${bookingId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId })
      })
      const data = await res.json()
      if (data.success) {
        fetchTasks()
      }
    } catch (error) {
      console.error('Failed to accept task:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectTask = async (bookingId: string) => {
    setActionLoading(bookingId)
    try {
      const res = await fetch(`${API_BASE}/driver/task/${bookingId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId })
      })
      const data = await res.json()
      if (data.success) {
        fetchTasks()
      }
    } catch (error) {
      console.error('Failed to reject task:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleConfirmStart = async (bookingId: string) => {
    setActionLoading(bookingId)
    try {
      const res = await fetch(`${API_BASE}/driver/task/${bookingId}/confirm-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId })
      })
      const data = await res.json()
      if (data.success) {
        fetchTasks()
      }
    } catch (error) {
      console.error('Failed to confirm start:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCompleteTrip = async (bookingId: string) => {
    setActionLoading(bookingId)
    try {
      const res = await fetch(`${API_BASE}/driver/task/${bookingId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId })
      })
      const data = await res.json()
      if (data.success) {
        fetchTasks()
        fetchStats()
      }
    } catch (error) {
      console.error('Failed to complete trip:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'ASSIGNED':
        return 'bg-blue-100 text-blue-800'
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800'
      case 'STARTING':
        return 'bg-orange-100 text-orange-800'
      case 'COMPLETED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return '等待回應'
      case 'ASSIGNED': return '已接單'
      case 'CONFIRMED': return '已確認'
      case 'STARTING': return '行程進行中'
      case 'COMPLETED': return '已完成'
      default: return status
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isApproaching = (pickupTime: string) => {
    const now = new Date()
    const pickup = new Date(pickupTime)
    const diffMins = (pickup.getTime() - now.getTime()) / 60000
    return diffMins <= 15 && diffMins > 0
  }

  const pendingTasks = tasks.filter(t => t.status === 'PENDING')
  const activeTasks = tasks.filter(t => ['ASSIGNED', 'CONFIRMED', 'STARTING'].includes(t.status))

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primaryHover text-white px-4 py-5">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold mb-1">
            <i className="fa-solid fa-car mr-2"></i>
            司機專區 - YJOVA 車來了
          </h1>
          <p className="text-white/80 text-sm">ID: {lineUserId.slice(-6) || '載入中...'}</p>
        </div>
      </div>

      {/* Online/Offline Toggle */}
      <div className="max-w-lg mx-auto px-4 -mt-3">
        <div className="bg-surface rounded-xl p-4 shadow-md border border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-textPrimary">
                <i className="fa-solid fa-power-off mr-2 text-primary"></i>
                上下線管理
              </h2>
              <p className={`text-sm mt-1 ${isOnline ? 'text-green-600' : 'text-textSecondary'}`}>
                目前狀態：{isOnline ? '上線中' : '離線'}
              </p>
            </div>
            <button
              onClick={handleToggleStatus}
              disabled={actionLoading === 'toggle'}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                isOnline ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              {actionLoading === 'toggle' && (
                <i className="fa-solid fa-spinner fa-spin absolute top-2 left-3 text-white text-sm"></i>
              )}
              <span
                className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  isOnline ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{stats.totalRides}</p>
              <p className="text-xs text-textSecondary">總趟數</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {stats.rating > 0 ? stats.rating.toFixed(1) : '-'}
                {stats.rating > 0 && <i className="fa-solid fa-star text-yellow-500 ml-1 text-sm"></i>}
              </p>
              <p className="text-xs text-textSecondary">評分</p>
            </div>
          </div>
        </div>
      </div>

      {/* Telegram Binding */}
      <div className="max-w-lg mx-auto px-4 mt-4">
        <div className="bg-surface rounded-xl p-4 shadow-sm border border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-textPrimary">
                <i className="fa-brands fa-telegram mr-2 text-primary"></i>
                Telegram 綁定
              </h2>
              <p className={`text-sm mt-1 ${isTelegramBound ? 'text-green-600' : 'text-textSecondary'}`}>
                {isTelegramBound ? '已綁定 - 可接收任務通知' : '未綁定 - 需綁定才能接收任務'}
              </p>
            </div>
            {!isTelegramBound && (
              <button
                onClick={handleBindTelegram}
                disabled={actionLoading === 'bind'}
                className="bg-primary hover:bg-primaryHover text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {actionLoading === 'bind' ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : (
                  '綁定'
                )}
              </button>
            )}
            {isTelegramBound && (
              <i className="fa-solid fa-circle-check text-green-500 text-xl"></i>
            )}
          </div>
          {telegramBindingUrl && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-textSecondary mb-2">請點擊以下連結綁定：</p>
              <a
                href={telegramBindingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-sm break-all"
              >
                {telegramBindingUrl}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <div className="max-w-lg mx-auto px-4 mt-4">
          <h2 className="text-lg font-bold text-textPrimary mb-3">
            <i className="fa-solid fa-bell text-primary mr-2"></i>
            待回應任務 ({pendingTasks.length})
          </h2>
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <div key={task.id} className="bg-surface rounded-xl p-4 shadow-sm border border-yellow-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs text-textSecondary">任務</span>
                    <p className="font-bold text-textPrimary">#{task.booking_id.slice(-4)}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(task.status)}`}>
                    {getStatusText(task.status)}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-clock text-primary mt-1"></i>
                    <span className="text-textPrimary font-medium">{formatTime(task.pickup_time)}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-circle-notch text-primary mt-1.5 text-xs"></i>
                    <span className="text-textPrimary">{task.pickup_address}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-location-dot text-error mt-1.5 text-xs"></i>
                    <span className="text-textPrimary">{task.dropoff_address}</span>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-textPrimary">{task.passenger_name}</p>
                      <p className="text-xs text-textSecondary">
                        {task.passenger_count}人 • {task.luggage_count}件行李
                        {task.flight_number && ` • ${task.flight_number}`}
                      </p>
                    </div>
                    <span className="font-bold text-primary">NT$ {task.estimated_fare}</span>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => handleRejectTask(task.booking_id)}
                    disabled={actionLoading === task.booking_id}
                    className="flex-1 py-2.5 px-4 border border-error text-error rounded-lg font-medium hover:bg-red-50 disabled:opacity-50"
                  >
                    <i className="fa-solid fa-times mr-1"></i>
                    拒絕
                  </button>
                  <button
                    onClick={() => handleAcceptTask(task.booking_id)}
                    disabled={actionLoading === task.booking_id}
                    className="flex-1 py-2.5 px-4 bg-primary hover:bg-primaryHover text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    {actionLoading === task.booking_id ? (
                      <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : (
                      <>
                        <i className="fa-solid fa-check mr-1"></i>
                        接單
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Tasks */}
      {activeTasks.length > 0 && (
        <div className="max-w-lg mx-auto px-4 mt-4 mb-6">
          <h2 className="text-lg font-bold text-textPrimary mb-3">
            <i className="fa-solid fa-route text-primary mr-2"></i>
            進行中任務 ({activeTasks.length})
          </h2>
          <div className="space-y-3">
            {activeTasks.map((task) => (
              <div key={task.id} className="bg-surface rounded-xl p-4 shadow-sm border border-primary">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs text-textSecondary">任務</span>
                    <p className="font-bold text-textPrimary">#{task.booking_id.slice(-4)}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(task.status)}`}>
                    {getStatusText(task.status)}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-clock text-primary"></i>
                    <span className={`font-medium ${isApproaching(task.pickup_time) ? 'text-orange-600 animate-pulse' : 'text-textPrimary'}`}>
                      {formatTime(task.pickup_time)}
                      {isApproaching(task.pickup_time) && ' (即將到達)'}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-circle-notch text-primary mt-1.5 text-xs"></i>
                    <span className="text-textPrimary">{task.pickup_address}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-location-dot text-error mt-1.5 text-xs"></i>
                    <span className="text-textPrimary">{task.dropoff_address}</span>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-textPrimary">{task.passenger_name}</p>
                      {task.passenger_phone && (
                        <a href={`tel:${task.passenger_phone}`} className="text-xs text-primary">
                          <i className="fa-solid fa-phone mr-1"></i>
                          {task.passenger_phone}
                        </a>
                      )}
                    </div>
                    <span className="font-bold text-primary">NT$ {task.estimated_fare}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-4">
                  {task.status === 'ASSIGNED' && (
                    <button
                      onClick={() => handleConfirmStart(task.booking_id)}
                      disabled={actionLoading === task.booking_id}
                      className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold disabled:opacity-50"
                    >
                      {actionLoading === task.booking_id ? (
                        <i className="fa-solid fa-spinner fa-spin"></i>
                      ) : (
                        <>
                          <i className="fa-solid fa-play mr-2"></i>
                          確認出發
                        </>
                      )}
                    </button>
                  )}
                  {task.status === 'CONFIRMED' && (
                    <button
                      onClick={() => handleConfirmStart(task.booking_id)}
                      disabled={actionLoading === task.booking_id}
                      className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold disabled:opacity-50"
                    >
                      {actionLoading === task.booking_id ? (
                        <i className="fa-solid fa-spinner fa-spin"></i>
                      ) : (
                        <>
                          <i className="fa-solid fa-play mr-2"></i>
                          確認出發
                        </>
                      )}
                    </button>
                  )}
                  {task.status === 'STARTING' && (
                    <button
                      onClick={() => handleCompleteTrip(task.booking_id)}
                      disabled={actionLoading === task.booking_id}
                      className="w-full py-3 bg-primary hover:bg-primaryHover text-white rounded-lg font-bold disabled:opacity-50"
                    >
                      {actionLoading === task.booking_id ? (
                        <i className="fa-solid fa-spinner fa-spin"></i>
                      ) : (
                        <>
                          <i className="fa-solid fa-flag-checkered mr-2"></i>
                          完成行程
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && tasks.length === 0 && (
        <div className="max-w-lg mx-auto px-4 mt-8">
          <div className="bg-surface rounded-xl p-8 text-center">
            <i className="fa-solid fa-car text-5xl text-gray-300 mb-4"></i>
            <h3 className="text-lg font-bold text-textPrimary mb-2">目前沒有任務</h3>
            <p className="text-textSecondary text-sm">
              {isOnline ? '等待系統派發新任務...' : '請先上線才能接收任務'}
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="max-w-lg mx-auto px-4 mt-8">
          <div className="bg-surface rounded-xl p-8 text-center">
            <i className="fa-solid fa-spinner fa-spin text-3xl text-primary mb-4"></i>
            <p className="text-textSecondary">載入中...</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default DriverHome