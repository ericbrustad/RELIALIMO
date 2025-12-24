const STATUS_OPTIONS = [
  { value: 'available', label: 'Available', hint: 'Ready for new trips' },
  { value: 'enroute', label: 'En Route', hint: 'Heading to the pickup location' },
  { value: 'arrived', label: 'Arrived', hint: 'Waiting at pickup location' },
  { value: 'passenger_onboard', label: 'Passenger On Board', hint: 'Passenger loaded, en route to drop-off' },
  { value: 'busy', label: 'Busy', hint: 'Unavailable or on another job' },
  { value: 'offline', label: 'Offline', hint: 'Off shift / not taking trips' }
];

const DRIVERS = [
  { id: 1, name: 'Mike Driver', vehicle: 'Sedan', affiliate: 'RELIA Fleet', phone: '(555) 200-1001' },
  { id: 2, name: 'Lisa Driver', vehicle: 'SUV Limousine', affiliate: 'RELIA Fleet', phone: '(555) 200-1002' },
  { id: 3, name: 'Tom Driver', vehicle: 'Stretch Limousine', affiliate: 'RELIA Fleet', phone: '(555) 200-1003' },
  { id: 4, name: 'Sarah Driver', vehicle: 'Luxury Sedan', affiliate: 'RELIA Fleet', phone: '(555) 200-1004' },
  { id: 5, name: 'John Driver', vehicle: 'SUV', affiliate: 'RELIA Fleet', phone: '(555) 200-1005' }
];

let overrides = [];

const driverGrid = document.getElementById('driverGrid');
const lastSyncEl = document.getElementById('lastSync');
const resetBtn = document.getElementById('resetOverrides');
const refreshBtn = document.getElementById('refreshView');
const toastEl = document.getElementById('toast');

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadOverrides() {
  try {
    const raw = localStorage.getItem('relia_driver_status_overrides');
    if (!raw) {
      overrides = [];
      return;
    }

    const parsed = JSON.parse(raw);
    overrides = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Unable to parse driver overrides:', error);
    overrides = [];
  }
}

function findOverride(driverId) {
  return overrides.find(item => item && Number(item.id) === Number(driverId));
}

function getDriverState(driverId) {
  const override = findOverride(driverId);
  return {
    status: override?.status || 'available',
    notes: override?.notes || ''
  };
}

function renderDrivers() {
  if (!driverGrid) {
    return;
  }

  const cards = DRIVERS.map(driver => {
    const state = getDriverState(driver.id);
    const statusInfo = STATUS_OPTIONS.find(option => option.value === state.status) || STATUS_OPTIONS[0];
    const statusOptionsMarkup = STATUS_OPTIONS.map(option => {
      const selected = option.value === state.status ? 'selected' : '';
      return `<option value="${option.value}" ${selected}>${option.label}</option>`;
    }).join('');

    return `
      <article class="driver-card" data-driver-id="${driver.id}">
        <div class="driver-header">
          <span class="driver-name">${escapeHtml(driver.name)}</span>
          <span class="driver-meta">${escapeHtml(driver.vehicle)} • ${escapeHtml(driver.affiliate)}</span>
          <span class="driver-meta">${escapeHtml(driver.phone)}</span>
          <span class="status-pill ${statusInfo.value}">${statusInfo.label}</span>
          <span class="status-hint">${statusInfo.hint}</span>
        </div>
        <div class="driver-control">
          <label for="status-${driver.id}" class="driver-meta">Current status</label>
          <select id="status-${driver.id}" class="status-select" data-driver-id="${driver.id}">
            ${statusOptionsMarkup}
          </select>
        </div>
        <div class="driver-control">
          <label for="notes-${driver.id}" class="driver-meta">Notes to dispatch</label>
          <textarea id="notes-${driver.id}" class="notes-input" data-driver-id="${driver.id}" placeholder="Availability details, time back, etc.">${escapeHtml(state.notes)}</textarea>
        </div>
      </article>
    `;
  }).join('');

  driverGrid.innerHTML = cards;
  bindCardEvents();
}

function bindCardEvents() {
  document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', (event) => {
      const driverId = Number(event.target.dataset.driverId);
      const status = event.target.value;
      updateOverride(driverId, { status });
      showToast('Status updated.');
    });
  });

  document.querySelectorAll('.notes-input').forEach(textarea => {
    textarea.addEventListener('blur', (event) => {
      const driverId = Number(event.target.dataset.driverId);
      const notes = event.target.value;
      updateOverride(driverId, { notes });
    });
  });
}

function updateOverride(driverId, changes) {
  if (!driverId) return;

  let override = findOverride(driverId);
  if (!override) {
    override = { id: driverId };
    overrides.push(override);
  }

  Object.assign(override, changes || {});
  override.updatedAt = new Date().toISOString();
  saveOverrides();
  renderDrivers();
}

function saveOverrides() {
  try {
    localStorage.setItem('relia_driver_status_overrides', JSON.stringify(overrides));
    localStorage.setItem('relia_driver_status_overrides_timestamp', Date.now().toString());
    updateLastSync();
  } catch (error) {
    console.warn('Unable to persist overrides:', error);
  }
}

function resetOverrides() {
  overrides = [];
  saveOverrides();
  renderDrivers();
  showToast('All statuses reset.');
}

function refreshFromStorage() {
  loadOverrides();
  renderDrivers();
  showToast('Availability refreshed.');
}

function updateLastSync() {
  if (!lastSyncEl) return;
  const timestamps = overrides
    .map(item => item?.updatedAt)
    .filter(Boolean)
    .map(value => Date.parse(value))
    .filter(value => !Number.isNaN(value));

  if (!timestamps.length) {
    const raw = localStorage.getItem('relia_driver_status_overrides_timestamp');
    const fallback = raw ? Number(raw) : 0;
    if (!fallback || Number.isNaN(fallback)) {
      lastSyncEl.textContent = 'Last sync: Never';
      return;
    }
    lastSyncEl.textContent = `Last sync: ${new Date(fallback).toLocaleString()}`;
    return;
  }

  const latest = new Date(Math.max(...timestamps));
  lastSyncEl.textContent = `Last sync: ${latest.toLocaleString()}`;
}

let toastTimer = null;
function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('visible');
    toastEl.classList.add('hidden');
  }, 2000);
}

function init() {
  loadOverrides();
  renderDrivers();
  updateLastSync();

  if (resetBtn) {
    resetBtn.addEventListener('click', resetOverrides);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshFromStorage);
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'relia_driver_status_overrides' || event.key === 'relia_driver_status_overrides_timestamp') {
      loadOverrides();
      renderDrivers();
      updateLastSync();
      showToast('Availability synced.');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
