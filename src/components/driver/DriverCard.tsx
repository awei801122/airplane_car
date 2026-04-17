import React from 'react'
import { DriverStatus } from '../../types'

interface DriverCardProps {
  driver: {
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
  driverName?: string
  driverPhone?: string
  onCall?: () => void
}

const DriverCard: React.FC<DriverCardProps> = ({ driver, driverName, driverPhone, onCall }) => {
  const getStatusColor = (status: DriverStatus) => {
    switch (status) {
      case DriverStatus.AVAILABLE: return 'bg-success text-white'
      case DriverStatus.BUSY: return 'bg-warning text-white'
      case DriverStatus.OFFLINE: return 'bg-gray-400 text-white'
      default: return 'bg-gray-400 text-white'
    }
  }

  const getStatusText = (status: DriverStatus) => {
    switch (status) {
      case DriverStatus.AVAILABLE: return '待命'
      case DriverStatus.BUSY: return '服務中'
      case DriverStatus.OFFLINE: return '離線'
      default: return '未知'
    }
  }

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating)
    const hasHalf = rating % 1 >= 0.5
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0)

    return (
      <div className="flex items-center gap-1">
        {[...Array(fullStars)].map((_, i) => (
          <i key={`full-${i}`} className="fa-solid fa-star text-warning text-sm"></i>
        ))}
        {hasHalf && <i className="fa-solid fa-star-half-stroke text-warning text-sm"></i>}
        {[...Array(emptyStars)].map((_, i) => (
          <i key={`empty-${i}`} className="fa-regular fa-star text-gray-300 text-sm"></i>
        ))}
        <span className="text-sm text-textSecondary ml-1">{rating.toFixed(1)}</span>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl p-4 border border-border shadow-sm">
      {/* Header with status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar placeholder */}
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <i className="fa-solid fa-user text-xl text-primary"></i>
          </div>
          <div>
            <h4 className="font-bold text-textPrimary">{driverName || '司機'}</h4>
            {renderStars(driver.rating)}
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(driver.status)}`}>
          {getStatusText(driver.status)}
        </span>
      </div>

      {/* Vehicle info */}
      <div className="bg-background rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-car text-primary"></i>
            <span className="font-medium text-textPrimary">{driver.vehicle_model}</span>
          </div>
          <span className="font-bold text-textPrimary bg-surface px-2 py-1 rounded">
            {driver.license_plate}
          </span>
        </div>
        <div className="mt-2 text-sm text-textSecondary">
          <span>已完成 {driver.total_rides} 趟行程</span>
        </div>
      </div>

      {/* Contact button */}
      {driverPhone && (
        <a
          href={`tel:${driverPhone}`}
          className="w-full flex items-center justify-center gap-2 bg-success hover:bg-success/90 text-white font-bold py-3 rounded-xl transition-colors"
        >
          <i className="fa-solid fa-phone"></i>
          致電司機
        </a>
      )}

      {/* OnCall callback if provided */}
      {onCall && !driverPhone && (
        <button
          onClick={onCall}
          className="w-full flex items-center justify-center gap-2 bg-success hover:bg-success/90 text-white font-bold py-3 rounded-xl transition-colors"
        >
          <i className="fa-solid fa-phone"></i>
          致電司機
        </button>
      )}
    </div>
  )
}

export default DriverCard