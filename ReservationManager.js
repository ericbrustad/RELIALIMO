const FARMOUT_STATUS_ALIASES = {
  '': '',
  farm_out_unassigned: 'unassigned',
  farmout_unassigned: 'unassigned',
  created_farm_out_unassigned: 'unassigned',
  created_farmout_unassigned: 'unassigned',
  farm_out_assigned: 'assigned',
  farmout_assigned: 'assigned',
  created_farm_out_assigned: 'assigned',
  created_farmout_assigned: 'assigned',
  farm_out_offered: 'offered',
  farmout_offered: 'offered',
  farm_out_declined: 'declined',
  farmout_declined: 'declined',
  farm_out_completed: 'completed',
  farmout_completed: 'completed',
  done: 'completed',
  en_route: 'enroute',
  enroute: 'enroute',
  passenger_on_board: 'passenger_onboard',
  passenger_on_boarded: 'passenger_onboard',
  passenger_on_boarding: 'passenger_onboard',
  inhouse: 'in_house',
  'in-house': 'in_house',
  in_house_dispatch: 'in_house'
};

const FARMOUT_STATUS_LABELS = {
  unassigned: 'Farm-out Unassigned',
  farm_out_unassigned: 'Farm-out Unassigned',
  farmout_unassigned: 'Farm-out Unassigned',
  offered: 'Farm-out Offered',
  assigned: 'Farm-out Assigned',
  farm_out_assigned: 'Farm-out Assigned',
  farmout_assigned: 'Farm-out Assigned',
  declined: 'Farm-out Declined',
  enroute: 'Farm-out En Route',
  en_route: 'Farm-out En Route',
  arrived: 'Farm-out Arrived',
  passenger_onboard: 'Passenger On Board',
  passenger_on_board: 'Passenger On Board',
  completed: 'Farm-out Completed',
  in_house: 'In-house Dispatch',
  inhouse: 'In-house Dispatch',
  offered_to_affiliate: 'Offered to Affiliate',
  affiliate_assigned: 'Affiliate Assigned',
  affiliate_driver_assigned: 'Affiliate Driver Assigned',
  driver_en_route: 'Driver En Route',
  on_the_way: 'Driver On The Way',
  driver_waiting_at_pickup: 'Driver Waiting at Pickup',
  waiting_at_pickup: 'Waiting at Pickup',
  driver_circling: 'Driver Circling',
  customer_in_car: 'Customer In Car',
  driving_passenger: 'Driving Passenger',
  cancelled: 'Farm-out Cancelled',
  cancelled_by_affiliate: 'Cancelled by Affiliate',
  late_cancel: 'Late Cancel',
  late_cancelled: 'Late Cancelled',
  no_show: 'No Show',
  covid19_cancellation: 'COVID-19 Cancellation',
  done: 'Trip Done'
};

