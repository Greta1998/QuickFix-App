/**
 * Search Service for QuickFix
 * Implements indexed search and ranking algorithms for technician recommendations
 */

const LocationService = require('./locationService');

class SearchService {
    constructor() {
        this.searchIndex = new Map();
        this.technicianRatings = new Map();
    }

    /**
     * Build search index for technicians
     * @param {Array} technicians - Array of technician objects
     */
    buildSearchIndex(technicians) {
        this.searchIndex.clear();
        this.technicianIndex = []; // Reset technician index
        
        technicians.forEach(tech => {
            const indexKey = this.createIndexKey(tech);
            
            if (!this.searchIndex.has(indexKey)) {
                this.searchIndex.set(indexKey, []);
            }
            
            this.searchIndex.get(indexKey).push(tech);
            
            // Add to technician index for fallback
            this.technicianIndex.push(tech);
            
            // Set mock rating for testing (remove this in production)
            if (!this.technicianRatings.has(tech.email)) {
                const mockRating = Math.random() * 2 + 3; // Random rating between 3-5
                this.technicianRatings.set(tech.email, mockRating);
            }
        });
        
        console.log('Search index built with', this.technicianIndex.length, 'technicians');
        console.log('Technician names:', this.technicianIndex.map(t => t.name));
    }

    /**
     * Create search index key from technician data
     * @param {Object} tech - Technician object
     * @returns {string} Index key
     */
    createIndexKey(tech) {
        const specialty = (tech.specialty || '').toLowerCase();
        const location = (tech.location || '').toLowerCase();
        const experience = this.categorizeExperience(tech.experience);
        
        return `${specialty}_${location}_${experience}`;
    }

    /**
     * Categorize experience level
     * @param {string} experience - Experience string
     * @returns {string} Experience category
     */
    categorizeExperience(experience) {
        const exp = (experience || '').toLowerCase();
        
        if (exp.includes('0-1') || exp.includes('beginner') || exp.includes('entry')) {
            return 'beginner';
        } else if (exp.includes('2-5') || exp.includes('intermediate')) {
            return 'intermediate';
        } else if (exp.includes('5+') || exp.includes('senior') || exp.includes('expert')) {
            return 'senior';
        }
        
        return 'intermediate'; // Default
    }

    /**
     * Search technicians with advanced filtering
     * @param {Object} searchParams - Search parameters
     * @returns {Array} Ranked technician results
     */
    async searchTechnicians(searchParams) {
        const {
            specialty,
            location,
            experience,
            userLat,
            userLng,
            maxDistance = 50,
            minRating = 0,
        } = searchParams;

        console.log('🔍 NEW SIMPLIFIED SEARCH RUNNING');
        console.log('Search parameters:', searchParams);
        console.log('Search index length:', this.technicianIndex.length);

        // SIMPLIFIED: Just return all technicians for now
        let results = [...this.technicianIndex];
        console.log('✅ Using all technicians:', results.length);
        console.log('Technician names:', results.map(t => t.name));
        
        // If still no results, return empty array
        if (results.length === 0) {
            console.log('No technicians found at all');
            return [];
        }
        
        // SIMPLIFIED: Skip all filtering for now
        console.log('Skipping all filters for now');

        // Rank and sort results
        console.log('Before ranking:', results.length, 'technicians');
        const rankedResults = await this.rankTechnicians(results, searchParams);
        console.log('After ranking:', rankedResults.length, 'technicians');
        return rankedResults;
    }

    /**
     * Get base results from search index
     * @param {string} specialty - Technician specialty
     * @param {string} location - Location
     * @param {string} experience - Experience level
     * @returns {Array} Base results
     */
    getBaseResults(specialty, location, experience) {
        const specialtyKey = specialty ? specialty.toLowerCase() : '';
        const locationKey = location ? location.toLowerCase() : '';
        const experienceKey = experience ? this.categorizeExperience(experience) : '';
        
        let results = [];
        
        // Search by specialty
        if (specialtyKey) {
            for (const [key, techs] of this.searchIndex) {
                if (key.includes(specialtyKey)) {
                    results = results.concat(techs);
                }
            }
        } else {
            // If no specialty specified, get all technicians
            for (const techs of this.searchIndex.values()) {
                results = results.concat(techs);
            }
        }

        // Filter by location if specified
        if (locationKey) {
            results = results.filter(tech => 
                tech.location && tech.location.toLowerCase().includes(locationKey)
            );
        }

        // Filter by experience if specified
        if (experienceKey) {
            results = results.filter(tech => 
                this.categorizeExperience(tech.experience) === experienceKey
            );
        }

        return results;
    }

