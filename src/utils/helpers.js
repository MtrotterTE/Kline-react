// Helper function to calculate time elapsed in seconds
function calculateTimeElapsed(timestamp1, timestamp2) {
    return (new Date(timestamp2) - new Date(timestamp1)) / 1000 // Time in seconds
}

// Safely convert JSON object to array
function safeToArray(json) {
    if (Array.isArray(json)) return json
    if (json && typeof json === 'object') {
        return Object.values(json).filter(v => typeof v === 'object' && v !== json)
    }
    return []
}

function toRadians(deg) {
    return deg * Math.PI / 180;
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000; // meters
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Find nearest vertex index on polyline
function findNearestIndex(path, point) {
    let minDist = Infinity;
    let idx = 0;
    path.forEach((p, i) => {
      const d = haversine(p.lat, p.lon, point.lat, point.lon);
      if (d < minDist) {
        minDist = d;
        idx = i;
      }
    });
    return idx;
}

function getDistanceInFeet(lat1, lon1, lat2, lon2) {
    const toRadians = (degrees) => degrees * (Math.PI / 180);
    const earthRadiusFeet = 20903520; // Earth's radius in feet
  
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
  
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;
  
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
    const distance = earthRadiusFeet * c;
    return distance;
}

/**
 * Check if two coordinates are within a certain distance (in feet)
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2 (target)
 * @param {number} lon2 - Longitude of point 2 (target)
 * @param {number} distanceInFeet - Distance threshold in feet (default 500)
 * @returns {boolean} - True if within distance, false otherwise
 */
function isWithinDistance(lat1, lon1, lat2, lon2, distanceInFeet = 500) {
    const distance = getDistanceInFeet(lat1, lon1, lat2, lon2);
    return distance <= distanceInFeet;
}

export { calculateTimeElapsed, safeToArray, findNearestIndex, isWithinDistance, getDistanceInFeet };