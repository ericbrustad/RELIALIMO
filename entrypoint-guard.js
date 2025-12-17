const FILE_TO_SECTION = {
  'my-office.html': 'office',
  'accounts.html': 'accounts',
  'quotes.html': 'quotes',
  'calendar.html': 'calendar',
  'reservations-list.html': 'reservations',
  'dispatch-grid.html': 'dispatch',
  'network.html': 'network',
  'settle.html': 'settle',
  'receivables.html': 'receivables',
  'payables.html': 'payables',
  'memos.html': 'memos',
  'files.html': 'files',
  'tools.html': 'tools',
  'reports.html': 'reports',
  'index-reservations.html': 'dashboard',
  'reservation-form.html': 'new-reservation'
};

function getCurrentFileName() {
  const p = String(window.location.pathname || '');
  const parts = p.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || '';
  return last || 'index.html';
}

(function enforceIndexEntrypoint() {
  // If we are inside the index iframe shell, do nothing.
  if (window.self !== window.top) return;

  const params = new URLSearchParams(window.location.search);
  const allowStandalone = params.get('standalone') === '1';
  if (allowStandalone) return;

  const file = getCurrentFileName().toLowerCase();
  if (file === '' || file === 'index.html') return;

  const section = FILE_TO_SECTION[file];
  if (!section) return;

  const relativeUrl = file + (window.location.search || '') + (window.location.hash || '');
  const target = `index.html?section=${encodeURIComponent(section)}&url=${encodeURIComponent(relativeUrl)}`;
  window.location.replace(target);
})();
