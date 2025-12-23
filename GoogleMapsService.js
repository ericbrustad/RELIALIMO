/**
 * Google Maps Service for Address and Business Search
 * Uses Google Places API for autocomplete and detailed place searches
 */

export class GoogleMapsService {
  constructor(apiKey = null) {
    // Get API key from environment
    this.apiKey = apiKey || this.getGoogleApiKey();
    this.sessionToken = null;
    this.placesService = null;
    this.autocompleteService = null;
    this.geocodingCache = new Map();
    this.placeCache = new Map();
    
    if (!this.apiKey) {
      console.warn('⚠️ Google Maps API key not configured. Add it to env.js as GOOGLE_MAPS_API_KEY');
    }
    
    this.initializeServices();
  }

  getGoogleApiKey() {
    // Check multiple possible sources for API key
    if (typeof window !== 'undefined' && window.ENV?.GOOGLE_MAPS_API_KEY) {
      return window.ENV.GOOGLE_MAPS_API_KEY;
    }
    return null;
  }

  async initializeServices() {
    // Generate a new session token for each user session
    // This groups autocomplete and selection requests for billing purposes
    this.sessionToken = this.generateSessionToken();
  }

  generateSessionToken() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Search for addresses with Google Places Autocomplete
   * @param {string} input - User input for address search
   * @param {object} options - Search options (location bias, types, etc.)
   * @returns {Promise<Array>} Array of address suggestions
   */
  async searchAddresses(input, options = {}) {
    if (!input || input.trim().length < 2) return [];
    
    // Check cache first
    const cacheKey = `address_${input}_${JSON.stringify(options)}`;
    if (this.geocodingCache.has(cacheKey)) {
      return this.geocodingCache.get(cacheKey);
    }

    try {
      const params = new URLSearchParams({
        input: input,
        key: this.apiKey,
        sessionToken: this.sessionToken,
        components: options.country ? `country:${options.country}` : '',
        types: 'geocode,establishment',
      });

      // Add location bias if provided (restricts results to area)
      if (options.locationBias) {
        params.append('locationbias', `point:${options.locationBias.latitude},${options.locationBias.longitude}`);
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
      );

      if (!response.ok) {
        throw new Error(`Google Places request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API error: ${data.status} - ${data.error_message || ''}`);
      }

      const results = (data.predictions || []).map(prediction => ({
        placeId: prediction.place_id,
        description: prediction.description,
        mainText: prediction.main_text,
        secondaryText: prediction.secondary_text,
        types: prediction.types,
        matchedSubstrings: prediction.matched_substrings,
      }));

      // Cache the results
      this.geocodingCache.set(cacheKey, results);

      return results;
    } catch (error) {
      console.error('Address search error:', error);
      return [];
    }
  }

