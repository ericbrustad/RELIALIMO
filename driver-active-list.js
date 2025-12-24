const DRIVERS = [
  { id: 1, name: 'Mike Driver', vehicle: 'Sedan', affiliate: 'RELIA Fleet', phone: '(555) 200-1001' },
  { id: 2, name: 'Lisa Driver', vehicle: 'SUV Limousine', affiliate: 'RELIA Fleet', phone: '(555) 200-1002' },
  { id: 3, name: 'Tom Driver', vehicle: 'Stretch Limousine', affiliate: 'RELIA Fleet', phone: '(555) 200-1003' },
  { id: 4, name: 'Sarah Driver', vehicle: 'Luxury Sedan', affiliate: 'RELIA Fleet', phone: '(555) 200-1004' },
  { id: 5, name: 'John Driver', vehicle: 'SUV', affiliate: 'RELIA Fleet', phone: '(555) 200-1005' }
];

const STATUS_LABELS = {
  available: 'Available',
  offline: 'Offline'
};

const availableList = document.getElementById('availableList');
const offlineList = document.getElementById('offlineList');
const availableCount = document.getElementById('availableCount');
const offlineCount = document.getElementById('offlineCount');
const lastSync = document.getElementById('lastSync');
const refreshBtn = document.getElementById('refreshBtn');
const toastEl = document.getElementById('toast');

let overrides = [];
let toastTimer = null;

function escapeHtml(value = '') {
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadOverrides() {
  try {
    const raw = localStorage.getItem('relia_driver_status_overrides');
    overrides = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(overrides)) {
      overrides = [];
    }
  } catch (error) {
    console.warn('Unable to parse driver overrides:', error);
    overrides = [];
  }
}

function getDriverState(driver) {
  const override = overrides.find(item => Number(item?.id) === Number(driver.id));
  return {
    status: override?.status || 'available',
    notes: override?.notes || ''
  };
}

function renderLists() {
  const availableDrivers = [];
  const offlineDrivers = [];

  DRIVERS.forEach(driver => {
    const state = getDriverState(driver);
    if (state.status === 'available') {
      availableDrivers.push({ driver, state });
    } else if (state.status === 'offline') {
      offlineDrivers.push({ driver, state });
    }
  });

  const renderCard = ({ driver, state }) => `
    <article class="driver-card">
      <span class="name">${escapeHtml(driver.name)}</span>
      <span class="meta">${escapeHtml(driver.vehicle)} • ${escapeHtml(driver.affiliate)}</span>
      <span class="meta">${escapeHtml(driver.phone)}</span>
      <span class="status ${escapeHtml(state.status)}">${STATUS_LABELS[state.status] || 'Status Unknown'}</span>
      ${state.notes ? `<div class="notes">${escapeHtml(state.notes)}</div>` : ''}
    </article>
  `;

  availableList.innerHTML = availableDrivers.length
    ? availableDrivers.map(renderCard).join('')
    : '<p class="meta">No drivers are currently marked available.</p>';

  offlineList.innerHTML = offlineDrivers.length
    ? offlineDrivers.map(renderCard).join('')
    : '<p class="meta">No drivers are marked offline.</p>';

  availableCount.textContent = availableDrivers.length;
  offlineCount.textContent = offlineDrivers.length;
}

function updateLastSync() {
  if (!lastSync) return;
  const timestamps = overrides
    .map(item => item?.updatedAt)
    .filter(Boolean)
    .map(value => Date.parse(value))
    .filter(value => !Number.isNaN(value));

  if (!timestamps.length) {
    lastSync.textContent = 'Last sync: Never';
    return;
  }

  const latest = new Date(Math.max(...timestamps));
  lastSync.textContent = `Last sync: ${latest.toLocaleString()}`;
}

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

function refresh() {
  loadOverrides();
  renderLists();
  updateLastSync();
  showToast('Driver list refreshed.');
}

function init() {
  loadOverrides();
  renderLists();
  updateLastSync();

  if (refreshBtn) {
    refreshBtn.addEventListener('click', refresh);
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'relia_driver_status_overrides' || event.key === 'relia_driver_status_overrides_timestamp') {
      loadOverrides();
      renderLists();
      updateLastSync();
      showToast('Driver availability updated.');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
