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
    this.geocoder = null;
    this.directionsService = null;
    this.geocodingCache = new Map();
    this.placeCache = new Map();
    this.mapsScriptPromise = null;
    this.placesReadyPromise = null;
    
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
    
    const includePlaces = options.includeBusinessesAndLandmarks !== false;
    const normalizedOptions = { ...options };
    if (options.locationBias && typeof options.locationBias === 'object') {
      normalizedOptions.locationBias = {
        latitude: options.locationBias.latitude,
        longitude: options.locationBias.longitude
      };
    }
    const cacheKey = `address_${input}_${JSON.stringify(normalizedOptions)}`;
    if (this.geocodingCache.has(cacheKey)) {
      return this.geocodingCache.get(cacheKey);
    }

    if (!this.apiKey) {
      console.warn('[GoogleMapsService] No API key set; address search skipped');
      return [];
    }

    await this.ensurePlacesReady();
    if (!this.autocompleteService) {
      console.warn('[GoogleMapsService] Autocomplete service not ready');
      return [];
    }

    const results = [];

    try {
      const request = {
        input,
        sessionToken: this.sessionToken,
      };

      if (options.country) {
        request.componentRestrictions = { country: options.country };
      }

       // Allow businesses/landmarks when requested; otherwise bias toward addresses
      if (options.includeBusinessesAndLandmarks === false) {
        request.types = ['address'];
      }

      if (options.locationBias?.latitude && options.locationBias?.longitude && window.google?.maps) {
        request.locationBias = new google.maps.LatLng(options.locationBias.latitude, options.locationBias.longitude);
      }

      const predictions = await new Promise((resolve) => {
        this.autocompleteService.getPlacePredictions(request, (preds, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK && status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            console.warn('[GoogleMapsService] Autocomplete status:', status);
          }
          resolve(preds || []);
        });
      });

      results.push(
        ...(predictions || []).map(prediction => ({
          placeId: prediction.place_id,
          description: prediction.description,
          mainText: prediction.structured_formatting?.main_text || prediction.description,
          secondaryText: prediction.structured_formatting?.secondary_text || '',
          types: prediction.types,
          matchedSubstrings: prediction.matched_substrings,
          source: 'autocomplete'
        }))
      );
    } catch (error) {
      console.error('Address search error (autocomplete):', error);
    }

    // Fallback: use Find Place (text) which works well for businesses/landmarks and fuzzy address text
    if (includePlaces && results.length === 0) {
      try {
        const placeResults = await this.findPlaceByText(input, {
          locationBias: options.locationBias,
          types: options.types || ['point_of_interest', 'establishment', 'premise']
        });
        results.push(...placeResults.map(place => this.mapPlaceToSuggestion(place, 'findplace')));
      } catch (error) {
        console.error('Address search fallback error (find place):', error);
      }
    }

    this.geocodingCache.set(cacheKey, results);
    return results;
  }

  async findPlaceByText(query, options = {}) {
    await this.ensurePlacesReady();
    if (!this.placesService) return [];

    const request = {
      query,
      fields: ['formatted_address', 'name', 'geometry', 'place_id', 'types']
    };

    if (options.locationBias?.latitude && options.locationBias?.longitude && window.google?.maps) {
      request.locationBias = new google.maps.LatLng(options.locationBias.latitude, options.locationBias.longitude);
    }

    return await new Promise((resolve, reject) => {
      this.placesService.findPlaceFromQuery(request, (places, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK && status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          console.warn('[GoogleMapsService] findPlaceFromQuery status:', status);
          if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            reject(new Error(`Places status: ${status}`));
            return;
          }
        }
        resolve(places || []);
      });
    });
  }

  mapPlaceToSuggestion(place, source = 'text') {
    return {
      placeId: place.place_id,
      description: place.formatted_address || place.name,
      mainText: place.name || place.formatted_address,
      secondaryText: place.formatted_address || place.vicinity || '',
      types: place.types,
      location: place.geometry?.location,
      source,
    };
  }

  /**
   * Search for businesses (restaurants, hotels, etc.)
   * @param {string} query - Business search query
   * @param {object} options - Search options (location, type, etc.)
   * @returns {Promise<Array>} Array of business results
   */
  async searchBusinesses(query, options = {}) {
    if (!query || query.trim().length < 2) return [];

    const normalizedOptions = { ...options };
    if (options.location) {
      normalizedOptions.location = { latitude: options.location.latitude, longitude: options.location.longitude };
    }
    const cacheKey = `business_${query}_${JSON.stringify(normalizedOptions)}`;
    if (this.placeCache.has(cacheKey)) {
      return this.placeCache.get(cacheKey);
    }

    try {
      await this.ensurePlacesReady();
      if (!this.placesService) return [];

      const useNearbySearch = options.location && options.radius;

      const results = await new Promise((resolve, reject) => {
        if (useNearbySearch && window.google?.maps) {
          const request = {
            location: new google.maps.LatLng(options.location.latitude, options.location.longitude),
            radius: options.radius || 5000,
            keyword: query,
          };
          if (options.type) request.type = options.type;
          this.placesService.nearbySearch(request, (places, status) => {
            if (status !== google.maps.places.PlacesServiceStatus.OK && status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
              console.warn('[GoogleMapsService] nearbySearch status:', status);
              if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                reject(new Error(`Places status: ${status}`));
                return;
              }
            }
            resolve(places || []);
          });
        } else {
          const request = { query };
          if (options.type) request.type = options.type;
          this.placesService.textSearch(request, (places, status) => {
            if (status !== google.maps.places.PlacesServiceStatus.OK && status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
              console.warn('[GoogleMapsService] textSearch status:', status);
              if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                reject(new Error(`Places status: ${status}`));
                return;
              }
            }
            resolve(places || []);
          });
        }
      });

      const mapped = (results || []).map(place => ({
        placeId: place.place_id,
        name: place.name,
        address: place.formatted_address || place.vicinity,
        types: place.types,
        location: place.geometry?.location,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        openNow: place.opening_hours?.isOpen?.(),
        photoReference: place.photos?.[0]?.photo_reference,
        businessStatus: place.business_status,
      }));

      this.placeCache.set(cacheKey, mapped);
      return mapped;
    } catch (error) {
      console.error('Business search error:', error);
      return [];
    }
  }

  /**
   * Search for landmarks (points of interest, attractions)
   */
  async searchLandmarks(query, options = {}) {
    if (!query || query.trim().length < 2) return [];

    const normalizedOptions = { ...options };
    if (options.location) {
      normalizedOptions.location = { latitude: options.location.latitude, longitude: options.location.longitude };
    }
    const cacheKey = `landmark_${query}_${JSON.stringify(normalizedOptions)}`;
    if (this.placeCache.has(cacheKey)) {
      return this.placeCache.get(cacheKey);
    }

    try {
      await this.ensurePlacesReady();
      if (!this.placesService) return [];

      const request = { query, type: 'point_of_interest' };
      if (options.location && window.google?.maps) {
        request.location = new google.maps.LatLng(options.location.latitude, options.location.longitude);
      }
      if (options.radius) {
        request.radius = options.radius;
      }

      const places = await new Promise((resolve, reject) => {
        this.placesService.textSearch(request, (res, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK && status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            console.warn('[GoogleMapsService] Landmark textSearch status:', status);
            if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
              reject(new Error(`Places status: ${status}`));
              return;
            }
          }
          resolve(res || []);
        });
      });

      const results = (places || []).map(place => this.mapPlaceToSuggestion(place, 'landmark'));
      this.placeCache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Landmark search error:', error);
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
      await this.ensurePlacesReady();
      if (!this.placesService) return null;

      const details = await new Promise((resolve, reject) => {
        this.placesService.getDetails({
          placeId,
          fields: ['address_components', 'formatted_address', 'geometry', 'name', 'formatted_phone_number', 'website', 'url', 'business_status', 'opening_hours', 'photos']
        }, (result, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK) {
            reject(new Error(`Places status: ${status}`));
            return;
          }
          resolve(result);
        });
      });

      const parsed = {
        placeId: details.place_id,
        name: details.name,
        address: details.formatted_address,
        coordinates: details.geometry?.location,
        phone: details.formatted_phone_number,
        website: details.website,
        googleMapsUrl: details.url,
        addressComponents: this.parseAddressComponents(details.address_components),
        businessStatus: details.business_status,
        openingHours: details.opening_hours,
      };

      this.placeCache.set(placeId, parsed);
      return parsed;
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
      stateName: '',
      postalCode: '',
      country: '',
      countryCode: ''
    };

    if (!components) return address;

    const cityTypes = ['locality', 'postal_town', 'administrative_area_level_3', 'sublocality', 'sublocality_level_1'];

    components.forEach(component => {
      if (component.types.includes('street_number')) {
        address.streetNumber = component.short_name;
      } else if (component.types.includes('route')) {
        address.streetName = component.long_name;
      } else if (cityTypes.some(type => component.types.includes(type))) {
        // Prefer locality, but allow fallbacks for outskirts/PO boxes
        if (!address.city) address.city = component.long_name;
      } else if (component.types.includes('administrative_area_level_1')) {
        address.state = component.short_name; // USPS/ISO code
        address.stateName = component.long_name;
      } else if (component.types.includes('postal_code')) {
        address.postalCode = component.short_name;
      } else if (component.types.includes('country')) {
        address.country = component.long_name;
        address.countryCode = component.short_name;
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

    if (!this.apiKey) {
      console.warn('[GoogleMapsService] No API key set; geocode skipped');
      return null;
    }

    const cacheKey = `geocode_${address}`;
    if (this.geocodingCache.has(cacheKey)) {
      return this.geocodingCache.get(cacheKey);
    }

    try {
      await this.ensurePlacesReady();
      if (!this.geocoder) {
        console.warn('[GoogleMapsService] Geocoder not ready');
        return null;
      }

      const result = await new Promise((resolve, reject) => {
        this.geocoder.geocode({ address }, (res, status) => {
          if (status !== google.maps.GeocoderStatus.OK) {
            reject(new Error(`Geocoding error: ${status}`));
            return;
          }
          resolve(res || []);
        });
      });

      if (!result.length) return null;
      const hit = result[0];
      const coords = hit.geometry.location;
      const addressComponents = this.parseAddressComponents(hit.address_components);

      const geocodeResult = {
        address: hit.formatted_address,
        latitude: coords.lat(),
        longitude: coords.lng(),
        placeId: hit.place_id,
        addressComponents,
        types: hit.types,
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
      await this.ensurePlacesReady();
      if (!this.geocoder) return null;

      const address = await new Promise((resolve, reject) => {
        this.geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (res, status) => {
          if (status !== google.maps.GeocoderStatus.OK) {
            reject(new Error(`Reverse geocoding error: ${status}`));
            return;
          }
          resolve((res?.[0]?.formatted_address) || null);
        });
      });

      if (address) {
        this.geocodingCache.set(cacheKey, address);
      }

      return address;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }

  async ensurePlacesReady() {
    if (!this.apiKey) {
      console.warn('[GoogleMapsService] No API key set; cannot load Places');
      return null;
    }

    if (this.placesService && this.autocompleteService && this.geocoder) {
      return true;
    }

    if (!this.mapsScriptPromise) {
      this.mapsScriptPromise = new Promise((resolve, reject) => {
        if (window.google?.maps?.places && window.google.maps.Geocoder) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (err) => reject(err);
        document.head.appendChild(script);
      });
    }

    if (!this.placesReadyPromise) {
      this.placesReadyPromise = this.mapsScriptPromise.then(() => {
        if (!window.google?.maps?.places) {
          throw new Error('Google Maps Places library not available after load');
        }
        this.autocompleteService = new google.maps.places.AutocompleteService();
        this.placesService = new google.maps.places.PlacesService(document.createElement('div'));
        this.geocoder = new google.maps.Geocoder();
        this.sessionToken = new google.maps.places.AutocompleteSessionToken();
        this.directionsService = new google.maps.DirectionsService();
      });
    }

    return this.placesReadyPromise;
  }

  /**
   * Clear cache to save memory
   */
  clearCache() {
    this.geocodingCache.clear();
    this.placeCache.clear();
  }

  /**
   * Get driving distance/duration between an origin/destination with optional waypoints
   * @param {object} params
   * @param {string|object} params.origin
   * @param {string|object} params.destination
   * @param {Array<string|object>} [params.waypoints]
   * @returns {Promise<{distanceMeters:number,durationSeconds:number,distanceText:string,durationText:string}>}
   */
  async getRouteSummary({ origin, destination, waypoints = [] }) {
    await this.ensurePlacesReady();
    if (!this.directionsService) {
      throw new Error('Directions service not ready');
    }

    const request = {
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: true
    };

    if (waypoints && waypoints.length) {
      request.waypoints = waypoints.map(wp => ({ location: wp, stopover: true }));
    }

    const result = await new Promise((resolve, reject) => {
      this.directionsService.route(request, (response, status) => {
        if (status !== google.maps.DirectionsStatus.OK) {
          reject(new Error(`Directions failed: ${status}`));
          return;
        }
        resolve(response);
      });
    });

    const leg = result?.routes?.[0]?.legs?.reduce((acc, leg) => {
      acc.distanceMeters += leg.distance?.value || 0;
      acc.durationSeconds += leg.duration?.value || 0;
      return acc;
    }, { distanceMeters: 0, durationSeconds: 0 });

    const distanceMeters = leg?.distanceMeters || 0;
    const durationSeconds = leg?.durationSeconds || 0;

    return {
      distanceMeters,
      durationSeconds,
      distanceText: distanceMeters ? `${(distanceMeters / 1609.344).toFixed(1)} mi` : '-',
      durationText: durationSeconds ? this.formatDuration(durationSeconds) : '-'
    };
  }

  formatDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.round((totalSeconds % 3600) / 60);
    if (hours === 0) return `${minutes} min`;
    if (minutes === 0) return `${hours} hr`;
    return `${hours} hr ${minutes} min`;
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
