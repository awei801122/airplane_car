// OpenRouteService API integration for distance calculation
const ORS_API_KEY = process.env.OPENROUTESERVICE_API_KEY
const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car'

/**
 * Calculate driving distance between two addresses using OpenRouteService
 * @param {string} pickupAddress - Start address
 * @param {string} dropoffAddress - End address
 * @returns {Promise<{distance: number, duration: number}>} Distance in km and duration in minutes
 */
export async function getRouteDistance(pickupAddress, dropoffAddress) {
  if (!ORS_API_KEY) {
    console.warn('OPENROUTESERVICE_API_KEY not set, using mock distance')
    // Return mock data for development
    return { distance: 30, duration: 40 }
  }

  try {
    // Geocode addresses first
    const pickupGeo = await geocodeAddress(pickupAddress)
    const dropoffGeo = await geocodeAddress(dropoffAddress)

    if (!pickupGeo || !dropoffGeo) {
      throw new Error('Could not geocode addresses')
    }

    const response = await fetch(`${ORS_URL}?api_key=${ORS_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        coordinates: [
          [pickupGeo.lon, pickupGeo.lat],
          [dropoffGeo.lon, dropoffGeo.lat]
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`OpenRouteService error: ${response.status}`)
    }

    const data = await response.json()
    const distanceMeters = data.routes[0].summary.distance // meters
    const durationSeconds = data.routes[0].summary.duration // seconds

    return {
      distance: distanceMeters / 1000, // convert to km
      duration: Math.round(durationSeconds / 60) // convert to minutes
    }
  } catch (error) {
    console.error('OpenRouteService error:', error)
    throw error
  }
}

/**
 * Geocode an address to coordinates
 * @param {string} address - Address to geocode
 * @returns {Promise<{lat: number, lon: number}|null>}
 */
async function geocodeAddress(address) {
  const geocodeUrl = `https://api.openrouteservice.org/v2/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(address)}&size=1`

  try {
    const response = await fetch(geocodeUrl)
    if (!response.ok) return null

    const data = await response.json()
    if (data.features && data.features.length > 0) {
      const [lon, lat] = data.features[0].geometry.coordinates
      return { lat, lon }
    }
    return null
  } catch (error) {
    console.error('Geocoding error:', error)
    return null
  }
}

/**
 * Calculate fare based on distance
 * @param {number} distanceKm - Distance in kilometers
 * @param {object} settings - { baseFare, pricePerKm, nightSurcharge }
 * @returns {number} Estimated fare in NTD
 */
export function calculateFare(distanceKm, settings) {
  const { baseFare = 150, pricePerKm = 25 } = settings

  // Check if night time (22:00 - 06:00)
  const hour = new Date().getHours()
  const isNight = hour >= 22 || hour < 6
  const nightSurcharge = isNight ? (settings.nightSurcharge || 20) : 0

  const fare = baseFare + (distanceKm * pricePerKm) + nightSurcharge
  return Math.round(fare)
}