function normalizeFarmoutKey(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function canonicalizeFarmoutStatus(status) {
  if (!status) {
    return '';
  }
  const normalized = normalizeFarmoutKey(status);
  const alias = FARMOUT_STATUS_ALIASES[normalized];
  return alias || normalized;
}

function canonicalizeFarmoutMode(mode) {
  if (!mode) {
    return 'manual';
  }
  const normalized = normalizeFarmoutKey(mode);
  if (normalized === 'auto' || normalized === 'auto_dispatch' || normalized === 'automatic_dispatch') {
    return 'automatic';
  }
  if (normalized === 'automatic' || normalized === 'manual') {
    return normalized;
  }
  return normalized || 'manual';
}

function formatFarmoutStatus(status) {
  const canonical = canonicalizeFarmoutStatus(status);
  if (!canonical) {
    return FARMOUT_STATUS_LABELS.unassigned;
  }

  if (Object.prototype.hasOwnProperty.call(FARMOUT_STATUS_LABELS, canonical)) {
    return FARMOUT_STATUS_LABELS[canonical];
  }

  return canonical
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function applyFarmoutMetadata(reservation, status, mode) {
  if (!reservation) {
    return;
  }

  if (status !== undefined && status !== null) {
    const canonicalStatus = canonicalizeFarmoutStatus(status) || 'unassigned';
    const statusLabel = formatFarmoutStatus(canonicalStatus);

    reservation.farmoutStatus = canonicalStatus;
    reservation.farmout_status = canonicalStatus;
    reservation.efarmStatus = statusLabel;
    reservation.efarm_status = statusLabel;

    if (reservation.form_snapshot && typeof reservation.form_snapshot === 'object') {
      const details = reservation.form_snapshot.details = reservation.form_snapshot.details || {};
      details.efarmStatus = statusLabel;
      details.eFarmStatus = statusLabel;
      details.farmoutStatusCanonical = canonicalStatus;
    }
  }

  if (mode !== undefined && mode !== null) {
    const canonicalMode = canonicalizeFarmoutMode(mode || 'manual');

    reservation.farmoutMode = canonicalMode;
    reservation.farmout_mode = canonicalMode;
    reservation.efarm_out_selection = canonicalMode;
    reservation.eFarmOut = canonicalMode;

    if (reservation.form_snapshot && typeof reservation.form_snapshot === 'object') {
      const details = reservation.form_snapshot.details = reservation.form_snapshot.details || {};
      details.farmoutMode = canonicalMode;
      details.eFarmOut = canonicalMode;
    }
  }
}

export class ReservationManager {
  constructor() {
    this.reservations = [];
    this.nextId = 1;
    this.loadSettingsFromManager();
  }
  /**
   * Load reservation settings from settings manager or fall back to defaults.
   */
  loadSettingsFromManager() {
    // Defaults ensure sane behavior even if settings are unavailable.
    this.requirePaymentUpfront = false;
    this.requireAdvanceHours = 0;
    this.cancellationPolicyHours = 2;
    this.noShowFeePercent = 50;
    this.maxPassengers = 6;

    try {
      if (window.RESERVATION_CONFIG) {
        const config = window.RESERVATION_CONFIG;
        this.requirePaymentUpfront = Boolean(config.requirePaymentUpfront);
        this.requireAdvanceHours = Number(config.requireAdvanceHours) || 0;
        this.cancellationPolicyHours = Number(config.cancellationPolicyHours) || 2;
        this.noShowFeePercent = Number(config.noShowFeePercent) || 50;
        this.maxPassengers = Number(config.maxPassengers) || 6;
        return;
      }

      if (window.CompanySettingsManager) {
        const settingsManager = new window.CompanySettingsManager();
        this.requirePaymentUpfront = Boolean(settingsManager.getSetting('requirePaymentUpfront'));
        this.requireAdvanceHours = Number(settingsManager.getSetting('requireAdvanceHours')) || 0;
        this.cancellationPolicyHours = Number(settingsManager.getSetting('cancellationPolicyHours')) || 2;
        this.noShowFeePercent = Number(settingsManager.getSetting('noShowFeePercent')) || 50;
        this.maxPassengers = Number(settingsManager.getSetting('maxPassengers')) || 6;
      }
    } catch (error) {
      console.warn('[ReservationManager] Could not load settings from manager:', error);
    }
  }

  addReservation(reservationData) {
    const reservation = {
      id: this.nextId++,
      createdAt: new Date().toISOString(),
      status: reservationData.status || 'pending',
      farmoutStatus: 'unassigned',
      farmoutMode: 'manual',
      driverId: null,
      driverSnapshot: null,
      ...reservationData
    };

    const initialStatusCandidate = reservation.farmoutStatus || reservation.farmout_status || reservationData.farmout_status;
    const initialModeCandidate = reservation.farmoutMode || reservation.farmout_mode || reservationData.farmout_mode;

    reservation.farmoutStatus = canonicalizeFarmoutStatus(initialStatusCandidate || 'unassigned') || 'unassigned';
    reservation.farmoutMode = canonicalizeFarmoutMode(initialModeCandidate || 'manual');
    applyFarmoutMetadata(reservation, reservation.farmoutStatus, reservation.farmoutMode);
    if (typeof reservation.driverId === 'undefined') {
      reservation.driverId = null;
    }
    if (!reservation.driverSnapshot) {
      reservation.driverSnapshot = null;
    }

    this.reservations.push(reservation);
    return reservation;
  }

  getReservationById(id) {
    return this.reservations.find(r => String(r.id) === String(id));
  }

  getAllReservations() {
    return [...this.reservations];
  }

  getReservationsByStatus(status) {
    return this.reservations.filter(r => r.status === status);
  }

  acceptReservation(id, driverName) {
    const reservation = this.getReservationById(id);
    if (reservation && reservation.status === 'pending') {
      reservation.status = 'accepted';
      reservation.driverName = driverName;
      reservation.acceptedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  completeReservation(id) {
    const reservation = this.getReservationById(id);
    if (reservation && reservation.status === 'accepted') {
      reservation.status = 'completed';
      reservation.completedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  updateReservation(id, updates) {
    const reservation = this.getReservationById(id);
    if (reservation) {
      Object.assign(reservation, updates);
      reservation.farmoutStatus = canonicalizeFarmoutStatus(reservation.farmoutStatus || reservation.farmout_status || 'unassigned') || 'unassigned';
      reservation.farmoutMode = canonicalizeFarmoutMode(reservation.farmoutMode || reservation.farmout_mode || 'manual');
      applyFarmoutMetadata(reservation, reservation.farmoutStatus, reservation.farmoutMode);
      if (typeof reservation.driverId === 'undefined') {
        reservation.driverId = null;
      }
      if (!reservation.driverSnapshot) {
        reservation.driverSnapshot = null;
      }
      this.emitFarmoutEvent(reservation, 'reservationUpdated');
      return true;
    }
    return false;
  }

  deleteReservation(id) {
    const index = this.reservations.findIndex(r => r.id === id);
    if (index !== -1) {
      this.reservations.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Validate reservation against company settings
   */
  validateReservation(reservationData) {
    const errors = [];

    // Check passenger count
    if (reservationData.passengers && reservationData.passengers > this.maxPassengers) {
      errors.push(`Maximum ${this.maxPassengers} passengers allowed per vehicle`);
    }

    // Check advance reservation requirement
    if (this.requireAdvanceHours > 0) {
      const pickupTime = new Date(reservationData.pickupTime);
      const now = new Date();
      const hoursAhead = (pickupTime - now) / (1000 * 60 * 60);
      
      if (hoursAhead < this.requireAdvanceHours) {
        errors.push(`Reservations must be made at least ${this.requireAdvanceHours} hours in advance`);
      }
    }

    // Check payment requirement
    if (this.requirePaymentUpfront && reservationData.paymentStatus !== 'paid') {
      errors.push('Payment is required upfront for this reservation');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate cancellation fee based on settings
   */
  calculateCancellationFee(reservation, feePercent = null) {
    const percent = feePercent !== null ? feePercent : this.noShowFeePercent;
    const cost = reservation.cost || 0;
    return (cost * percent) / 100;
  }

  setFarmoutMode(id, mode) {
    const reservation = this.getReservationById(id);
    if (!reservation) return false;

    const canonicalMode = canonicalizeFarmoutMode(mode);
    applyFarmoutMetadata(reservation, null, canonicalMode);
    this.emitFarmoutEvent(reservation, 'farmoutModeChanged', { mode: canonicalMode });
    return true;
  }

  updateFarmoutStatus(id, status) {
    const reservation = this.getReservationById(id);
    if (!reservation) return false;

    const canonicalStatus = canonicalizeFarmoutStatus(status) || 'unassigned';
    applyFarmoutMetadata(reservation, canonicalStatus, null);
    this.emitFarmoutEvent(reservation, 'farmoutStatusChanged', { status: canonicalStatus });
    return true;
  }

  assignFarmoutDriver(id, driverInfo) {
    const reservation = this.getReservationById(id);
    if (!reservation) return false;

    const previousDriverId = reservation.driverId;
    reservation.driverId = driverInfo?.id ?? null;
    reservation.driverSnapshot = driverInfo
      ? {
          id: driverInfo.id ?? null,
          name: driverInfo.name ?? '',
          affiliate: driverInfo.affiliate ?? '',
          phone: driverInfo.phone ?? '',
          vehicleType: driverInfo.vehicleType ?? ''
        }
      : null;
    reservation.driverName = reservation.driverSnapshot?.name || reservation.driverName || '';
    const statusAfterAssignment = reservation.driverId ? 'assigned' : 'unassigned';
    reservation.farmoutStatus = canonicalizeFarmoutStatus(statusAfterAssignment) || statusAfterAssignment;
    applyFarmoutMetadata(reservation, reservation.farmoutStatus, null);
    reservation.status = reservation.driverId ? 'accepted' : reservation.status;

    this.emitFarmoutEvent(reservation, 'farmoutDriverAssigned', {
      driverInfo: reservation.driverSnapshot,
      previousDriverId,
      status: reservation.farmoutStatus
    });
    return true;
  }

  clearFarmoutAssignment(id) {
    const reservation = this.getReservationById(id);
    if (!reservation) return false;

    const previousDriverId = reservation.driverId;
    reservation.driverId = null;
    reservation.driverSnapshot = null;
    reservation.driverName = '';
    reservation.farmoutStatus = canonicalizeFarmoutStatus('unassigned') || 'unassigned';
    applyFarmoutMetadata(reservation, reservation.farmoutStatus, null);
    this.emitFarmoutEvent(reservation, 'farmoutDriverCleared', { previousDriverId, status: reservation.farmoutStatus });
    return true;
  }

  emitFarmoutEvent(reservation, type, extra = {}) {
    try {
      window.dispatchEvent(new CustomEvent('reservationFarmoutUpdated', {
        detail: {
          type,
          reservation,
          ...extra
        }
      }));
    } catch (error) {
      console.warn('[ReservationManager] Unable to emit farmout event:', error);
    }
  }

  getVehicleTypeLabel(type) {
    const labels = {
      sedan: 'Sedan',
      suv: 'SUV Limousine',
      stretch: 'Stretch Limousine',
      luxury: 'Luxury Sedan'
    };
    return labels[type] || type;
  }

  getStatusColor(status) {
    const colors = {
      pending: '#ffa726',
      accepted: '#4caf50',
      completed: '#78909c'
    };
    return colors[status] || '#666';
  }
}
