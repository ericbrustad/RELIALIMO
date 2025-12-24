export class DriverTracker {
  constructor() {
    this.drivers = [];
    this.trackingInterval = null;
    this.updateFrequency = 5000; // Update every 5 seconds
    this.baseLocation = [44.8848, -93.2223]; // Default to Minneapolis (near 55431)
  }

  setBaseLocation(location) {
    this.baseLocation = location;
  }

  initializeDrivers() {
    // Initialize sample drivers with starting positions around base location
    const [baseLat, baseLng] = this.baseLocation;
    
    this.drivers = [
      {
        id: 1,
        name: 'Mike Driver',
        status: 'available',
        vehicle: 'Sedan',
        affiliate: 'RELIA Fleet',
        phone: '(555) 200-1001',
        position: [baseLat, baseLng], // Center
        heading: 45, // Direction in degrees
        speed: 0.001, // Speed factor for movement
        assignedReservationId: null
      },
      {
        id: 2,
        name: 'Lisa Driver',
        status: 'available',
        vehicle: 'SUV Limousine',
        affiliate: 'RELIA Fleet',
        phone: '(555) 200-1002',
        position: [baseLat + 0.05, baseLng - 0.05], // NW
        heading: 135,
        speed: 0.0008,
        assignedReservationId: null
      },
      {
        id: 3,
        name: 'Tom Driver',
        status: 'available',
        vehicle: 'Stretch Limousine',
        affiliate: 'RELIA Fleet',
        phone: '(555) 200-1003',
        position: [baseLat + 0.03, baseLng + 0.03], // NE
        heading: 225,
        speed: 0.0012,
        assignedReservationId: null
      },
      {
        id: 4,
        name: 'Sarah Driver',
        status: 'available',
        vehicle: 'Luxury Sedan',
        affiliate: 'RELIA Fleet',
        phone: '(555) 200-1004',
        position: [baseLat - 0.04, baseLng - 0.04], // SW
        heading: 315,
        speed: 0.0009,
        assignedReservationId: null
      },
      {
        id: 5,
        name: 'John Driver',
        status: 'available',
        vehicle: 'SUV',
        affiliate: 'RELIA Fleet',
        phone: '(555) 200-1005',
        position: [baseLat - 0.02, baseLng + 0.04], // SE
        heading: 90,
        speed: 0.001,
        assignedReservationId: null
      }
    ];

    this.applyStatusOverrides();
  }

  startTracking(callback) {
    this.initializeDrivers();
    
    // Initial callback
    if (callback) {
      callback(this.drivers);
    }

    // Update driver positions periodically
    this.trackingInterval = setInterval(() => {
      this.applyStatusOverrides();
      this.updateDriverPositions();
      if (callback) {
        callback(this.drivers);
      }
    }, this.updateFrequency);
  }

  stopTracking() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
  }

  updateDriverPositions() {
    this.drivers.forEach(driver => {
      // Simulate realistic GPS movement
      if (driver.status === 'available' || driver.status === 'enroute') {
        // Calculate new position based on heading and speed
        const headingRad = (driver.heading * Math.PI) / 180;
        const latChange = Math.cos(headingRad) * driver.speed;
        const lngChange = Math.sin(headingRad) * driver.speed;

        driver.position = [
          driver.position[0] + latChange,
          driver.position[1] + lngChange
        ];

        // Randomly adjust heading slightly (simulate turns)
        if (Math.random() < 0.3) {
          driver.heading += (Math.random() - 0.5) * 30;
          // Keep heading between 0 and 360
          if (driver.heading < 0) driver.heading += 360;
          if (driver.heading >= 360) driver.heading -= 360;
        }

        // Keep drivers within LA area boundaries
        this.constrainToArea(driver);
      }
    });
  }

  constrainToArea(driver) {
    // Create boundaries around base location (approx 20 mile radius)
    const [baseLat, baseLng] = this.baseLocation;
    const bounds = {
      north: baseLat + 0.3,
      south: baseLat - 0.3,
      east: baseLng + 0.3,
      west: baseLng - 0.3
    };

    // Bounce off boundaries by reversing heading
    if (driver.position[0] > bounds.north || driver.position[0] < bounds.south) {
      driver.heading = (180 - driver.heading + 360) % 360;
      driver.position[0] = Math.max(bounds.south, Math.min(bounds.north, driver.position[0]));
    }
    if (driver.position[1] > bounds.east || driver.position[1] < bounds.west) {
      driver.heading = (360 - driver.heading) % 360;
      driver.position[1] = Math.max(bounds.west, Math.min(bounds.east, driver.position[1]));
    }
  }

  assignDriver(driverId, reservationId) {
    const driver = this.drivers.find(d => d.id === driverId);
    if (driver) {
      driver.assignedReservationId = reservationId;
      driver.status = 'enroute';
      this.persistStatusOverrides();
    }
  }

  updateDriverStatus(driverId, status) {
    const driver = this.drivers.find(d => d.id === driverId);
    if (driver) {
      driver.status = status;
      if (status === 'available') {
        driver.assignedReservationId = null;
      }
      this.persistStatusOverrides();
    }
  }

  applyStatusOverrides() {
    try {
      const raw = localStorage.getItem('relia_driver_status_overrides');
      if (!raw) return;
      const overrides = JSON.parse(raw);
      if (!Array.isArray(overrides)) return;
      overrides.forEach(override => {
        const driver = this.drivers.find(d => d.id === override.id);
        if (!driver) return;
        if (override.status) {
          driver.status = override.status;
        }
        if (override.notes) {
          driver.notes = override.notes;
        }
      });
    } catch (error) {
      console.warn('[DriverTracker] Unable to apply driver status overrides:', error);
    }
  }

  persistStatusOverrides() {
    try {
      const overrides = this.drivers.map(driver => ({
        id: driver.id,
        status: driver.status,
        notes: driver.notes || ''
      }));
      localStorage.setItem('relia_driver_status_overrides', JSON.stringify(overrides));
    } catch (error) {
      console.warn('[DriverTracker] Unable to persist driver status overrides:', error);
    }
  }

  getDriverById(driverId) {
    return this.drivers.find(d => d.id === driverId);
  }

  getAvailableDrivers() {
    return this.drivers.filter(d => d.status === 'available');
  }

  getAllDrivers() {
    return this.drivers;
  }

  // Navigate driver towards a destination
  navigateToDestination(driverId, destination) {
    const driver = this.drivers.find(d => d.id === driverId);
    if (driver) {
      // Calculate heading towards destination
      const latDiff = destination[0] - driver.position[0];
      const lngDiff = destination[1] - driver.position[1];
      driver.heading = (Math.atan2(lngDiff, latDiff) * 180) / Math.PI;
      
      // Increase speed when enroute
      driver.speed = 0.0015;
      driver.status = 'enroute';
    }
  }
}