    /**
     * Rank technicians using multiple factors
     * @param {Array} technicians - Array of technicians to rank
     * @param {Object} searchParams - Search parameters
     * @returns {Array} Ranked technicians
     */
    async rankTechnicians(technicians, searchParams) {
        console.log('⭐ NEW SIMPLIFIED RANKING RUNNING');
        console.log('Ranking', technicians.length, 'technicians');
        
        // SIMPLIFIED: Just add mock ratings and return
        const techniciansWithRatings = technicians.map(tech => {
            const rating = Math.round((Math.random() * 2 + 3) * 10) / 10; // Random rating 3-5, rounded to nearest tenth
            const distance = Math.random() * 50; // Random distance 0-50km
            console.log(`Technician ${tech.name}: rating=${rating}, distance=${distance.toFixed(1)}km`);
            return { ...tech, rating, distance };
        });
        
        // Sort by distance (nearest first), then by rating (highest first)
        const sorted = techniciansWithRatings.sort((a, b) => {
            if (a.distance !== b.distance) {
                return a.distance - b.distance; // Nearest distance first
            }
            return b.rating - a.rating; // Higher rating first if distances are equal
        });
        
        console.log('✅ Final ranked results (sorted by distance):', sorted.length);
        return sorted;
    }

    /**
     * Calculate technician ranking score
     * @param {Object} tech - Technician object
     * @param {Object} searchParams - Search parameters
     * @returns {number} Ranking score (0-100)
     */
    calculateTechnicianScore(tech, searchParams) {
        let score = 0;
        const { userLat, userLng, specialty } = searchParams;

        // Rating score (40% weight)
        const rating = this.getTechnicianRating(tech.email);
        score += rating * 0.4;

        // Distance score (30% weight)
        if (userLat && userLng) {
            const distance = this.calculateDistance(tech, userLat, userLng);
            const distanceScore = Math.max(0, 100 - (distance * 2)); // Decrease score with distance
            score += distanceScore * 0.3;
        }


        // Specialty match score (10% weight)
        const specialtyScore = this.calculateSpecialtyMatch(tech, specialty);
        score += specialtyScore * 0.1;

        return Math.round(score);
    }

    /**
     * Calculate distance between technician and user
     * @param {Object} tech - Technician object
     * @param {number} userLat - User latitude
     * @param {number} userLng - User longitude
     * @returns {number} Distance in kilometers
     */
    calculateDistance(tech, userLat, userLng) {
        if (!userLat || !userLng) return 0; // No user location, don't filter by distance
        
        // If technician has lat/lng coordinates, use them
        if (tech.lat && tech.lng) {
            return LocationService.calculateDistance(userLat, userLng, tech.lat, tech.lng);
        }
        
        // If technician has location string, try to parse it
        if (tech.location) {
            const techCoords = LocationService.parseLocation(tech.location);
            if (techCoords) {
                return LocationService.calculateDistance(userLat, userLng, techCoords.lat, techCoords.lng);
            }
        }
        
        // Fallback: return 0 (no distance filtering)
        return 0;
    }

    /**
     * Calculate specialty match score
     * @param {Object} tech - Technician object
     * @param {string} requestedSpecialty - Requested specialty
     * @returns {number} Match score (0-100)
     */
    calculateSpecialtyMatch(tech, requestedSpecialty) {
        if (!requestedSpecialty || !tech.specialty) return 50; // Neutral score
        
        const techSpecialty = tech.specialty.toLowerCase();
        const reqSpecialty = requestedSpecialty.toLowerCase();
        
        if (techSpecialty === reqSpecialty) return 100;
        if (techSpecialty.includes(reqSpecialty) || reqSpecialty.includes(techSpecialty)) return 80;
        
        return 30; // Partial match
    }