  /**
   * Search for businesses (restaurants, hotels, etc.)
   * @param {string} query - Business search query
   * @param {object} options - Search options (location, type, etc.)
   * @returns {Promise<Array>} Array of business results
   */
  async searchBusinesses(query, options = {}) {
    if (!query || query.trim().length < 2) return [];

    const cacheKey = `business_${query}_${JSON.stringify(options)}`;
    if (this.placeCache.has(cacheKey)) {
      return this.placeCache.get(cacheKey);
    }

    try {
      // Use Nearby Search (requires location) or Text Search (works anywhere)
      const useNearbySearch = options.location && options.radius;

      let url, params;

      if (useNearbySearch) {
        params = new URLSearchParams({
          location: `${options.location.latitude},${options.location.longitude}`,
          radius: options.radius || 5000, // Default 5km
          keyword: query,
          key: this.apiKey,
        });
        if (options.type) params.append('type', options.type);
        url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`;
      } else {
        params = new URLSearchParams({
          query: query,
          key: this.apiKey,
        });
        if (options.type) params.append('type', options.type);
        url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Google Places request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API error: ${data.status}`);
      }

      const results = (data.results || []).map(place => ({
        placeId: place.place_id,
        name: place.name,
        address: place.formatted_address,
        types: place.types,
        location: place.geometry.location,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        openNow: place.opening_hours?.open_now,
        photoReference: place.photos?.[0]?.photo_reference,
        businessStatus: place.business_status,
      }));

      // Cache the results
      this.placeCache.set(cacheKey, results);

      return results;
    } catch (error) {
      console.error('Business search error:', error);
      return [];
    }
  }

  /**
   * Get detailed information about a place
   * @param {string} placeId - Google Place ID
   * @returns {Promise<Object>} Detailed place information
   */
  async getPlaceDetails(placeId) {
    if (!placeId) return null;

    if (this.placeCache.has(placeId)) {
      return this.placeCache.get(placeId);
    }

    try {
      const params = new URLSearchParams({
        place_id: placeId,
        fields: 'address_components,formatted_address,geometry,name,phone_number,website,url,business_status,opening_hours,photos',
        key: this.apiKey,
        sessionToken: this.sessionToken,
      });

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${params}`
      );

      if (!response.ok) {
        throw new Error(`Google Places details request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Google Places API error: ${data.status}`);
      }

      const result = data.result;
      const details = {
        placeId: result.place_id,
        name: result.name,
        address: result.formatted_address,
        coordinates: result.geometry.location,
        phone: result.phone_number,
        website: result.website,
        googleMapsUrl: result.url,
        addressComponents: this.parseAddressComponents(result.address_components),
        businessStatus: result.business_status,
        openingHours: result.opening_hours,
      };

      // Cache the result
      this.placeCache.set(placeId, details);

      return details;
    } catch (error) {
      console.error('Place details error:', error);
      return null;
    }
  }

  /**
   * Parse address components into structured format
   * @param {Array} components - Google address components
   * @returns {Object} Parsed address parts
   */
  parseAddressComponents(components) {
    const address = {
      streetNumber: '',
      streetName: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    };

    if (!components) return address;

    components.forEach(component => {
      if (component.types.includes('street_number')) {
        address.streetNumber = component.short_name;
      } else if (component.types.includes('route')) {
        address.streetName = component.long_name;
      } else if (component.types.includes('locality')) {
        address.city = component.long_name;
      } else if (component.types.includes('administrative_area_level_1')) {
        address.state = component.short_name;
      } else if (component.types.includes('postal_code')) {
        address.postalCode = component.short_name;
      } else if (component.types.includes('country')) {
        address.country = component.long_name;
      }
    });

    return address;
  }

  /**
   * Geocode address string to coordinates
   * @param {string} address - Address to geocode
   * @returns {Promise<Object>} Coordinates and details
   */
  async geocodeAddress(address) {
    if (!address) return null;

    const cacheKey = `geocode_${address}`;
    if (this.geocodingCache.has(cacheKey)) {
      return this.geocodingCache.get(cacheKey);
    }

    try {
      const params = new URLSearchParams({
        address: address,
        key: this.apiKey,
      });

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${params}`
      );

      if (!response.ok) {
        throw new Error(`Geocoding request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Geocoding error: ${data.status}`);
      }

      if (data.results.length === 0) {
        return null;
      }

      const result = data.results[0];
      const coordinates = result.geometry.location;
      const addressComponents = this.parseAddressComponents(result.address_components);

      const geocodeResult = {
        address: result.formatted_address,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        placeId: result.place_id,
        addressComponents: addressComponents,
        types: result.types,
      };

      this.geocodingCache.set(cacheKey, geocodeResult);

      return geocodeResult;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to address
   * @param {number} latitude
   * @param {number} longitude
   * @returns {Promise<string>} Formatted address
   */
  async reverseGeocode(latitude, longitude) {
    if (!latitude || !longitude) return null;

    const cacheKey = `reverse_${latitude}_${longitude}`;
    if (this.geocodingCache.has(cacheKey)) {
      return this.geocodingCache.get(cacheKey);
    }

    try {
      const params = new URLSearchParams({
        latlng: `${latitude},${longitude}`,
        key: this.apiKey,
      });

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${params}`
      );

      if (!response.ok) {
        throw new Error(`Reverse geocoding request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK' || data.results.length === 0) {
        return null;
      }

      const address = data.results[0].formatted_address;
      this.geocodingCache.set(cacheKey, address);

      return address;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }

  /**
   * Clear cache to save memory
   */
  clearCache() {
    this.geocodingCache.clear();
    this.placeCache.clear();
  }

  /**
   * Get static map image URL for embedding
   * @param {number} latitude
   * @param {number} longitude
   * @param {number} zoom - Zoom level (1-21, default 15)
   * @param {number} width - Image width in pixels
   * @param {number} height - Image height in pixels
   * @returns {string} Google Static Maps URL
   */
  getStaticMapUrl(latitude, longitude, zoom = 15, width = 400, height = 300) {
    if (!this.apiKey) return null;
    
    return `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=${zoom}&size=${width}x${height}&markers=color:red%7C${latitude},${longitude}&key=${this.apiKey}`;
  }
}

// Export singleton instance
export const googleMapsService = new GoogleMapsService();
