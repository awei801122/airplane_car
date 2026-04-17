import React, { useState } from 'react'
import { API_BASE } from '../../config/api'
import { Booking, BookingType, BookingCategory, PaymentStatus, BookingStatus } from '../../types'

const AIRPORTS = [
  { code: 'TPE', name: '桃園國際機場', address: '桃園市大園區航站南路' },
  { code: 'TSA', name: '松山國際機場', address: '台北市松山區敦化北路' }
]

interface BookingFormProps {
  lineUserId: string
  onSuccess: (booking: Booking) => void
}

interface FormData {
  airport: typeof AIRPORTS[0] | null
  direction: 'to' | 'from'
  flightNumber: string
  pickupAddress: string
  dropoffAddress: string
  pickupTime: string
  passengerCount: number
  luggageCount: number
  notes: string
  paymentType: 'deposit' | 'full'
}

interface FareResult {
  distance: number
  estimatedFare: number
}

const BookingForm: React.FC<BookingFormProps> = ({ lineUserId, onSuccess }) => {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fareResult, setFareResult] = useState<FareResult | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>({
    airport: null,
    direction: 'to',
    flightNumber: '',
    pickupAddress: '',
    dropoffAddress: '',
    pickupTime: '',
    passengerCount: 1,
    luggageCount: 0,
    notes: '',
    paymentType: 'deposit'
  })

  const handleAirportSelect = (airport: typeof AIRPORTS[0]) => {
    setFormData(prev => ({
      ...prev,
      airport,
      pickupAddress: prev.direction === 'from' ? airport.address : prev.pickupAddress,
      dropoffAddress: prev.direction === 'to' ? airport.address : prev.dropoffAddress
    }))
  }

  const handleDirectionChange = (direction: 'to' | 'from') => {
    setFormData(prev => ({
      ...prev,
      direction,
      pickupAddress: direction === 'from' ? (prev.airport?.address || '') : '',
      dropoffAddress: direction === 'to' ? (prev.airport?.address || '') : ''
    }))
  }

  const handleAddressChange = (field: 'pickupAddress' | 'dropoffAddress', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const calculateFare = async () => {
    if (!formData.pickupAddress || !formData.dropoffAddress) {
      setError('請填寫上車地和目的地')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/booking/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_address: formData.pickupAddress,
          dropoff_address: formData.dropoffAddress
        })
      })
      const data = await res.json()
      if (data.success) {
        setFareResult(data.data)
        setStep(3)
      } else {
        setError(data.error || '無法計算車資，請稍後再試')
      }
    } catch (err) {
      setError('網路錯誤，請檢查連線')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.pickupAddress || !formData.dropoffAddress || !formData.pickupTime) {
      setError('請填寫所有必填欄位')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_user_id: lineUserId,
          pickup_address: formData.pickupAddress,
          dropoff_address: formData.dropoffAddress,
          pickup_time: new Date(formData.pickupTime).toISOString(),
          passenger_count: formData.passengerCount,
          luggage_count: formData.luggageCount,
          flight_number: formData.flightNumber || undefined,
          notes: formData.notes || undefined,
          estimated_fare: fareResult?.estimatedFare || 0,
          payment_type: formData.paymentType
        })
      })
      const data = await res.json()
      if (data.success) {
        setBookingId(data.booking_id)
        const newBooking: Booking = {
          id: data.booking_id,
          customer_id: lineUserId,
          pickup_address: formData.pickupAddress,
          dropoff_address: formData.dropoffAddress,
          pickup_time: formData.pickupTime,
          passenger_count: formData.passengerCount,
          luggage_count: formData.luggageCount,
          flight_number: formData.flightNumber || undefined,
          notes: formData.notes || undefined,
          estimated_fare: fareResult?.estimatedFare || 0,
          payment_status: formData.paymentType === 'deposit' ? PaymentStatus.DEPOSIT_PAID : PaymentStatus.UNPAID,
          deposit_amount: formData.paymentType === 'deposit' ? 300 : 0,
          booking_type: BookingType.SCHEDULED,
          category: BookingCategory.AIRPORT,
          status: BookingStatus.PENDING,
          created_at: new Date().toISOString()
        }
        onSuccess(newBooking)
      } else {
        setError(data.error || '預約失敗，請稍後再試')
      }
    } catch (err) {
      setError('網路錯誤，請檢查連線')
    } finally {
      setLoading(false)
    }
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 py-3 bg-surface">
      {[1, 2, 3, 4, 5].map(s => (
        <React.Fragment key={s}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
            ${step === s ? 'bg-primary text-white' : step > s ? 'bg-success text-white' : 'bg-gray-200 text-gray-500'}`}>
            {step > s ? <i className="fa-solid fa-check"></i> : s}
          </div>
          {s < 5 && <div className={`w-8 h-0.5 ${step > s ? 'bg-success' : 'bg-gray-200'}`}></div>}
        </React.Fragment>
      ))}
    </div>
  )

  const renderStep1 = () => (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-bold text-textPrimary mb-3">
          <i className="fa-solid fa-plane mr-2 text-primary"></i>
          選擇機場
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {AIRPORTS.map(airport => (
            <button
              key={airport.code}
              onClick={() => handleAirportSelect(airport)}
              className={`p-4 rounded-xl border-2 transition-all ${
                formData.airport?.code === airport.code
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-surface hover:border-primary/50'
              }`}
            >
              <div className="text-2xl mb-1">{airport.code === 'TPE' ? '🛫' : '🛬'}</div>
              <div className="font-bold text-textPrimary text-sm">{airport.name}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-textPrimary mb-3">
          <i className="fa-solid fa-route mr-2 text-primary"></i>
          行駛方向
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleDirectionChange('to')}
            className={`p-4 rounded-xl border-2 transition-all ${
              formData.direction === 'to'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-surface hover:border-primary/50'
            }`}
          >
            <i className="fa-solid fa-plane-arrival text-2xl text-primary mb-2"></i>
            <div className="font-bold text-textPrimary">去機場</div>
            <div className="text-xs text-textSecondary mt-1">上車 → 機場</div>
          </button>
          <button
            onClick={() => handleDirectionChange('from')}
            className={`p-4 rounded-xl border-2 transition-all ${
              formData.direction === 'from'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-surface hover:border-primary/50'
            }`}
          >
            <i className="fa-solid fa-plane-departure text-2xl text-primary mb-2"></i>
            <div className="font-bold text-textPrimary">回程</div>
            <div className="text-xs text-textSecondary mt-1">機場 → 上車</div>
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-textPrimary mb-3">
          <i className="fa-solid fa-ticket mr-2 text-primary"></i>
          航班資訊（選填）
        </h3>
        <input
          type="text"
          placeholder="例如：BR68、CI123"
          value={formData.flightNumber}
          onChange={e => setFormData(prev => ({ ...prev, flightNumber: e.target.value.toUpperCase() }))}
          className="w-full px-4 py-3 border-2 border-border rounded-xl focus:border-primary focus:outline-none bg-surface"
        />
      </div>

      <button
        onClick={() => {
          if (!formData.airport) {
            setError('請選擇機場')
            return
          }
          setError(null)
          setStep(2)
        }}
        className="w-full bg-primary hover:bg-primaryHover text-white font-bold py-4 rounded-xl transition-colors"
      >
        下一步
      </button>
    </div>
  )

  const renderStep2 = () => (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-sm font-bold text-textPrimary mb-2">
          <i className="fa-solid fa-circle-notch mr-1 text-primary"></i>
          上車地點
        </label>
        <input
          type="text"
          placeholder="請輸入上車地址"
          value={formData.pickupAddress}
          onChange={e => handleAddressChange('pickupAddress', e.target.value)}
          className="w-full px-4 py-3 border-2 border-border rounded-xl focus:border-primary focus:outline-none bg-surface"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-textPrimary mb-2">
          <i className="fa-solid fa-location-dot mr-1 text-error"></i>
          目的地
        </label>
        <input
          type="text"
          placeholder="請輸入目的地地址"
          value={formData.dropoffAddress}
          onChange={e => handleAddressChange('dropoffAddress', e.target.value)}
          className="w-full px-4 py-3 border-2 border-border rounded-xl focus:border-primary focus:outline-none bg-surface"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-textPrimary mb-2">
          <i className="fa-solid fa-calendar mr-1 text-primary"></i>
          上車時間
        </label>
        <input
          type="datetime-local"
          value={formData.pickupTime}
          onChange={e => setFormData(prev => ({ ...prev, pickupTime: e.target.value }))}
          min={new Date().toISOString().slice(0, 16)}
          className="w-full px-4 py-3 border-2 border-border rounded-xl focus:border-primary focus:outline-none bg-surface"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-textPrimary mb-2">
            <i className="fa-solid fa-users mr-1 text-primary"></i>
            乘客數
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFormData(prev => ({ ...prev, passengerCount: Math.max(1, prev.passengerCount - 1) }))}
              className="w-10 h-10 rounded-full bg-gray-100 text-textPrimary font-bold hover:bg-gray-200"
            >
              -
            </button>
            <span className="text-xl font-bold text-textPrimary w-8 text-center">{formData.passengerCount}</span>
            <button
              onClick={() => setFormData(prev => ({ ...prev, passengerCount: Math.min(4, prev.passengerCount + 1) }))}
              className="w-10 h-10 rounded-full bg-gray-100 text-textPrimary font-bold hover:bg-gray-200"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-textPrimary mb-2">
            <i className="fa-solid fa-suitcase mr-1 text-primary"></i>
            行李數
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFormData(prev => ({ ...prev, luggageCount: Math.max(0, prev.luggageCount - 1) }))}
              className="w-10 h-10 rounded-full bg-gray-100 text-textPrimary font-bold hover:bg-gray-200"
            >
              -
            </button>
            <span className="text-xl font-bold text-textPrimary w-8 text-center">{formData.luggageCount}</span>
            <button
              onClick={() => setFormData(prev => ({ ...prev, luggageCount: Math.min(6, prev.luggageCount + 1) }))}
              className="w-10 h-10 rounded-full bg-gray-100 text-textPrimary font-bold hover:bg-gray-200"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-textPrimary mb-2">
          <i className="fa-solid fa-comment mr-1 text-primary"></i>
          備註（選填）
        </label>
        <textarea
          placeholder="有什麼需要特別告知的嗎？"
          value={formData.notes}
          onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
          className="w-full px-4 py-3 border-2 border-border rounded-xl focus:border-primary focus:outline-none bg-surface resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep(1)}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-textPrimary font-bold py-4 rounded-xl transition-colors"
        >
          上一步
        </button>
        <button
          onClick={calculateFare}
          disabled={loading}
          className="flex-1 bg-primary hover:bg-primaryHover text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : '計算車資'}
        </button>
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="p-4 space-y-6">
      <div className="bg-surface rounded-xl p-4 border border-border">
        <h3 className="text-lg font-bold text-textPrimary mb-4">
          <i className="fa-solid fa-receipt mr-2 text-primary"></i>
          車資估算
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-textSecondary">距離</span>
            <span className="font-bold text-textPrimary">{(fareResult?.distance || 0).toFixed(1)} 公里</span>
          </div>
          <div className="flex justify-between">
            <span className="text-textSecondary">預估車資</span>
            <span className="font-bold text-2xl text-primary">NT$ {fareResult?.estimatedFare || 0}</span>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl p-4 border border-border">
        <h3 className="text-lg font-bold text-textPrimary mb-4">
          <i className="fa-solid fa-route mr-2 text-primary"></i>
          行程摘要
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <i className="fa-solid fa-circle-notch text-primary mt-1.5"></i>
            <div>
              <div className="text-xs text-textSecondary">上車</div>
              <div className="text-textPrimary">{formData.pickupAddress}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <i className="fa-solid fa-location-dot text-error mt-1.5"></i>
            <div>
              <div className="text-xs text-textSecondary">目的地</div>
              <div className="text-textPrimary">{formData.dropoffAddress}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <i className="fa-solid fa-clock text-warning mt-1.5"></i>
            <div>
              <div className="text-xs text-textSecondary">時間</div>
              <div className="text-textPrimary">
                {formData.pickupTime ? new Date(formData.pickupTime).toLocaleString('zh-TW') : '-'}
              </div>
            </div>
          </div>
          {formData.flightNumber && (
            <div className="flex items-start gap-2">
              <i className="fa-solid fa-ticket text-primary mt-1.5"></i>
              <div>
                <div className="text-xs text-textSecondary">航班</div>
                <div className="text-textPrimary">{formData.flightNumber}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep(2)}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-textPrimary font-bold py-4 rounded-xl transition-colors"
        >
          修改行程
        </button>
        <button
          onClick={() => setStep(4)}
          className="flex-1 bg-primary hover:bg-primaryHover text-white font-bold py-4 rounded-xl transition-colors"
        >
          選擇付款
        </button>
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-bold text-textPrimary mb-4">
          <i className="fa-solid fa-credit-card mr-2 text-primary"></i>
          選擇付款方式
        </h3>
        <div className="space-y-3">
          <button
            onClick={() => setFormData(prev => ({ ...prev, paymentType: 'deposit' }))}
            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
              formData.paymentType === 'deposit'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-surface hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center
                ${formData.paymentType === 'deposit' ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                {formData.paymentType === 'deposit' && <i className="fa-solid fa-check text-white text-xs"></i>}
              </div>
              <div>
                <div className="font-bold text-textPrimary">選項 A：支付訂金 $300</div>
                <div className="text-sm text-textSecondary">尾款 ${(fareResult?.estimatedFare || 0) - 300} 以現金支付</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setFormData(prev => ({ ...prev, paymentType: 'full' }))}
            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
              formData.paymentType === 'full'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-surface hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center
                ${formData.paymentType === 'full' ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                {formData.paymentType === 'full' && <i className="fa-solid fa-check text-white text-xs"></i>}
              </div>
              <div>
                <div className="font-bold text-textPrimary">選項 B：全額付款</div>
                <div className="text-sm text-textSecondary">直接支付全部車資 NT$ {fareResult?.estimatedFare || 0}</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="bg-warning/10 rounded-xl p-4 border border-warning/30">
        <div className="flex items-start gap-3">
          <i className="fa-solid fa-info-circle text-warning mt-0.5"></i>
          <div className="text-sm text-textPrimary">
            行程確立後，司機將透過 LINE 與您聯繫，請保持訊息暢通。
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep(3)}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-textPrimary font-bold py-4 rounded-xl transition-colors"
        >
          上一步
        </button>
        <button
          onClick={() => setStep(5)}
          className="flex-1 bg-primary hover:bg-primaryHover text-white font-bold py-4 rounded-xl transition-colors"
        >
          確認預約
        </button>
      </div>
    </div>
  )

  const renderStep5 = () => (
    <div className="p-4 space-y-6">
      <div className="text-center">
        <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="fa-solid fa-check text-4xl text-success"></i>
        </div>
        <h3 className="text-2xl font-bold text-textPrimary mb-2">預約成功！</h3>
        <p className="text-textSecondary">感謝您的預約，我們將儘快為您派車</p>
      </div>

      <div className="bg-surface rounded-xl p-4 border border-border space-y-3">
        <div className="flex justify-between">
          <span className="text-textSecondary">訂單編號</span>
          <span className="font-bold text-textPrimary">#{bookingId?.slice(-4) || '----'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-textSecondary">上車地點</span>
          <span className="text-textPrimary text-right max-w-[60%]">{formData.pickupAddress}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-textSecondary">目的地</span>
          <span className="text-textPrimary text-right max-w-[60%]">{formData.dropoffAddress}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-textSecondary">上車時間</span>
          <span className="text-textPrimary">
            {formData.pickupTime ? new Date(formData.pickupTime).toLocaleString('zh-TW') : '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-textSecondary">預估車資</span>
          <span className="font-bold text-primary">NT$ {fareResult?.estimatedFare || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-textSecondary">付款方式</span>
          <span className="text-textPrimary">
            {formData.paymentType === 'deposit' ? `訂金 $300（現金尾款 $${(fareResult?.estimatedFare || 0) - 300}）` : '全額付款'}
          </span>
        </div>
      </div>

      <div className="bg-primary/10 rounded-xl p-4 border border-primary/30">
        <div className="flex items-start gap-3">
          <i className="fa-solid fa-bell text-primary mt-0.5"></i>
          <div className="text-sm text-textPrimary">
            司機接單後，將透過 LINE 發送通知，請留意訊息。
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-success hover:bg-success/90 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50"
      >
        {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : '完成'}
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      {renderStepIndicator()}

      {error && (
        <div className="mx-4 mt-4 bg-error/10 border border-error/30 rounded-xl p-3">
          <div className="flex items-center gap-2 text-error text-sm">
            <i className="fa-solid fa-exclamation-circle"></i>
            {error}
          </div>
        </div>
      )}

      <div className="mt-4">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </div>
    </div>
  )
}

export default BookingForm