    /**
     * Get technician rating
     * @param {string} technicianEmail - Technician email
     * @returns {number} Rating (0-5)
     */
    getTechnicianRating(technicianEmail) {
        return this.technicianRatings.get(technicianEmail) || 0;
    }

    /**
     * Get technician average rating from database
     * @param {string} technicianEmail - Technician email
     * @returns {Promise<number>} Average rating (0-5)
     */
    async getTechnicianAverageRating(technicianEmail) {
        try {
            const db = require('./firebase');
            const ratingsSnapshot = await db.ref('ratings')
                .orderByChild('technicianEmail')
                .equalTo(technicianEmail)
                .once('value');
            
            if (!ratingsSnapshot.exists()) {
                return 0; // No ratings yet
            }
            
            const ratings = ratingsSnapshot.val();
            const ratingValues = Object.values(ratings).map(r => r.rating);
            
            if (ratingValues.length === 0) {
                return 0;
            }
            
            const average = ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length;
            return Math.round(average * 10) / 10; // Round to 1 decimal place
        } catch (error) {
            console.error('Error getting technician rating:', error);
            return 0;
        }
    }

    /**
     * Set technician rating
     * @param {string} technicianEmail - Technician email
     * @param {number} rating - Rating (0-5)
     */
    setTechnicianRating(technicianEmail, rating) {
        this.technicianRatings.set(technicianEmail, rating);
    }


    /**
     * Update search index with new technician data
     * @param {Object} technician - Technician object
     */
    updateTechnicianIndex(technician) {
        const indexKey = this.createIndexKey(technician);
        
        if (!this.searchIndex.has(indexKey)) {
            this.searchIndex.set(indexKey, []);
        }
        
        const techs = this.searchIndex.get(indexKey);
        const existingIndex = techs.findIndex(t => t.email === technician.email);
        
        if (existingIndex >= 0) {
            techs[existingIndex] = technician;
        } else {
            techs.push(technician);
        }
    }

    /**
     * Get search suggestions based on partial input
     * @param {string} query - Partial search query
     * @returns {Array} Search suggestions
     */
    getSearchSuggestions(query) {
        const suggestions = new Set();
        const queryLower = query.toLowerCase();
        
        for (const [key, techs] of this.searchIndex) {
            if (key.includes(queryLower)) {
                techs.forEach(tech => {
                    if (tech.specialty) suggestions.add(tech.specialty);
                    if (tech.location) suggestions.add(tech.location);
                });
            }
        }
        
        return Array.from(suggestions).slice(0, 10);
    }

    /**
     * Get advanced search filters
     * @returns {Object} Available search filters
     */
    getSearchFilters() {
        return {
            specialties: this.getUniqueSpecialties(),
            locations: this.getUniqueLocations(),
            experienceLevels: ['beginner', 'intermediate', 'senior'],
            ratingRanges: [
                { min: 0, max: 2, label: '0-2 stars' },
                { min: 2, max: 3, label: '2-3 stars' },
                { min: 3, max: 4, label: '3-4 stars' },
                { min: 4, max: 5, label: '4-5 stars' }
            ],
            distanceRanges: [
                { max: 10, label: 'Within 10km' },
                { max: 25, label: 'Within 25km' },
                { max: 50, label: 'Within 50km' },
                { max: 100, label: 'Within 100km' }
            ]
        };
    }

    /**
     * Get unique specialties from index
     * @returns {Array} Unique specialties
     */
    getUniqueSpecialties() {
        const specialties = new Set();
        
        for (const [key, techs] of this.searchIndex) {
            techs.forEach(tech => {
                if (tech.specialty) {
                    specialties.add(tech.specialty);
                }
            });
        }
        
        return Array.from(specialties);
    }

    /**
     * Get unique locations from index
     * @returns {Array} Unique locations
     */
    getUniqueLocations() {
        const locations = new Set();
        
        for (const [key, techs] of this.searchIndex) {
            techs.forEach(tech => {
                if (tech.location) {
                    locations.add(tech.location);
                }
            });
        }
        
        return Array.from(locations);
    }
}

module.exports = SearchService;
