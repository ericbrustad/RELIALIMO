const STORAGE_SETTINGS_KEY = 'emailSettingsConfig';
const STORAGE_TEMPLATES_KEY = 'emailTemplates';

const tripTags = [
  '#COMP_NAME#',
  '#TRIP_CONFNUM#',
  '#TRIP_PAX_NAME#',
  '#TRIP_DATE#',
  '#TRIP_TIME#',
  '#TRIP_PICKUP#',
  '#TRIP_DROPOFF#',
  '#TRIP_DRIVER1_FNAME#',
  '#TRIP_VEHICLE_TYPE#',
  '#TRIP_BC_EMAIL1#'
];

const rateTags = [
  '#TRIP_RATES_TOTAL#',
  '#TRIP_RATES_TOTALDUE#',
  '#TRIP_RATES_SUMMARY#',
  '#TRIP_RATES_ITEMIZED#',
  '#TRIP_RATES_GROUPED#',
  '#TRIP_RATES_BASE_TOTAL#',
  '#TRIP_RATES_GRATUITIES_TOTAL#',
  '#TRIP_RATES_TAXES_TOTAL#',
  '#TRIP_RATES_SURCHARGES_TOTAL#',
  '#TRIP_RATES_DISCOUNTS_TOTAL#'
];

function $(id) { return document.getElementById(id); }

function loadSettings() {
  const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
  if (!raw) return;
  try {
    const cfg = JSON.parse(raw);
    $('fromNameInput').value = cfg.fromName || '';
    $('fromEmailInput').value = cfg.fromEmail || '';
    $('replyToInput').value = cfg.replyTo || '';
    $('smtpHostInput').value = cfg.smtpHost || '';
    $('smtpPortInput').value = cfg.smtpPort || '';
    $('smtpUserInput').value = cfg.smtpUser || '';
    $('smtpPassInput').value = cfg.smtpPass || '';
    $('tlsInput').checked = !!cfg.tls;
  } catch (e) {}
}

function saveSettings() {
  const cfg = {
    fromName: $('fromNameInput').value.trim(),
    fromEmail: $('fromEmailInput').value.trim(),
    replyTo: $('replyToInput').value.trim(),
    smtpHost: $('smtpHostInput').value.trim(),
    smtpPort: $('smtpPortInput').value.trim(),
    smtpUser: $('smtpUserInput').value.trim(),
    smtpPass: $('smtpPassInput').value,
    tls: $('tlsInput').checked
  };
  localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(cfg));
  alert('Email settings saved locally. Connect to your backend to send for real.');
}

function initTagSelects() {
  const tripSelect = $('tripTagSelect');
  tripTags.forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag; opt.textContent = tag; tripSelect.appendChild(opt);
  });
  const rateSelect = $('rateTagSelect');
  rateTags.forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag; opt.textContent = tag; rateSelect.appendChild(opt);
  });

  tripSelect.addEventListener('change', () => insertTag(tripSelect.value));
  rateSelect.addEventListener('change', () => insertTag(rateSelect.value));
}

function insertTag(tag) {
  if (!tag) return;
  const editor = $('templateEditor');
  editor.focus();
  document.execCommand('insertText', false, tag);
  $('tripTagSelect').value = '';
  $('rateTagSelect').value = '';
}

function setupToolbar() {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (!cmd) return;
      document.execCommand(cmd, false, null);
    });
  });
}

function loadTemplates() {
  const raw = localStorage.getItem(STORAGE_TEMPLATES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}

function saveTemplates(list) {
  localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(list));
}

function renderTemplateList() {
  const container = $('templateList');
  const templates = loadTemplates();
  container.innerHTML = '';
  if (!templates.length) {
    container.innerHTML = '<div class="hint">No templates saved yet.</div>';
    return;
  }
  templates.forEach(tpl => {
    const row = document.createElement('div');
    row.className = 'template-row';
    row.innerHTML = `
      <div class="meta">
        <strong>${tpl.name}</strong>
        <span style="color:#607d8b; font-size:12px;">${tpl.subject || 'No subject'}</span>
      </div>
      <div class="actions">
        <button class="btn small" data-action="load" data-id="${tpl.id}">Load</button>
        <button class="btn small" data-action="delete" data-id="${tpl.id}" style="background:#c62828; color:#fff;">Delete</button>
      </div>`;
    container.appendChild(row);
  });

  container.querySelectorAll('[data-action="load"]').forEach(btn => {
    btn.addEventListener('click', () => loadTemplate(btn.dataset.id));
  });
  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => deleteTemplate(btn.dataset.id));
  });
}

function saveTemplate() {
  const name = $('templateNameInput').value.trim();
  if (!name) { alert('Enter a template name.'); return; }
  const subject = $('subjectInput').value.trim();
  const html = $('templateEditor').innerHTML;

  const templates = loadTemplates();
  const existingIdx = templates.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
  const record = {
    id: existingIdx >= 0 ? templates[existingIdx].id : crypto.randomUUID(),
    name,
    subject,
    html,
    updatedAt: new Date().toISOString()
  };
  if (existingIdx >= 0) templates[existingIdx] = record; else templates.push(record);
  saveTemplates(templates);
  renderTemplateList();
  alert('Template saved locally.');
}

function loadTemplate(id) {
  const templates = loadTemplates();
  const tpl = templates.find(t => t.id === id);
  if (!tpl) return;
  $('templateNameInput').value = tpl.name;
  $('subjectInput').value = tpl.subject || '';
  $('templateEditor').innerHTML = tpl.html || '';
}

function deleteTemplate(id) {
  let templates = loadTemplates();
  templates = templates.filter(t => t.id !== id);
  saveTemplates(templates);
  renderTemplateList();
}

function renderTagReference() {
  const tripList = $('tripTagList');
  tripTags.forEach(tag => {
    const li = document.createElement('li');
    li.textContent = tag;
    tripList.appendChild(li);
  });
  const rateList = $('rateTagList');
  rateTags.forEach(tag => {
    const li = document.createElement('li');
    li.textContent = tag;
    rateList.appendChild(li);
  });
}

function testSendLocal() {
  const to = prompt('Test send to email (this is local-only):');
  if (!to) return;
  alert(`This is a local-only preview. Wire backend SMTP/SendGrid/SES to actually send.\n\nTo: ${to}\nSubject: ${$('subjectInput').value || '(no subject)'}\nBody length: ${$('templateEditor').innerHTML.length} chars`);
}

function initEmailSettings() {
  loadSettings();
  initTagSelects();
  setupToolbar();
  renderTagReference();
  renderTemplateList();

  $('saveSettingsBtn').addEventListener('click', saveSettings);
  $('saveTemplateBtn').addEventListener('click', saveTemplate);
  $('testSendBtn').addEventListener('click', testSendLocal);
}

document.addEventListener('DOMContentLoaded', initEmailSettings);
