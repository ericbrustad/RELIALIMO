import { wireMainNav } from './navigation.js';

class Calendar {
  constructor() {
    this.currentView = 'day';
    this.currentDate = new Date();
    this.db = null;
    this.tooltipEl = null;
    this.modalEl = null;
    this.settingsStorageKey = 'relia_calendar_settings_anon';
    this.selectedFilters = {
      drivers: [],
      cars: [],
      vehicleTypes: [],
      statuses: []
    };
    this.init().catch(err => console.error('❌ Calendar init failed:', err));
  }

  async init() {
    await this.resolveUserSettingsKey();
    await this.loadDbModule();
    this.setupEventListeners();
    this.syncCurrentDateFromSelector();
    this.loadSettingsIntoUi();
    this.render();
  }

  async resolveUserSettingsKey() {
    // Keep calendar working even if auth/supabase isn't configured.
    try {
      const mod = await import('./supabase-client.js');
      const supabase = mod?.supabase;
      if (!supabase?.auth?.getUser) return;
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      const raw = user?.id || user?.email;
      if (raw) {
        const safe = String(raw).replace(/[^a-zA-Z0-9_.@-]/g, '_');
        this.settingsStorageKey = `relia_calendar_settings_${safe}`;
      }
    } catch {
      // ignore
    }
  }

  async loadDbModule() {
    try {
      const module = await import('./assets/db.js');
      this.db = module.db;
      console.log('✅ Calendar database module loaded');
    } catch (error) {
      console.error('❌ Failed to load database module for calendar:', error);
      this.db = null;
    }
  }

