const SECTION_ROUTES = {
  dashboard: 'index-reservations.html',
  office: 'my-office.html',
  accounts: 'accounts.html',
  quotes: 'quotes.html',
  calendar: 'calendar.html',
  'new-reservation': 'reservation-form.html',
  reservations: 'reservations-list.html',
  dispatch: 'dispatch-grid.html',
  network: 'network.html',
  settle: 'settle.html',
  receivables: 'receivables.html',
  payables: 'payables.html',
  memos: 'memos.html',
  files: 'files.html',
  tools: 'tools.html',
  reports: 'reports.html'
};

export function getRouteForSection(section) {
  return SECTION_ROUTES[section] || null;
}

export function navigateToSection(section, options = {}) {
  const route = getRouteForSection(section);
  if (!route) {
    alert(`${section} section not available`);
    return false;
  }

  const urlOverride = typeof options?.url === 'string' ? options.url : null;
  const targetUrl = urlOverride || route;

  // Index-only entrypoint:
  // - If inside an iframe, ask the parent shell to switch sections.
  // - If standalone, route back to index.html and load this page inside the correct iframe.
  if (window.self !== window.top) {
    window.parent.postMessage({ action: 'switchSection', section, url: urlOverride || undefined }, '*');
    return true;
  }

  const currentFile = String(window.location.pathname || '').split(/[\\/]/).pop()?.toLowerCase() || '';
  if (currentFile === 'index.html' || currentFile === '') {
    // If index.html defines switchMainSection, use it. Otherwise fall back to query routing.
    if (typeof window.switchMainSection === 'function') {
      if (urlOverride) {
        const frame = document.querySelector(`#${CSS.escape(section)}Section iframe`);
        if (frame) frame.src = urlOverride;
      }
      window.switchMainSection(section);
      return true;
    }
    window.location.href = `index.html?section=${encodeURIComponent(section)}`;
    return true;
  }

  // Avoid exposing a free-form target URL in the address bar.
  // If a specific iframe URL is needed, hand it off via sessionStorage and let index.html validate it.
  if (urlOverride) {
    try {
      sessionStorage.setItem('relia_nav_override', JSON.stringify({
        section,
        url: urlOverride,
        ts: Date.now()
      }));
    } catch {
      // ignore
    }
  }

  window.location.href = `index.html?section=${encodeURIComponent(section)}`;
  return true;
}

export function wireMainNav(root = document) {
  const buttons = root.querySelectorAll('.nav-btn[data-section]');
  buttons.forEach(btn => {
    if (btn.dataset.navWired === '1') return;
    btn.dataset.navWired = '1';

    btn.addEventListener('click', (e) => {
      const button = e.target.closest('.nav-btn');
      const section = button?.dataset?.section;
      if (!section) return;
      navigateToSection(section);
    });
  });
}
