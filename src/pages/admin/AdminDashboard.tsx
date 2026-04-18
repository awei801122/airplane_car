import React, { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '../../config/api'
import {
  Booking, BookingStatus, Driver, DriverStatus,
  Alert
} from '../../types'

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dispatch' | 'drivers' | 'alerts' | 'reports' | 'manage'>('dispatch')
  const [statusFilter, setStatusFilter] = useState<'pending' | 'assigned' | 'confirmed' | 'all'>('pending')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [error, setError] = useState<string | null>(null)

  // Assign driver modal
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [selectedDriverId, setSelectedDriverId] = useState<string>('')
  const [assigning, setAssigning] = useState(false)

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/bookings`)
      if (!res.ok) {
        console.error('Failed to fetch bookings:', res.status)
        return
      }
      const data = await res.json()
      if (data.success) setBookings(data.data)
    } catch (err) {
      console.error('Failed to fetch bookings:', err)
    }
  }, [])

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/drivers`)
      if (!res.ok) {
        console.error('Failed to fetch drivers:', res.status)
        return
      }
      const data = await res.json()
      if (data.success) setDrivers(data.data)
    } catch (err) {
      console.error('Failed to fetch drivers:', err)
    }
  }, [])

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/dashboard`)
      if (!res.ok) {
        console.error('Failed to fetch dashboard:', res.status)
        return
      }
      const data = await res.json()
      if (data.success) {
        setAlerts(data.data.alerts || [])
      }
    } catch (err) {
      console.error('Failed to fetch dashboard:', err)
    }
  }, [])

  useEffect(() => {
    fetchBookings()
    fetchDrivers()
    fetchDashboard()
  }, [fetchBookings, fetchDrivers, fetchDashboard])

  const filteredBookings = bookings.filter(b => {
    const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000)
    if (new Date(b.pickup_time) > twoHoursLater) return false
    if (statusFilter === 'all') return true
    if (statusFilter === 'pending') return b.status === BookingStatus.PENDING
    if (statusFilter === 'assigned') return b.status === BookingStatus.ASSIGNED
    if (statusFilter === 'confirmed') return b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.STARTING
    return true
  })

  const onlineDrivers = drivers.filter(d => d.status === DriverStatus.AVAILABLE)
  const busyDrivers = drivers.filter(d => d.status === DriverStatus.BUSY)
  const offlineDrivers = drivers.filter(d => d.status === DriverStatus.OFFLINE)

  const handleAssignClick = (booking: Booking) => {
    setSelectedBooking(booking)
    setSelectedDriverId('')
    setAssignModalOpen(true)
  }

  const handleConfirmAssign = async () => {
    if (!selectedBooking || !selectedDriverId) return
    setAssigning(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/admin/booking/${selectedBooking.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: selectedDriverId })
      })
      if (!res.ok) {
        console.error('Failed to assign driver:', res.status)
        setError('網路錯誤')
        return
      }
      const data = await res.json()
      if (data.success) {
        setAssignModalOpen(false)
        setSelectedBooking(null)
        fetchBookings()
        fetchDashboard()
      } else {
        setError(data.error || '指派失敗')
      }
    } catch (err) {
      console.error('Failed to assign driver:', err)
      setError('網路錯誤')
    } finally {
      setAssigning(false)
    }
  }

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.PENDING:
        return { bg: 'bg-warning/20', text: 'text-warning', label: '未派車' }
      case BookingStatus.ASSIGNED:
        return { bg: 'bg-primary/20', text: 'text-primary', label: '已派車' }
      case BookingStatus.CONFIRMED:
        return { bg: 'bg-blue-500/20', text: 'text-blue-600', label: '司機已出發' }
      case BookingStatus.STARTING:
        return { bg: 'bg-blue-600/20', text: 'text-blue-700', label: '行程中' }
      case BookingStatus.COMPLETED:
        return { bg: 'bg-success/20', text: 'text-success', label: '已完成' }
      case BookingStatus.CANCELLED:
        return { bg: 'bg-error/20', text: 'text-error', label: '已取消' }
      default:
        return { bg: 'bg-gray-200', text: 'text-gray-600', label: status }
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const renderTabBar = () => (
    <div className="flex overflow-x-auto gap-1 px-4 py-2 bg-surface border-b border-border">
      {([
        { key: 'dispatch', label: '調度儀表板', icon: 'fa-solid fa-list-check' },
        { key: 'drivers', label: '司機狀態牆', icon: 'fa-solid fa-car' },
        { key: 'alerts', label: '警示牆', icon: 'fa-solid fa-triangle-exclamation' },
        { key: 'reports', label: '每小時報表', icon: 'fa-solid fa-chart-line' },
        { key: 'manage', label: '司機管理', icon: 'fa-solid fa-users-gear' },
      ] as const).map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === tab.key
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-textSecondary hover:bg-gray-200'
          }`}
        >
          <i className={tab.icon}></i>
          {tab.label}
        </button>
      ))}
    </div>
  )

  const renderDispatch = () => (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['pending', 'assigned', 'confirmed', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === f
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-textSecondary hover:bg-gray-200'
            }`}
          >
            {f === 'pending' ? '未派車' : f === 'assigned' ? '已派車' : f === 'confirmed' ? '司機已出發' : '全部'}
            {f === 'pending' && ` (${bookings.filter(b => b.status === BookingStatus.PENDING).length})`}
            {f === 'assigned' && ` (${bookings.filter(b => b.status === BookingStatus.ASSIGNED).length})`}
          </button>
        ))}
      </div>

      {filteredBookings.length === 0 ? (
        <div className="text-center py-12 text-textSecondary">
          <i className="fa-solid fa-inbox text-4xl mb-3"></i>
          <p>目前沒有待處理的預約</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map(b => {
            const badge = getStatusBadge(b.status)
            return (
              <div key={b.id} className="bg-surface rounded-xl p-4 border border-border shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-textPrimary text-lg">#{b.id.slice(-4)}</div>
                    <div className="text-sm text-textSecondary">
                      {b.customer_name || b.customer_id.slice(-6)} · {b.passenger_count}人 · {b.luggage_count}件行李
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-circle-notch text-primary w-4"></i>
                    <span className="text-textSecondary">上車</span>
                    <span className="text-textPrimary">{b.pickup_address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-location-dot text-error w-4"></i>
                    <span className="text-textSecondary">目的地</span>
                    <span className="text-textPrimary">{b.dropoff_address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-clock text-warning w-4"></i>
                    <span className="text-textSecondary">時間</span>
                    <span className="text-textPrimary font-medium">{formatTime(b.pickup_time)}</span>
                  </div>
                  {b.license_plate && (
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-car text-primary w-4"></i>
                      <span className="text-textSecondary">司機</span>
                      <span className="text-textPrimary">{b.driver_name} · {b.license_plate}</span>
                    </div>
                  )}
                  {b.flight_number && (
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-ticket text-primary w-4"></i>
                      <span className="text-textPrimary">{b.flight_number}</span>
                    </div>
                  )}
                </div>
                {b.status === BookingStatus.PENDING && (
                  <button
                    onClick={() => handleAssignClick(b)}
                    className="mt-3 w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-colors"
                  >
                    <i className="fa-solid fa-user-plus mr-2"></i>
                    指派司機
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const renderDrivers = () => (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-success/10 rounded-xl p-4 text-center border border-success/20">
          <div className="text-3xl font-bold text-success">{onlineDrivers.length}</div>
          <div className="text-sm text-textSecondary mt-1">待命司機</div>
        </div>
        <div className="bg-warning/10 rounded-xl p-4 text-center border border-warning/20">
          <div className="text-3xl font-bold text-warning">{busyDrivers.length}</div>
          <div className="text-sm text-textSecondary mt-1">服務中</div>
        </div>
        <div className="bg-gray-200 rounded-xl p-4 text-center border border-gray-300">
          <div className="text-3xl font-bold text-gray-500">{offlineDrivers.length}</div>
          <div className="text-sm text-textSecondary mt-1">離線</div>
        </div>
      </div>

      {onlineDrivers.length === 0 ? (
        <div className="text-center py-8 text-textSecondary">
          <i className="fa-solid fa-car text-4xl mb-3"></i>
          <p>目前沒有待命司機</p>
        </div>
      ) : (
        <div className="space-y-3">
          {onlineDrivers.map(d => (
            <div key={d.id} className="bg-surface rounded-xl p-4 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-user text-success text-xl"></i>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-textPrimary">{d.user_id.slice(-6)}</div>
                  <div className="text-sm text-textSecondary">{d.vehicle_model} · {d.license_plate}</div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-warning">
                    <i className="fa-solid fa-star text-sm"></i>
                    <span className="font-medium">{d.rating.toFixed(1)}</span>
                  </div>
                  <div className="text-xs text-textSecondary">{d.total_rides} 趟</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderAlerts = () => {
    const unconfirmed = alerts.filter(a => a.type === 'UNCONFIRMED')
    const overdue = alerts.filter(a => a.type === 'UNASSIGNED')
    const rejected = alerts.filter(a => a.type === 'REJECTED')

    return (
      <div className="p-4 space-y-4">
        {unconfirmed.length > 0 && (
          <div>
            <h3 className="font-bold text-textPrimary mb-2 flex items-center gap-2">
              <i className="fa-solid fa-clock text-warning"></i>
              司機未確認出發 ({unconfirmed.length})
            </h3>
            <div className="space-y-2">
              {unconfirmed.map(a => (
                <div key={a.id} className="bg-warning/10 rounded-xl p-3 border border-warning/30 text-sm">
                  <span className="font-medium text-textPrimary">#{a.booking_id.slice(-4)}</span>
                  <span className="text-textSecondary ml-2">{a.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {overdue.length > 0 && (
          <div>
            <h3 className="font-bold text-textPrimary mb-2 flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-error"></i>
              逾期未指派 ({overdue.length})
            </h3>
            <div className="space-y-2">
              {overdue.map(a => (
                <div key={a.id} className="bg-error/10 rounded-xl p-3 border border-error/30 text-sm">
                  <span className="font-medium text-textPrimary">#{a.booking_id.slice(-4)}</span>
                  <span className="text-textSecondary ml-2">{a.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {rejected.length > 0 && (
          <div>
            <h3 className="font-bold text-textPrimary mb-2 flex items-center gap-2">
              <i className="fa-solid fa-ban text-gray-500"></i>
              被拒絕的任務 ({rejected.length})
            </h3>
            <div className="space-y-2">
              {rejected.map(a => (
                <div key={a.id} className="bg-gray-100 rounded-xl p-3 border border-gray-300 text-sm">
                  <span className="font-medium text-textPrimary">#{a.booking_id.slice(-4)}</span>
                  <span className="text-textSecondary ml-2">{a.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {alerts.length === 0 && (
          <div className="text-center py-12 text-textSecondary">
            <i className="fa-solid fa-check-circle text-4xl text-success mb-3"></i>
            <p>目前沒有警示</p>
          </div>
        )}
      </div>
    )
  }

  const renderReports = () => (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-xl p-4 border border-border text-center">
          <div className="text-3xl font-bold text-primary">{bookings.length}</div>
          <div className="text-sm text-textSecondary mt-1">今日預約</div>
        </div>
        <div className="bg-surface rounded-xl p-4 border border-border text-center">
          <div className="text-3xl font-bold text-success">
            {bookings.filter(b => b.status === BookingStatus.COMPLETED).length}
          </div>
          <div className="text-sm text-textSecondary mt-1">已完成</div>
        </div>
        <div className="bg-surface rounded-xl p-4 border border-border text-center">
          <div className="text-3xl font-bold text-warning">
            {bookings.filter(b => b.status === BookingStatus.PENDING).length}
          </div>
          <div className="text-sm text-textSecondary mt-1">待指派</div>
        </div>
        <div className="bg-surface rounded-xl p-4 border border-border text-center">
          <div className="text-3xl font-bold text-blue-600">
            {drivers.filter(d => d.status !== DriverStatus.OFFLINE).length}
          </div>
          <div className="text-sm text-textSecondary mt-1">在線司機</div>
        </div>
      </div>

      <div className="bg-surface rounded-xl p-4 border border-border">
        <h3 className="font-bold text-textPrimary mb-3 flex items-center gap-2">
          <i className="fa-solid fa-clock text-primary"></i>
          即時狀態
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-textSecondary">未派車</span>
            <span className="font-medium text-warning">{bookings.filter(b => b.status === BookingStatus.PENDING).length} 筆</span>
          </div>
          <div className="flex justify-between">
            <span className="text-textSecondary">已派車待確認</span>
            <span className="font-medium text-primary">{bookings.filter(b => b.status === BookingStatus.ASSIGNED).length} 筆</span>
          </div>
          <div className="flex justify-between">
            <span className="text-textSecondary">司機已出發</span>
            <span className="font-medium text-blue-600">
              {bookings.filter(b => b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.STARTING).length} 筆
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-textSecondary">已完成</span>
            <span className="font-medium text-success">{bookings.filter(b => b.status === BookingStatus.COMPLETED).length} 筆</span>
          </div>
        </div>
      </div>
    </div>
  )

  const renderManage = () => (
    <div className="p-4 space-y-3">
      {drivers.length === 0 ? (
        <div className="text-center py-12 text-textSecondary">
          <i className="fa-solid fa-users text-4xl mb-3"></i>
          <p>尚無司機資料</p>
        </div>
      ) : (
        drivers.map(d => {
          const statusColors = {
            [DriverStatus.AVAILABLE]: 'bg-success text-white',
            [DriverStatus.BUSY]: 'bg-warning text-white',
            [DriverStatus.OFFLINE]: 'bg-gray-400 text-white',
          }
          const statusLabels = {
            [DriverStatus.AVAILABLE]: '待命',
            [DriverStatus.BUSY]: '服務中',
            [DriverStatus.OFFLINE]: '離線',
          }
          return (
            <div key={d.id} className="bg-surface rounded-xl p-4 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-user text-primary text-xl"></i>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-textPrimary">{d.user_id.slice(-6)}</div>
                  <div className="text-sm text-textSecondary">{d.vehicle_model} · {d.license_plate}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <i className="fa-solid fa-star text-warning text-xs"></i>
                    <span className="text-xs text-textSecondary">{d.rating.toFixed(1)} ({d.total_rides}趟)</span>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[d.status]}`}>
                  {statusLabels[d.status]}
                </span>
              </div>
            </div>
          )
        })
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary px-4 py-4">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <i className="fa-solid fa-gear"></i>
          管理員儀表板
        </h1>
      </div>

      {renderTabBar()}

      {error && (
        <div className="mx-4 mt-4 bg-error/10 border border-error/30 rounded-xl p-3">
          <div className="flex items-center gap-2 text-error text-sm">
            <i className="fa-solid fa-exclamation-circle"></i>
            {error}
          </div>
        </div>
      )}

      <div className="mt-2">
        {activeTab === 'dispatch' && renderDispatch()}
        {activeTab === 'drivers' && renderDrivers()}
        {activeTab === 'alerts' && renderAlerts()}
        {activeTab === 'reports' && renderReports()}
        {activeTab === 'manage' && renderManage()}
      </div>

      {/* Assign Driver Modal */}
      {assignModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setAssignModalOpen(false)}>
          <div className="bg-surface w-full max-w-md rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-textPrimary">
                <i className="fa-solid fa-user-plus text-primary mr-2"></i>
                指派司機
              </h2>
              <button onClick={() => setAssignModalOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="bg-background rounded-xl p-3 mb-4 text-sm">
              <div className="font-medium text-textPrimary">預約 #{selectedBooking.id.slice(-4)}</div>
              <div className="text-textSecondary mt-1">{formatTime(selectedBooking.pickup_time)} · {selectedBooking.pickup_address}</div>
            </div>

            {onlineDrivers.length === 0 ? (
              <div className="text-center py-8 text-textSecondary">
                <i className="fa-solid fa-car text-4xl mb-3"></i>
                <p>目前沒有待命司機</p>
              </div>
            ) : (
              <div className="space-y-2">
                {onlineDrivers.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDriverId(d.id)}
                    className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                      selectedDriverId === d.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedDriverId === d.id ? 'border-primary bg-primary' : 'border-gray-300'
                      }`}>
                        {selectedDriverId === d.id && <i className="fa-solid fa-check text-white text-xs"></i>}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-textPrimary">{d.user_id.slice(-6)}</div>
                        <div className="text-xs text-textSecondary">{d.vehicle_model} · {d.license_plate}</div>
                      </div>
                      <div className="flex items-center gap-1 text-warning">
                        <i className="fa-solid fa-star text-xs"></i>
                        <span className="text-xs">{d.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleConfirmAssign}
              disabled={!selectedDriverId || assigning}
              className="w-full mt-4 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {assigning ? <i className="fa-solid fa-spinner fa-spin"></i> : '確認指派'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
