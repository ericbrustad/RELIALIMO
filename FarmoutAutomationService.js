const AUTOMATION_STORAGE_KEY = 'relia_farmout_automation_settings';
const DEFAULT_AUTOMATION_SETTINGS = {
  dispatchIntervalMinutes: 5,
  recipientEntries: '',
  recipients: []
};

const TERMINAL_FARMOUT_STATUSES = new Set([
  'assigned',
  'affiliate_assigned',
  'affiliate_driver_assigned',
  'declined',
  'completed',
  'cancelled',
  'cancelled_by_affiliate',
  'late_cancel',
  'late_cancelled',
  'no_show',
  'in_house'
]);

function normalizeKey(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function clamp(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(Math.max(numeric, min), max);
}

function formatMinutes(minutes) {
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function formatCountdown(msRemaining) {
  if (!Number.isFinite(msRemaining) || msRemaining <= 0) {
    return 'now';
  }
  const totalSeconds = Math.ceil(msRemaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

export class FarmoutAutomationService {
  constructor({ reservationManager, driverTracker, uiManager }) {
    this.reservationManager = reservationManager;
    this.driverTracker = driverTracker;
    this.uiManager = uiManager;
    this.settings = { ...DEFAULT_AUTOMATION_SETTINGS };
    this.jobs = new Map();
    this.controlsAttached = false;
    this.handleReservationEvent = this.handleReservationEvent.bind(this);
  }

  init() {
    this.loadSettings();
    this.attachSettingsControls();
    this.bootstrapReservations();
    window.addEventListener('reservationFarmoutUpdated', this.handleReservationEvent);
  }

  dispose() {
    window.removeEventListener('reservationFarmoutUpdated', this.handleReservationEvent);
    this.jobs.forEach(job => {
      if (job.timeoutId) {
        clearTimeout(job.timeoutId);
      }
    });
    this.jobs.clear();
  }

  getSettings() {
    return { ...this.settings };
  }

  loadSettings() {
    try {
      const stored = localStorage.getItem(AUTOMATION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = {
          ...DEFAULT_AUTOMATION_SETTINGS,
          ...parsed,
          dispatchIntervalMinutes: clamp(parsed.dispatchIntervalMinutes, 1, 60, DEFAULT_AUTOMATION_SETTINGS.dispatchIntervalMinutes),
          recipientEntries: parsed.recipientEntries || '',
          recipients: Array.isArray(parsed.recipients) ? parsed.recipients : []
        };
      } else {
        this.settings = { ...DEFAULT_AUTOMATION_SETTINGS };
      }
    } catch (error) {
      console.warn('[FarmoutAutomationService] Unable to load settings, using defaults:', error);
      this.settings = { ...DEFAULT_AUTOMATION_SETTINGS };
    }
  }

  saveSettings() {
    try {
      const payload = {
        dispatchIntervalMinutes: this.settings.dispatchIntervalMinutes,
        recipientEntries: this.settings.recipientEntries,
        recipients: this.settings.recipients
      };
      localStorage.setItem(AUTOMATION_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('[FarmoutAutomationService] Unable to save settings:', error);
    }
  }

  updateSettings(partial) {
    this.settings = {
      ...this.settings,
      ...partial,
      dispatchIntervalMinutes: clamp(
        partial.dispatchIntervalMinutes ?? this.settings.dispatchIntervalMinutes,
        1,
        60,
        DEFAULT_AUTOMATION_SETTINGS.dispatchIntervalMinutes
      )
    };
    this.saveSettings();
    this.updateAutomationStatusDisplay();
  }

  attachSettingsControls() {
    if (this.controlsAttached) {
      this.refreshSettingsControls();
      return;
    }

    const intervalInput = document.getElementById('farmoutAutoInterval');
    const recipientsInput = document.getElementById('farmoutAdminRecipients');

    if (intervalInput) {
      intervalInput.value = this.settings.dispatchIntervalMinutes;
      intervalInput.addEventListener('change', () => {
        const nextValue = clamp(intervalInput.value, 1, 60, this.settings.dispatchIntervalMinutes);
        intervalInput.value = nextValue;
        this.updateSettings({ dispatchIntervalMinutes: nextValue });
        this.logAutomationEvent(null, `Auto-dispatch interval set to ${formatMinutes(nextValue)}.`);
      });
    }

    if (recipientsInput) {
      recipientsInput.value = this.settings.recipientEntries;
      recipientsInput.addEventListener('change', () => {
        this.applyRecipientEntries(recipientsInput.value);
        this.logAutomationEvent(null, `Escalation recipients updated (${this.settings.recipients.length} contact${this.settings.recipients.length === 1 ? '' : 's'}).`);
      });
    }

    this.controlsAttached = true;
    this.updateAutomationStatusDisplay();
  }

  refreshSettingsControls() {
    const intervalInput = document.getElementById('farmoutAutoInterval');
    if (intervalInput) {
      intervalInput.value = this.settings.dispatchIntervalMinutes;
    }
    const recipientsInput = document.getElementById('farmoutAdminRecipients');
    if (recipientsInput) {
      recipientsInput.value = this.settings.recipientEntries;
    }
  }

  applyRecipientEntries(entriesText) {
    const entries = (entriesText || '')
      .split(/\n|,/)
      .map(entry => entry.trim())
      .filter(Boolean);

    const recipients = entries.map(entry => this.resolveRecipientEntry(entry));
    this.settings.recipientEntries = entriesText || '';
    this.settings.recipients = recipients;
    this.saveSettings();
  }

  resolveRecipientEntry(entry) {
    const [identifierRaw, phoneRaw] = entry.split('|').map(part => part.trim());
    const identifier = identifierRaw || '';
    const phone = phoneRaw || '';
    const directoryMatch = this.lookupUserDirectory(identifier);

    return {
      identifier,
      email: directoryMatch?.email || (identifier.includes('@') ? identifier : ''),
      phone: directoryMatch?.phone || phone,
      userId: directoryMatch?.id || null
    };
  }

  lookupUserDirectory(identifier) {
    if (!identifier) {
      return null;
    }

    try {
      const directoryRaw = localStorage.getItem('relia_user_directory');
      if (!directoryRaw) {
        return null;
      }
      const directory = JSON.parse(directoryRaw);
      if (!Array.isArray(directory)) {
        return null;
      }
      const normalized = identifier.toLowerCase();
      return directory.find(entry => {
        if (!entry) return false;
        const { id, email } = entry;
        if (id && String(id).toLowerCase() === normalized) return true;
        if (email && email.toLowerCase() === normalized) return true;
        return false;
      }) || null;
    } catch (error) {
      console.warn('[FarmoutAutomationService] Unable to read user directory:', error);
      return null;
    }
  }

  bootstrapReservations() {
    const reservations = this.reservationManager.getAllReservations();
    reservations.forEach(reservation => {
      if (this.shouldAutoDispatch(reservation)) {
        this.ensureJob(reservation);
      }
    });
  }

  handleReservationEvent(event) {
    if (!event?.detail?.reservation) {
      return;
    }

    const { reservation, type, status, mode, driverInfo } = event.detail;
    if (!reservation) {
      return;
    }

    const canonicalMode = this.normalizeMode(mode || reservation.farmoutMode || reservation.farmout_mode);
    const canonicalStatus = this.normalizeStatus(status || reservation.farmoutStatus || reservation.farmout_status);
    const reservationId = String(reservation.id);

    if (type === 'farmoutDriverAssigned') {
      this.stopJob(reservationId, driverInfo ? `Driver ${driverInfo.name || driverInfo.id || ''} accepted. Auto-dispatch stopped.` : 'Driver accepted. Auto-dispatch stopped.');
      return;
    }

    if (type === 'farmoutDriverCleared') {
      if (canonicalMode === 'automatic' && !this.isTerminalStatus(canonicalStatus)) {
        this.ensureJob(reservation);
      }
      return;
    }

    if (type === 'farmoutModeChanged') {
      if (canonicalMode === 'automatic' && !this.isTerminalStatus(canonicalStatus)) {
        this.ensureJob(reservation);
      } else {
        this.stopJob(reservationId, 'Farm-out mode switched to manual.');
      }
      return;
    }

    if (type === 'farmoutStatusChanged' || type === 'reservationUpdated') {
      if (this.isTerminalStatus(canonicalStatus)) {
        this.stopJob(reservationId, `Farm-out status changed to ${canonicalStatus}.`);
      } else if (canonicalMode === 'automatic') {
        this.ensureJob(reservation);
      }
      return;
    }
  }

  shouldAutoDispatch(reservation) {
    const mode = this.normalizeMode(reservation?.farmoutMode || reservation?.farmout_mode);
    const status = this.normalizeStatus(reservation?.farmoutStatus || reservation?.farmout_status);
    if (mode !== 'automatic') {
      return false;
    }
    if (this.isTerminalStatus(status)) {
      return false;
    }
    return true;
  }

  ensureJob(reservation) {
    const reservationId = String(reservation.id);
    if (this.jobs.has(reservationId)) {
      this.updateAutomationStatusDisplay(reservationId);
      return;
    }

    const job = {
      reservationId,
      attemptedDriverIds: new Set(),
      status: 'running',
      timeoutId: null,
      timeoutPurpose: null,
      nextAttemptAt: null,
      lastAttemptAt: null
    };

    this.jobs.set(reservationId, job);
    this.logAutomationEvent(reservationId, `Auto-dispatch activated with ${formatMinutes(this.settings.dispatchIntervalMinutes)} between offers.`);
    this.sendNextOffer(job);
  }

  sendNextOffer(job) {
    const reservation = this.reservationManager.getReservationById(job.reservationId);
    if (!reservation) {
      this.stopJob(job.reservationId, 'Reservation no longer available.');
      return;
    }

    const availableDrivers = this.driverTracker.getAvailableDrivers?.() || [];
    const remainingDrivers = availableDrivers
      .filter(driver => !job.attemptedDriverIds.has(driver.id))
      .sort((a, b) => a.id - b.id);

    if (remainingDrivers.length === 0) {
      this.scheduleEscalation(job);
      return;
    }

    const targetDriver = remainingDrivers[0];
    job.attemptedDriverIds.add(targetDriver.id);
    job.lastAttemptAt = Date.now();

    this.logAutomationEvent(
      job.reservationId,
      `Text request sent to ${targetDriver.name || 'Driver'} ${targetDriver.phone ? `(${targetDriver.phone})` : ''}.`
    );

    if (typeof this.reservationManager.updateFarmoutStatus === 'function') {
      this.reservationManager.updateFarmoutStatus(job.reservationId, 'offered');
    }

    if (remainingDrivers.length > 1) {
      this.scheduleNextAttempt(job, 'offer');
    } else {
      this.scheduleNextAttempt(job, 'escalate');
    }
  }

  scheduleNextAttempt(job, purpose) {
    if (job.timeoutId) {
      clearTimeout(job.timeoutId);
    }

    const intervalMs = Math.max(1, this.settings.dispatchIntervalMinutes) * 60000;
    job.timeoutPurpose = purpose;
    job.nextAttemptAt = Date.now() + intervalMs;
    job.timeoutId = window.setTimeout(() => {
      job.timeoutId = null;
      if (purpose === 'offer') {
        this.sendNextOffer(job);
      } else {
        this.handleEscalation(job);
      }
    }, intervalMs);

    this.updateAutomationStatusDisplay(job.reservationId);
  }

  scheduleEscalation(job) {
    if (job.attemptedDriverIds.size === 0) {
      this.logAutomationEvent(job.reservationId, 'No available drivers to contact. Escalating immediately.');
      this.handleEscalation(job);
      return;
    }

    this.logAutomationEvent(job.reservationId, 'All available drivers notified. Waiting before escalation.');
    this.scheduleNextAttempt(job, 'escalate');
  }

  handleEscalation(job) {
    const reservation = this.reservationManager.getReservationById(job.reservationId);
    const summary = this.describeReservation(reservation);

    if (this.settings.recipients.length === 0) {
      this.logAutomationEvent(job.reservationId, 'Escalation attempted but no admin/dispatch contacts are configured.');
    } else {
      this.settings.recipients.forEach(recipient => {
        const recipientLabel = recipient.email || recipient.phone || recipient.identifier || 'recipient';
        this.logAutomationEvent(job.reservationId, `Escalation sent to ${recipientLabel}. Trip requires manual attention. ${summary}`);
      });
    }

    window.dispatchEvent(
      new CustomEvent('farmoutEscalation', {
        detail: {
          reservation,
          recipients: this.settings.recipients,
          summary
        }
      })
    );

    this.stopJob(job.reservationId, 'Escalation triggered.');
  }

  stopJob(reservationId, reason) {
    const job = this.jobs.get(String(reservationId));
    if (!job) {
      this.updateAutomationStatusDisplay(reservationId);
      return;
    }

    if (job.timeoutId) {
      clearTimeout(job.timeoutId);
    }

    this.jobs.delete(String(reservationId));

    if (reason) {
      this.logAutomationEvent(reservationId, reason);
    }

    this.updateAutomationStatusDisplay(reservationId);
  }

  describeReservation(reservation) {
    if (!reservation) {
      return '';
    }
    const passenger = reservation.passengerName || reservation.passenger_name || 'Passenger';
    const pickupTime = reservation.pickupTime || reservation.pickup_time || '';
    const pickupDate = reservation.pickupDate || reservation.pickup_date || '';
    const pickup = reservation.pickupLocation || reservation.pickup_location || '';
    return `${passenger} — ${pickupDate} ${pickupTime} — ${pickup}`.trim();
  }

  normalizeMode(mode) {
    const normalized = normalizeKey(mode || 'manual');
    if (normalized === 'auto' || normalized === 'automatic_dispatch' || normalized === 'auto_dispatch') {
      return 'automatic';
    }
    if (normalized === 'automatic' || normalized === 'manual') {
      return normalized;
    }
    return normalized || 'manual';
  }

  normalizeStatus(status) {
    return normalizeKey(status || 'unassigned');
  }

  isTerminalStatus(status) {
    return TERMINAL_FARMOUT_STATUSES.has(status);
  }

  logAutomationEvent(reservationId, message) {
    if (!message) {
      return;
    }
    if (reservationId) {
      this.uiManager?.logFarmoutActivity?.(reservationId, message);
    } else {
      console.info('[FarmoutAutomation]', message);
    }
    this.updateAutomationStatusDisplay(reservationId);
  }

  updateAutomationStatusDisplay(reservationId = null) {
    const statusEl = document.getElementById('farmoutAutomationStatus');
    if (!statusEl) {
      return;
    }

    const selectedId = this.uiManager?.selectedFarmoutReservationId ? String(this.uiManager.selectedFarmoutReservationId) : null;
    if (reservationId && selectedId && String(reservationId) !== selectedId) {
      return;
    }

    if (!selectedId) {
      statusEl.textContent = 'Auto-dispatch inactive for this trip';
      return;
    }

    const job = this.jobs.get(selectedId);
    if (job) {
      const now = Date.now();
      const msRemaining = job.nextAttemptAt ? job.nextAttemptAt - now : 0;
      if (job.timeoutPurpose === 'offer') {
        statusEl.textContent = `Auto-dispatch active • next driver in ${formatCountdown(msRemaining)}`;
      } else if (job.timeoutPurpose === 'escalate') {
        statusEl.textContent = `Awaiting driver responses • escalation in ${formatCountdown(msRemaining)}`;
      } else {
        statusEl.textContent = 'Auto-dispatch active';
      }
      return;
    }

    const reservation = this.reservationManager.getReservationById(selectedId);
    const mode = this.normalizeMode(reservation?.farmoutMode || reservation?.farmout_mode);
    const status = this.normalizeStatus(reservation?.farmoutStatus || reservation?.farmout_status);
    if (mode === 'automatic' && !this.isTerminalStatus(status)) {
      statusEl.textContent = 'Auto-dispatch idle • awaiting next trigger';
    } else {
      statusEl.textContent = 'Auto-dispatch inactive for this trip';
    }
  }

  handleReservationSelected(reservation) {
    this.refreshSettingsControls();
    this.updateAutomationStatusDisplay(reservation?.id ? String(reservation.id) : null);
  }

  handleReservationCreated(reservation) {
    if (!reservation) {
      return;
    }
    if (this.shouldAutoDispatch(reservation)) {
      this.ensureJob(reservation);
    } else {
      this.updateAutomationStatusDisplay(reservation.id);
    }
  }
}
