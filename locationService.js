/**
 * Location Service for QuickFix
 * Handles geolocation, distance calculations, and location-based filtering
 */

class LocationService {
    /**
     * Calculate distance between two coordinates using Haversine formula
     * @param {number} lat1 - Latitude of first point
     * @param {number} lon1 - Longitude of first point
     * @param {number} lat2 - Latitude of second point
     * @param {number} lon2 - Longitude of second point
     * @returns {number} Distance in kilometers
     */
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        
        return Math.round(distance * 100) / 100; // Round to 2 decimal places
    }

    /**
     * Convert degrees to radians
     * @param {number} degrees - Degrees to convert
     * @returns {number} Radians
     */
    static toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Get coordinates from address using geocoding (mock implementation)
     * In production, integrate with Google Maps API or similar
     * @param {string} address - Address to geocode
     * @returns {Promise<{lat: number, lng: number}>} Coordinates
     */
    static async geocodeAddress(address) {
        // Mock geocoding - in production, use Google Maps Geocoding API
        const mockCoordinates = {
            'Nairobi': { lat: -1.2921, lng: 36.8219 },
            'Mombasa': { lat: -4.0435, lng: 39.6682 },
            'Kisumu': { lat: -0.0917, lng: 34.7680 },
            'Nakuru': { lat: -0.3074, lng: 36.0800 },
            'Eldoret': { lat: 0.5143, lng: 35.2698 }
        };

        // Default to Nairobi if address not found
        return mockCoordinates[address] || mockCoordinates['Nairobi'];
    }

    /**
     * Filter technicians by service radius
     * @param {Array} technicians - Array of technician objects
     * @param {number} userLat - User's latitude
     * @param {number} userLng - User's longitude
     * @param {number} maxDistance - Maximum distance in kilometers
     * @returns {Array} Filtered technicians within radius
     */
    static filterByRadius(technicians, userLat, userLng, maxDistance = 50) {
        return technicians.filter(tech => {
            if (!tech.location || !tech.serviceRadius) return false;
            
            // Get technician coordinates
            const techCoords = this.parseLocation(tech.location);
            if (!techCoords) return false;
            
            // Calculate distance
            const distance = this.calculateDistance(
                userLat, userLng,
                techCoords.lat, techCoords.lng
            );
            
            // Check if within service radius
            return distance <= Math.min(tech.serviceRadius, maxDistance);
        });
    }

    /**
     * Parse location string to coordinates
     * @param {string} location - Location string (e.g., "Nairobi, Kenya")
     * @returns {Object|null} Coordinates object or null
     */
    static parseLocation(location) {
        // Simple parsing - in production, use proper geocoding
        const city = location.split(',')[0].trim();
        return this.geocodeAddress(city);
    }

    /**
     * Get user's current location using browser geolocation
     * @returns {Promise<{lat: number, lng: number}>} User coordinates
     */
    static async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by this browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        });
    }

    /**
     * Sort technicians by distance from user
     * @param {Array} technicians - Array of technician objects
     * @param {number} userLat - User's latitude
     * @param {number} userLng - User's longitude
     * @returns {Array} Technicians sorted by distance
     */
    static sortByDistance(technicians, userLat, userLng) {
        return technicians.map(tech => {
            const techCoords = this.parseLocation(tech.location);
            const distance = techCoords ? 
                this.calculateDistance(userLat, userLng, techCoords.lat, techCoords.lng) : 
                Infinity;
            
            return { ...tech, distance };
        }).sort((a, b) => a.distance - b.distance);
    }
}

module.exports = LocationService;