  setupEventListeners() {
    // Main navigation buttons
    wireMainNav();

    // View type buttons
    document.querySelectorAll('.view-type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.target.dataset.view;
        this.switchView(view);
        this.saveSettingsFromUi();
      });
    });

    // Date selector
    const goToDateBtn = document.getElementById('goToDate');
    if (goToDateBtn) {
      goToDateBtn.addEventListener('click', () => {
        this.goToSelectedDate();
        this.saveSettingsFromUi();
      });
    }

    const dateSelector = document.getElementById('dateSelector');
    if (dateSelector) {
      dateSelector.addEventListener('change', () => {
        // Keep simple: update the date but only re-render on "Go".
        this.syncCurrentDateFromSelector();
        this.saveSettingsFromUi();
      });
    }

    // Print button
    const printBtn = document.getElementById('printCalendar');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        this.printCalendar();
      });
    }

    // Mobile view checkbox
    const mobileViewCheckbox = document.getElementById('mobileView');
    if (mobileViewCheckbox) {
      mobileViewCheckbox.addEventListener('change', (e) => {
        this.toggleMobileView(e.target.checked);
        this.saveSettingsFromUi();
      });
    }

    // Filter checkboxes
    const onlyReservations = document.getElementById('onlyReservations');
    if (onlyReservations) {
      onlyReservations.addEventListener('change', (e) => {
        this.filterByReservations(e.target.checked);
        this.render();
        this.saveSettingsFromUi();
      });
    }

    const onlyMyEvents = document.getElementById('onlyMyEvents');
    if (onlyMyEvents) {
      onlyMyEvents.addEventListener('change', (e) => {
        this.filterByMyEvents(e.target.checked);
        this.render();
        this.saveSettingsFromUi();
      });
    }

    const showTicker = document.getElementById('showTicker');
    if (showTicker) {
      showTicker.addEventListener('change', () => {
        this.applyTickerVisibilityFromUi();
        this.updateHolidayTicker();
        this.saveSettingsFromUi();
      });
    }

    const showFederal = document.getElementById('showFederalHolidays');
    if (showFederal) {
      showFederal.addEventListener('change', () => {
        this.render();
        this.saveSettingsFromUi();
      });
    }

    const showMajor = document.getElementById('showMajorObservances');
    if (showMajor) {
      showMajor.addEventListener('change', () => {
        this.render();
        this.saveSettingsFromUi();
      });
    }

    // Launch filters button
    const launchBtn = document.getElementById('launchFilters');
    if (launchBtn) {
      launchBtn.addEventListener('click', () => {
        this.applyFilters();
        this.render();
        this.saveSettingsFromUi();
      });
    }

    // Persist filter dropdowns as they change
    ['driverFilter', 'carFilter', 'vehicleTypeFilter', 'statusFilter'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        this.applyFilters();
        this.render();
        this.saveSettingsFromUi();
      });
    });
  }

  navigateToSection(section) {
    // Navigate to different main sections
    if (section === 'office') {
      window.location.href = 'my-office.html';
    } else if (section === 'accounts') {
      window.location.href = 'accounts.html';
    } else if (section === 'quotes') {
      window.location.href = 'quotes.html';
    } else if (section === 'calendar') {
      window.location.href = 'calendar.html';
    } else if (section === 'reservations') {
      window.location.href = 'reservations-list.html';
    } else {
      // Placeholder for other sections
      alert(`${section} section coming soon`);
    }
  }

  switchView(view) {
    // Update active view button
    document.querySelectorAll('.view-type-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.view === view) {
        btn.classList.add('active');
      }
    });

    this.currentView = view;
    console.log(`Switched to ${view} view`);

    // Only month view is rendered for now; keep UX minimal.
    this.render();
  }

  goToSelectedDate() {
    const dateSelector = document.getElementById('dateSelector');
    if (dateSelector) {
      const selectedDate = dateSelector.value;
      console.log('Going to date:', selectedDate);
      this.syncCurrentDateFromSelector();
      this.render();
    }
  }

  printCalendar() {
    console.log('Printing calendar...');
    window.print();
  }

  toggleMobileView(enabled) {
    console.log('Mobile view:', enabled);
    document.body.classList.toggle('calendar-mobile', !!enabled);
  }

  filterByReservations(enabled) {
    console.log('Only Reservations filter:', enabled);
    // In a real application, this would filter the calendar to show only reservations
  }

  filterByMyEvents(enabled) {
    console.log('Only My Events filter:', enabled);
    // In a real application, this would filter the calendar to show only user's events
  }

  applyFilters() {
    const driverFilter = document.getElementById('driverFilter')?.value;
    const carFilter = document.getElementById('carFilter')?.value;
    const vehicleTypeFilter = document.getElementById('vehicleTypeFilter')?.value;
    const statusFilter = document.getElementById('statusFilter')?.value;

    this.selectedFilters = {
      drivers: driverFilter ? [driverFilter] : [],
      cars: carFilter ? [carFilter] : [],
      vehicleTypes: vehicleTypeFilter ? [vehicleTypeFilter] : [],
      statuses: statusFilter ? [statusFilter] : []
    };

    console.log('Applying filters:', this.selectedFilters);
  }

  syncCurrentDateFromSelector() {
    const dateSelector = document.getElementById('dateSelector');
    if (!dateSelector) return;
    const value = String(dateSelector.value || '').trim();
    const m = value.match(/^(\d{4})-(\d{2})$/);
    if (!m) return;

    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return;
    this.currentDate = new Date(year, monthIndex, 1);
  }

  render() {
    this.closeTooltip();
    this.closeModal();

    const calendarBody = document.getElementById('calendarBody');
    if (!calendarBody) {
      console.warn('⚠️ calendarBody not found');
      return;
    }

    const year = this.currentDate.getFullYear();
    const monthIndex = this.currentDate.getMonth();
    const firstOfMonth = new Date(year, monthIndex, 1);
    const start = new Date(year, monthIndex, 1 - firstOfMonth.getDay()); // Sunday start

    const dayCellMap = new Map();

    // Build 6-week grid
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(start);
      cellDate.setDate(start.getDate() + i);

      const cell = document.createElement('div');
      cell.className = 'calendar-cell';
      if (cellDate.getMonth() !== monthIndex) {
        cell.classList.add('empty-cell');
      }

      const dateEl = document.createElement('div');
      dateEl.className = 'cell-date';
      dateEl.textContent = String(cellDate.getDate());
      cell.appendChild(dateEl);

      const content = document.createElement('div');
      content.className = 'cell-content';
      cell.appendChild(content);

      if (cellDate.getMonth() === monthIndex) {
        dayCellMap.set(this.dateKey(cellDate), content);
      }

      fragment.appendChild(cell);
    }

    // Delete all events (and all cells) then re-add
    calendarBody.innerHTML = '';
    calendarBody.appendChild(fragment);

    // Add holidays / observances
    const showFederal = document.getElementById('showFederalHolidays')?.checked ?? true;
    const showMajor = document.getElementById('showMajorObservances')?.checked ?? false;
    const holidayEvents = [
      ...(showFederal ? this.getUSHolidays(year) : []),
      ...(showMajor ? this.getMajorObservances(year) : [])
    ].filter(h => h?.date?.getMonth?.() === monthIndex);

    for (const h of holidayEvents) {
      const key = this.dateKey(h.date);
      const container = dayCellMap.get(key);
      if (!container) continue;

      const el = this.createHolidayEventEl(h);
      container.appendChild(el);
    }

    // Add reservations
    const reservations = this.getReservationsForMonth(year, monthIndex);
    for (const res of reservations) {
      const el = this.createReservationEventEl(res);
      const container = dayCellMap.get(el.dataset.dateKey);
      if (!container) continue;
      container.appendChild(el);
    }

    this.updateHolidayTicker();
  }

  loadSettingsIntoUi() {
    try {
      const raw = localStorage.getItem(this.settingsStorageKey);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return;

      if (s.currentView) this.currentView = s.currentView;
      if (s.monthValue) {
        const sel = document.getElementById('dateSelector');
        if (sel) sel.value = s.monthValue;
        this.syncCurrentDateFromSelector();
      }

      const onlyRes = document.getElementById('onlyReservations');
      if (onlyRes && typeof s.onlyReservations === 'boolean') onlyRes.checked = s.onlyReservations;
      const onlyMy = document.getElementById('onlyMyEvents');
      if (onlyMy && typeof s.onlyMyEvents === 'boolean') onlyMy.checked = s.onlyMyEvents;

      const showTicker = document.getElementById('showTicker');
      if (showTicker && typeof s.showTicker === 'boolean') showTicker.checked = s.showTicker;
      const showFed = document.getElementById('showFederalHolidays');
      if (showFed && typeof s.showFederalHolidays === 'boolean') showFed.checked = s.showFederalHolidays;
      const showMajor = document.getElementById('showMajorObservances');
      if (showMajor && typeof s.showMajorObservances === 'boolean') showMajor.checked = s.showMajorObservances;

      this.applyTickerVisibilityFromUi();
      const mobile = document.getElementById('mobileView');
      if (mobile && typeof s.mobileView === 'boolean') {
        mobile.checked = s.mobileView;
        this.toggleMobileView(s.mobileView);
      }

      const setSelect = (id, v) => {
        const el = document.getElementById(id);
        if (el && v !== undefined && v !== null) el.value = v;
      };
      setSelect('driverFilter', s.driverFilter);
      setSelect('carFilter', s.carFilter);
      setSelect('vehicleTypeFilter', s.vehicleTypeFilter);
      setSelect('statusFilter', s.statusFilter);

      // Ensure view buttons reflect the loaded view
      document.querySelectorAll('.view-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === this.currentView);
      });

      this.applyFilters();
    } catch (e) {
      console.warn('⚠️ Failed to load calendar settings:', e);
    }
  }

  saveSettingsFromUi() {
    try {
      const dateSelector = document.getElementById('dateSelector');
      const settings = {
        currentView: this.currentView,
        monthValue: dateSelector?.value || null,
        onlyReservations: document.getElementById('onlyReservations')?.checked ?? true,
        onlyMyEvents: document.getElementById('onlyMyEvents')?.checked ?? false,
        showTicker: document.getElementById('showTicker')?.checked ?? false,
        showFederalHolidays: document.getElementById('showFederalHolidays')?.checked ?? true,
        showMajorObservances: document.getElementById('showMajorObservances')?.checked ?? false,
        mobileView: document.getElementById('mobileView')?.checked ?? false,
        driverFilter: document.getElementById('driverFilter')?.value ?? '',
        carFilter: document.getElementById('carFilter')?.value ?? '',
        vehicleTypeFilter: document.getElementById('vehicleTypeFilter')?.value ?? '',
        statusFilter: document.getElementById('statusFilter')?.value ?? ''
      };
      localStorage.setItem(this.settingsStorageKey, JSON.stringify(settings));
    } catch (e) {
      console.warn('⚠️ Failed to persist calendar settings:', e);
    }
  }

  applyTickerVisibilityFromUi() {
    const enabled = document.getElementById('showTicker')?.checked ?? false;
    document.body.classList.toggle('show-holiday-ticker', !!enabled);
  }

  updateHolidayTicker() {
    const track = document.getElementById('holidayTickerTrack');
    if (!track) return;

    const enabled = document.getElementById('showTicker')?.checked ?? false;
    if (!enabled) {
      track.innerHTML = '';
      return;
    }

    const showFederal = document.getElementById('showFederalHolidays')?.checked ?? true;
    const showMajor = document.getElementById('showMajorObservances')?.checked ?? false;

    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 120);

    const events = [
      ...(showFederal ? this.getUSHolidays(now.getFullYear()) : []),
      ...(showMajor ? this.getMajorObservances(now.getFullYear()) : []),
      ...(showFederal ? this.getUSHolidays(now.getFullYear() + 1) : []),
      ...(showMajor ? this.getMajorObservances(now.getFullYear() + 1) : [])
    ]
      .filter(e => e?.date instanceof Date && !isNaN(e.date.getTime()))
      .filter(e => e.date >= this.startOfDay(now) && e.date <= horizon)
      .sort((a, b) => a.date - b.date);

    if (events.length === 0) {
      track.textContent = 'No upcoming holidays/observances';
      return;
    }

    const label = (d) => d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    const html = events
      .map(e => {
        const text = `${label(e.date)} — ${e.name}`;
        return `<span class="holiday-ticker-item"><span class="holiday-ticker-dot"></span>${this.escapeHtml(text)}</span>`;
      })
      .join('');

    // Duplicate the content for seamless looping
    track.innerHTML = html + html;
  }

  startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  getReservationsForMonth(year, monthIndex) {
    if (!this.db) return [];
    let all = [];
    try {
      all = this.db.getAllReservations() || [];
    } catch (e) {
      console.error('❌ Failed to load reservations from db:', e);
      return [];
    }

    const onlyReservations = document.getElementById('onlyReservations')?.checked ?? true;
    if (!onlyReservations) {
      // Still show reservations even when unchecked (it likely means “include other events”).
      // There are no other event sources yet.
    }

    const filtered = all
      .filter(r => r && r.pickup_at)
      .map(r => ({
        raw: r,
        pickupDate: this.parseLocalDateTime(r.pickup_at)
      }))
      .filter(x => x.pickupDate && x.pickupDate.getFullYear() === year && x.pickupDate.getMonth() === monthIndex)
      .sort((a, b) => a.pickupDate - b.pickupDate);

    return filtered.map(x => x.raw);
  }

  createReservationEventEl(res) {
    const pickupDate = this.parseLocalDateTime(res.pickup_at);
    const dateKey = this.dateKey(pickupDate);
    const timeLabel = pickupDate
      ? pickupDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : '';

    const conf = String(res.confirmation_number || res.id || '').trim();
    const passenger = String(res.passenger_name || '').trim();
    const vehicle = String(res.vehicle_type || '').trim();
    const company = String(res.company_name || '').trim();
    const status = String(res.status || '').trim();

    const stops = Array.isArray(res.stops) ? res.stops : [];
    const pickupStop = stops.find(s => (s?.type || '').toLowerCase() === 'pickup') || stops[0] || null;
    const dropoffStop = stops.find(s => (s?.type || '').toLowerCase() === 'dropoff') || stops[1] || null;
    const pickupAddr = this.formatStop(pickupStop);
    const dropoffAddr = this.formatStop(dropoffStop);

    const el = document.createElement('div');
    el.className = 'event-item event-cyan';
    el.dataset.type = 'reservation';
    el.dataset.conf = conf;
    el.dataset.dateKey = dateKey;
    el.dataset.time = timeLabel;
    el.dataset.passenger = passenger;
    el.dataset.vehicle = vehicle;
    el.dataset.company = company;
    el.dataset.status = status;
    el.dataset.pickup = pickupAddr;
    el.dataset.dropoff = dropoffAddr;

    el.innerHTML = `
      <div class="event-time">${this.escapeHtml(timeLabel)}${conf ? `  #${this.escapeHtml(conf)}` : ''}</div>
      <div class="event-vehicle">${this.escapeHtml([vehicle, passenger].filter(Boolean).join(', '))}</div>
    `;

    this.attachReservationInteractions(el);
    return el;
  }

  createHolidayEventEl(holiday) {
    const el = document.createElement('div');
    el.className = 'event-item event-orange';
    el.dataset.type = 'holiday';
    el.dataset.dateKey = this.dateKey(holiday.date);
    el.dataset.name = holiday.name;

    el.innerHTML = `
      <div class="event-time">Holiday</div>
      <div class="event-vehicle">${this.escapeHtml(holiday.name)}</div>
    `;

    // Tooltip on hover (no modal/nav required)
    el.addEventListener('mouseenter', (e) => {
      this.openTooltip(`Holiday: ${holiday.name}`);
      this.positionTooltip(e);
    });
    el.addEventListener('mousemove', (e) => this.positionTooltip(e));
    el.addEventListener('mouseleave', () => this.closeTooltip());

    return el;
  }

  attachReservationInteractions(el) {
    let clickTimer = null;
    const clickDelay = 250;

    el.addEventListener('mouseenter', (e) => {
      this.openTooltip(this.buildReservationTooltipText(el));
      this.positionTooltip(e);
    });
    el.addEventListener('mousemove', (e) => this.positionTooltip(e));
    el.addEventListener('mouseleave', () => this.closeTooltip());

    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        this.openReservationModal(el);
        clickTimer = null;
      }, clickDelay);
    });

    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      const conf = el.dataset.conf;
      if (conf) {
        window.location.href = `reservations-list.html?openConf=${encodeURIComponent(conf)}&src=calendar`;
      }
    });
  }

  buildReservationTooltipText(el) {
    const parts = [];
    const conf = el.dataset.conf;
    if (conf) parts.push(`#${conf}`);
    if (el.dataset.time) parts.push(el.dataset.time);
    if (el.dataset.passenger) parts.push(el.dataset.passenger);
    if (el.dataset.pickup) parts.push(`PU: ${el.dataset.pickup}`);
    if (el.dataset.dropoff) parts.push(`DO: ${el.dataset.dropoff}`);
    return parts.join('\n');
  }

  openReservationModal(el) {
    this.closeModal();

    const conf = el.dataset.conf || '';
    const title = conf ? `Reservation #${conf}` : 'Reservation';

    const lines = [
      { label: 'Time', value: el.dataset.time || '' },
      { label: 'Passenger', value: el.dataset.passenger || '' },
      { label: 'Company', value: el.dataset.company || '' },
      { label: 'Vehicle', value: el.dataset.vehicle || '' },
      { label: 'Status', value: el.dataset.status || '' },
      { label: 'Pickup', value: el.dataset.pickup || '' },
      { label: 'Dropoff', value: el.dataset.dropoff || '' }
    ].filter(x => x.value);

    const modal = document.createElement('div');
    modal.className = 'calendar-modal';
    modal.innerHTML = `
      <div class="calendar-modal-overlay"></div>
      <div class="calendar-modal-content" role="dialog" aria-modal="true">
        <div class="calendar-modal-header">
          <div class="calendar-modal-title">${this.escapeHtml(title)}</div>
          <button class="calendar-modal-close" type="button" aria-label="Close">×</button>
        </div>
        <div class="calendar-modal-body">
          ${lines.map(l => `
            <div class="calendar-modal-row">
              <div class="calendar-modal-label">${this.escapeHtml(l.label)}:</div>
              <div class="calendar-modal-value">${this.escapeHtml(l.value)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const close = () => this.closeModal();
    modal.querySelector('.calendar-modal-overlay')?.addEventListener('click', close);
    modal.querySelector('.calendar-modal-close')?.addEventListener('click', close);

    document.addEventListener('keydown', this._onModalKeydown = (e) => {
      if (e.key === 'Escape') close();
    }, { once: true });

    document.body.appendChild(modal);
    this.modalEl = modal;
  }

  closeModal() {
    if (this.modalEl) {
      try { this.modalEl.remove(); } catch { /* ignore */ }
      this.modalEl = null;
    }
  }

  openTooltip(text) {
    this.closeTooltip();
    const tip = document.createElement('div');
    tip.className = 'calendar-tooltip';
    tip.textContent = text;
    document.body.appendChild(tip);
    this.tooltipEl = tip;
  }

  positionTooltip(e) {
    if (!this.tooltipEl) return;
    const offset = 12;
    const x = (e?.clientX ?? 0) + offset;
    const y = (e?.clientY ?? 0) + offset;
    this.tooltipEl.style.left = `${x}px`;
    this.tooltipEl.style.top = `${y}px`;
  }

  closeTooltip() {
    if (this.tooltipEl) {
      try { this.tooltipEl.remove(); } catch { /* ignore */ }
      this.tooltipEl = null;
    }
  }

  dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  parseLocalDateTime(value) {
    if (!value) return null;
    // Accept: YYYY-MM-DD or YYYY-MM-DDTHH:mm
    const s = String(value).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!m) {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }
    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    const day = Number(m[3]);
    const hh = Number(m[4] ?? 0);
    const mm = Number(m[5] ?? 0);
    const d = new Date(year, monthIndex, day, hh, mm, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  formatStop(stop) {
    if (!stop) return '';
    const parts = [];
    const name = (stop.locationName || stop.name || '').toString().trim();
    const addr1 = (stop.address1 || stop.address || '').toString().trim();
    const city = (stop.city || '').toString().trim();
    const state = (stop.state || '').toString().trim();
    if (name) parts.push(name);
    if (addr1) parts.push(addr1);
    const cityState = [city, state].filter(Boolean).join(', ');
    if (cityState) parts.push(cityState);
    return parts.join(' • ');
  }

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // US Federal holidays (basic set)
  getUSHolidays(year) {
    const fixed = (monthIndex, day, name) => ({
      name,
      date: new Date(year, monthIndex, day)
    });

    const nthWeekday = (monthIndex, weekday, n, name) => {
      // weekday: 0=Sun..6=Sat, n: 1..5
      const first = new Date(year, monthIndex, 1);
      const offset = (weekday - first.getDay() + 7) % 7;
      const day = 1 + offset + (n - 1) * 7;
      return { name, date: new Date(year, monthIndex, day) };
    };

    const lastWeekday = (monthIndex, weekday, name) => {
      const last = new Date(year, monthIndex + 1, 0);
      const offset = (last.getDay() - weekday + 7) % 7;
      last.setDate(last.getDate() - offset);
      return { name, date: last };
    };

    return [
      fixed(0, 1, "New Year's Day"),
      nthWeekday(0, 1, 3, 'Martin Luther King Jr. Day'), // 3rd Monday Jan
      nthWeekday(1, 1, 3, "Presidents' Day"), // 3rd Monday Feb
      lastWeekday(4, 1, 'Memorial Day'), // last Monday May
      fixed(5, 19, 'Juneteenth'),
      fixed(6, 4, 'Independence Day'),
      nthWeekday(8, 1, 1, 'Labor Day'), // 1st Monday Sep
      nthWeekday(9, 1, 2, 'Columbus Day'), // 2nd Monday Oct
      fixed(10, 11, "Veterans Day"),
      nthWeekday(10, 4, 4, 'Thanksgiving Day'), // 4th Thursday Nov
      fixed(11, 25, 'Christmas Day')
    ];
  }

  // Major observances (non-federal) used for ticker + optional awareness
  getMajorObservances(year) {
    const fixed = (monthIndex, day, name) => ({ name, date: new Date(year, monthIndex, day) });
    const nthWeekday = (monthIndex, weekday, n, name) => {
      const first = new Date(year, monthIndex, 1);
      const offset = (weekday - first.getDay() + 7) % 7;
      const day = 1 + offset + (n - 1) * 7;
      return { name, date: new Date(year, monthIndex, day) };
    };

    return [
      fixed(1, 14, "Valentine's Day"),
      fixed(2, 17, "St. Patrick's Day"),
      this.getEasterSunday(year),
      nthWeekday(4, 0, 2, "Mother's Day"), // 2nd Sunday May
      nthWeekday(5, 0, 3, "Father's Day"), // 3rd Sunday Jun
      fixed(9, 31, 'Halloween'),
      this.getElectionDay(year),
      fixed(11, 24, 'Christmas Eve'),
      fixed(11, 31, "New Year's Eve")
    ].filter(Boolean);
  }

  getEasterSunday(year) {
    // Anonymous Gregorian algorithm
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { name: 'Easter Sunday', date: new Date(year, month - 1, day) };
  }

  getElectionDay(year) {
    // First Tuesday after the first Monday in November
    const nov1 = new Date(year, 10, 1);
    const firstMondayOffset = (1 - nov1.getDay() + 7) % 7;
    const firstMonday = new Date(year, 10, 1 + firstMondayOffset);
    const firstTuesdayAfter = new Date(firstMonday);
    firstTuesdayAfter.setDate(firstMonday.getDate() + 1);
    return { name: 'Election Day (US)', date: firstTuesdayAfter };
  }
}

// Initialize the calendar
const calendar = new Calendar();
