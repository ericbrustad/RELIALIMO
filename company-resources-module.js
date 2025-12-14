// Company Resources Module - Integrated into My Office
// Full CRUD system for Drivers, Airlines, Airports, Fleet, etc.

export class CompanyResourcesManager {
  constructor() {
    this.currentSection = 'drivers';
    this.editingId = null;
    this.showAll = false;
    this.container = null;
    this.els = {};
  }

  /**
   * Initialize the Company Resources module
   * Should be called when the Company Resources tab is activated
   */
  init(containerSelector) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      console.error('Company Resources container not found:', containerSelector);
      return;
    }
    console.log('Company Resources container found:', this.container);

    this.buildUI();
    console.log('UI built');
    
    this.cacheElements();
    console.log('Elements cached:', this.els);
    
    // Verify critical elements exist
    if (!this.els.centerTitle) {
      console.error('Critical element centerTitle not found after caching');
      return;
    }
    
    this.setupEventListeners();
    console.log('Event listeners set up');
    
    this.switchSection('drivers');
    console.log('Switched to drivers section');
  }

  buildUI() {
    this.container.innerHTML = `
      <div class="company-resources-container">
        <!-- Left: Navigation -->
        <div class="cr-left-panel" id="crLeftPanel">
          <button class="cr-left-btn active" data-section="drivers">Drivers</button>
          <button class="cr-left-btn" data-section="affiliates">Affiliates</button>
          <button class="cr-left-btn" data-section="agents">Agents</button>
          <button class="cr-left-btn" data-section="vehicle-types">Vehicle Types</button>
          <button class="cr-left-btn" data-section="fleet">Fleet</button>
          <button class="cr-left-btn" data-section="airports">Airports</button>
          <button class="cr-left-btn" data-section="airlines">Airlines</button>
          <button class="cr-left-btn" data-section="fbo">Private Airlines (FBO)</button>
          <button class="cr-left-btn" data-section="seaports">Seaports</button>
          <button class="cr-left-btn" data-section="poi">Points of Interest</button>
        </div>

        <!-- Center: List -->
        <div class="cr-center-panel">
          <div class="cr-center-header">
            <div class="cr-center-title" id="crCenterTitle">Drivers</div>
            <label class="cr-show-all">
              <input type="checkbox" id="crShowAll" />
              <span>Show All</span>
            </label>
          </div>
          <div class="cr-list-wrapper">
            <select class="cr-listbox" id="crListbox" size="20"></select>
            <div class="cr-table-wrapper" id="crTableWrapper">
              <table class="cr-table">
                <thead id="crTableHead"></thead>
                <tbody id="crTableBody"></tbody>
              </table>
            </div>
          </div>
          <div class="cr-center-footer">
            <button class="cr-btn" id="crEditBtn">EDIT</button>
            <button class="cr-btn" id="crDeleteBtn">DELETE</button>
          </div>
        </div>

        <!-- Right: Form -->
        <div class="cr-right-panel">
          <div class="cr-form-header" id="crFormHeader">Add New Driver</div>
          <div class="cr-form-content" id="crFormContent"></div>
          <div class="cr-form-footer">
            <button class="cr-btn" id="crAddNewBtn">ADD NEW</button>
            <button class="cr-btn" id="crSaveBtn" style="display: none;">SAVE</button>
            <button class="cr-btn" id="crCancelBtn" style="display: none;">CANCEL</button>
          </div>
        </div>
      </div>
    `;
  }

  cacheElements() {
    this.els = {
      leftBtns: Array.from(this.container.querySelectorAll('.cr-left-btn')),
      centerTitle: this.container.querySelector('#crCenterTitle'),
      showAll: this.container.querySelector('#crShowAll'),
      listbox: this.container.querySelector('#crListbox'),
      tableWrapper: this.container.querySelector('#crTableWrapper'),
      tableHead: this.container.querySelector('#crTableHead'),
      tableBody: this.container.querySelector('#crTableBody'),
      formHeader: this.container.querySelector('#crFormHeader'),
      formContent: this.container.querySelector('#crFormContent'),
      editBtn: this.container.querySelector('#crEditBtn'),
      deleteBtn: this.container.querySelector('#crDeleteBtn'),
      addNewBtn: this.container.querySelector('#crAddNewBtn'),
      saveBtn: this.container.querySelector('#crSaveBtn'),
      cancelBtn: this.container.querySelector('#crCancelBtn'),
    };
  }

  setupEventListeners() {
    // Left navigation
    this.els.leftBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        this.switchSection(section);
      });
    });

    // Center buttons
    this.els.editBtn.addEventListener('click', () => this.startEdit());
    this.els.deleteBtn.addEventListener('click', () => this.doDelete());
    this.els.showAll.addEventListener('change', () => this.handleShowAll());

    // Right buttons
    this.els.addNewBtn.addEventListener('click', () => this.doAdd());
    this.els.saveBtn.addEventListener('click', () => this.doSave());
    this.els.cancelBtn.addEventListener('click', () => this.startAdd());

    // Listbox selection
    this.els.listbox.addEventListener('change', () => {
      this.els.tableBody.querySelectorAll('tr').forEach(tr => tr.classList.remove('selected'));
    });
  }

  switchSection(sectionKey) {
    this.currentSection = sectionKey;
    this.editingId = null;
    this.showAll = false;
    this.els.showAll.checked = false;

    // Update left nav active state
    this.els.leftBtns.forEach(btn => btn.classList.remove('active'));
    this.container.querySelector(`[data-section="${sectionKey}"]`).classList.add('active');

    // Render center and right
    this.renderCenter();
    this.setFormMode('add');
    this.renderForm(null);
  }

  renderCenter() {
    const config = this.getSectionConfig(this.currentSection);
    const isTable = config.listType === 'table';
    const isContainer = config.listType === 'container';

    this.els.centerTitle.textContent = config.title;
    this.els.listbox.style.display = (isTable || isContainer) ? 'none' : 'block';
    this.els.tableWrapper.style.display = (isTable || isContainer) ? 'block' : 'none';

    const items = this.loadItems();

    if (isTable) {
      this.renderTable(config, items);
    } else if (isContainer) {
      this.renderContainer(config, items);
    } else {
      this.renderListbox(config, items);
    }

    // Update button label
    this.els.editBtn.textContent = `EDIT ${config.title.split(' ')[0].toUpperCase()}`;
  }

  renderListbox(config, items) {
    this.els.listbox.innerHTML = '';
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = config.listLabel(item);
      this.els.listbox.appendChild(opt);
    });
  }

  renderTable(config, items) {
    const cols = config.tableColumns || ['name'];

    // Build header
    this.els.tableHead.innerHTML = '';
    const headerRow = document.createElement('tr');
    cols.forEach(col => {
      const th = document.createElement('th');
      th.textContent = this.humanizeLabel(col);
      headerRow.appendChild(th);
    });
    this.els.tableHead.appendChild(headerRow);

    // Build body
    this.els.tableBody.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('tr');
      row.dataset.id = item.id;
      cols.forEach(col => {
        const td = document.createElement('td');
        td.textContent = item[col] || '';
        row.appendChild(td);
      });
      row.addEventListener('click', () => {
        this.els.tableBody.querySelectorAll('tr').forEach(tr => tr.classList.remove('selected'));
        row.classList.add('selected');
        this.els.tableBody.dataset.selectedId = item.id;
      });
      this.els.tableBody.appendChild(row);
    });
  }

  renderContainer(config, items) {
    const cols = config.tableColumns || ['name'];
    
    // Create grid container instead of table
    this.els.tableHead.innerHTML = '';
    this.els.tableBody.innerHTML = '';
    
    const containerDiv = document.createElement('div');
    containerDiv.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; padding: 12px;';
    
    items.forEach(item => {
      const card = document.createElement('div');
      card.style.cssText = 'border: 1px solid #d0d0d0; border-radius: 4px; padding: 12px; background: #fff; cursor: pointer; transition: background 0.2s;';
      card.dataset.id = item.id;
      
      let content = '';
      cols.forEach(col => {
        content += `<div style="font-size: 12px; margin-bottom: 4px;"><strong>${this.humanizeLabel(col)}:</strong> ${item[col] || ''}</div>`;
      });
      
      card.innerHTML = content;
      
      card.addEventListener('click', () => {
        containerDiv.querySelectorAll('div[data-id]').forEach(c => {
          c.style.background = '#fff';
          c.style.borderColor = '#d0d0d0';
        });
        card.style.background = '#e3f2fd';
        card.style.borderColor = '#2196f3';
        this.els.tableBody.dataset.selectedId = item.id;
      });
      
      card.addEventListener('mouseover', () => {
        if (card.dataset.id !== this.els.tableBody.dataset.selectedId) {
          card.style.background = '#f5f5f5';
        }
      });
      
      card.addEventListener('mouseout', () => {
        if (card.dataset.id !== this.els.tableBody.dataset.selectedId) {
          card.style.background = '#fff';
        }
      });
      
      containerDiv.appendChild(card);
    });
    
    this.els.tableBody.appendChild(containerDiv);
  }

  renderForm(item) {
    const config = this.getSectionConfig(this.currentSection);
    this.els.formHeader.textContent = config.formTitle(this.editingId ? 'edit' : 'add');
    this.els.formContent.innerHTML = '';

    config.blocks.forEach(block => {
      const blockEl = document.createElement('div');
      blockEl.className = 'cr-block';

      const headerEl = document.createElement('div');
      headerEl.className = 'cr-block-header';
      headerEl.textContent = block.head;
      blockEl.appendChild(headerEl);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'cr-block-body';

      const gridEl = document.createElement('div');
      gridEl.className = `cr-grid-${block.columns || 2}`;

      block.fields.forEach(field => {
        const val = item?.[field.id] ?? config.defaults?.[field.id];
        gridEl.appendChild(this.createFieldEl(field, val));
      });

      bodyEl.appendChild(gridEl);
      blockEl.appendChild(bodyEl);
      this.els.formContent.appendChild(blockEl);
    });
  }

  createFieldEl(field, value) {
    const wrap = document.createElement('div');
    wrap.className = 'cr-field' + (field.span ? ` cr-span-${field.span}` : '');

    if (field.type === 'checkbox') {
      const checkLine = document.createElement('div');
      checkLine.className = 'cr-checkbox-line';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `field_${field.id}`;
      input.checked = value === true;
      const label = document.createElement('label');
      label.htmlFor = `field_${field.id}`;
      label.textContent = field.label;
      checkLine.appendChild(input);
      checkLine.appendChild(label);
      wrap.appendChild(checkLine);
    } else {
      const label = document.createElement('label');
      label.textContent = field.label;
      wrap.appendChild(label);

      let input;
      if (field.type === 'textarea') {
        input = document.createElement('textarea');
      } else if (field.type === 'select') {
        input = document.createElement('select');
        const opts = field.options || [];
        opts.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          input.appendChild(option);
        });
      } else {
        input = document.createElement('input');
        input.type = field.type || 'text';
      }

      input.id = `field_${field.id}`;
      input.value = value || '';
      wrap.appendChild(input);
    }

    return wrap;
  }

  humanizeLabel(str) {
    return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  getSectionConfig(section) {
    const configs = {
      drivers: {
        title: 'Drivers',
        listType: 'table',
        tableColumns: ['first_name', 'last_name', 'phone'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Driver' : 'Add New Driver',
        listLabel: (x) => `${x.first_name || ''} ${x.last_name || ''}`.trim(),
        blocks: [
          {
            head: 'Driver Information',
            columns: 2,
            fields: [
              { id: 'first_name', label: 'First Name', type: 'text' },
              { id: 'last_name', label: 'Last Name', type: 'text' },
              { id: 'phone', label: 'Phone', type: 'tel' },
            ],
          },
        ],
        defaults: {},
        storageKey: 'cr_drivers',
      },
      affiliates: {
        title: 'Affiliates',
        listType: 'table',
        tableColumns: ['name', 'phone'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Affiliate' : 'Add New Affiliate',
        listLabel: (x) => x.name || '',
        blocks: [{ head: 'Affiliate Info', columns: 2, fields: [{ id: 'name', label: 'Name', type: 'text' }, { id: 'phone', label: 'Phone', type: 'tel' }] }],
        defaults: {},
        storageKey: 'cr_affiliates',
      },
      agents: {
        title: 'Agents',
        listType: 'table',
        tableColumns: ['name', 'phone'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Agent' : 'Add New Agent',
        listLabel: (x) => x.name || '',
        blocks: [{ head: 'Agent Info', columns: 2, fields: [{ id: 'name', label: 'Name', type: 'text' }, { id: 'phone', label: 'Phone', type: 'tel' }] }],
        defaults: {},
        storageKey: 'cr_agents',
      },
      'vehicle-types': {
        title: 'Vehicle Types',
        listType: 'table',
        tableColumns: ['name'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Vehicle Type' : 'Add New Vehicle Type',
        listLabel: (x) => x.name || '',
        blocks: [{ head: 'Vehicle Type', columns: 1, fields: [{ id: 'name', label: 'Name', type: 'text' }] }],
        defaults: {},
        storageKey: 'cr_vehicle_types',
      },
      fleet: {
        title: 'Fleet',
        listType: 'table',
        tableColumns: ['plate', 'type'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Vehicle' : 'Add New Vehicle',
        listLabel: (x) => x.plate || '',
        blocks: [{ head: 'Fleet Info', columns: 2, fields: [{ id: 'plate', label: 'License Plate', type: 'text' }, { id: 'type', label: 'Type', type: 'text' }] }],
        defaults: {},
        storageKey: 'cr_fleet',
      },
      airports: {
        title: 'Airports',
        listType: 'container',
        tableColumns: ['code', 'name'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Airport' : 'Add New Airport',
        listLabel: (x) => `${x.code || ''} - ${x.name || ''}`,
        blocks: [{ head: 'Airport', columns: 2, fields: [{ id: 'code', label: 'Code', type: 'text' }, { id: 'name', label: 'Name', type: 'text' }] }],
        defaults: {},
        storageKey: 'cr_airports',
      },
      airlines: {
        title: 'Airlines',
        listType: 'container',
        tableColumns: ['code', 'name'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Airline' : 'Add New Airline',
        listLabel: (x) => `${x.code || ''} - ${x.name || ''}`,
        blocks: [{ head: 'Airline', columns: 2, fields: [{ id: 'code', label: 'Code', type: 'text' }, { id: 'name', label: 'Name', type: 'text' }] }],
        defaults: {},
        storageKey: 'cr_airlines',
      },
      fbo: {
        title: 'Private Airlines (FBO)',
        listType: 'table',
        tableColumns: ['name'],
        formTitle: (mode) => mode === 'edit' ? 'Edit FBO' : 'Add New FBO',
        listLabel: (x) => x.name || '',
        blocks: [{ head: 'FBO', columns: 1, fields: [{ id: 'name', label: 'Name', type: 'text' }] }],
        defaults: {},
        storageKey: 'cr_fbo',
      },
      seaports: {
        title: 'Seaports',
        listType: 'table',
        tableColumns: ['name'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Seaport' : 'Add New Seaport',
        listLabel: (x) => x.name || '',
        blocks: [{ head: 'Seaport', columns: 1, fields: [{ id: 'name', label: 'Name', type: 'text' }] }],
        defaults: {},
        storageKey: 'cr_seaports',
      },
      poi: {
        title: 'Points of Interest',
        listType: 'table',
        tableColumns: ['name'],
        formTitle: (mode) => mode === 'edit' ? 'Edit POI' : 'Add New POI',
        listLabel: (x) => x.name || '',
        blocks: [{ head: 'POI', columns: 1, fields: [{ id: 'name', label: 'Name', type: 'text' }] }],
        defaults: {},
        storageKey: 'cr_poi',
      },
    };
    return configs[section] || configs.drivers;
  }

  startEdit() {
    const selectedId = this.els.tableBody.dataset.selectedId;
    if (!selectedId) {
      alert('Please select an item to edit');
      return;
    }
    this.editingId = selectedId;
    const items = this.loadItems();
    const item = items.find(i => i.id === selectedId);
    if (item) {
      this.renderForm(item);
      this.setFormMode('edit');
    }
  }

  doDelete() {
    const selectedId = this.els.tableBody.dataset.selectedId || this.editingId;
    if (!selectedId) {
      alert('Please select an item to delete');
      return;
    }
    if (!confirm('Delete this item?')) return;
    let items = this.loadItems();
    items = items.filter(i => i.id !== selectedId);
    this.saveItems(items);
    this.editingId = null;
    this.els.tableBody.dataset.selectedId = null;
    this.renderCenter();
    this.setFormMode('add');
    this.renderForm(null);
  }

  doAdd() {
    this.setFormMode('add');
  }

  doSave() {
    const config = this.getSectionConfig(this.currentSection);
    const newItem = { id: this.editingId || this.uid() };
    config.blocks.forEach(block => {
      block.fields.forEach(field => {
        const el = document.getElementById(`field_${field.id}`);
        if (el) {
          newItem[field.id] = field.type === 'checkbox' ? el.checked : el.value;
        }
      });
    });

    let items = this.loadItems();
    if (this.editingId) {
      const idx = items.findIndex(i => i.id === this.editingId);
      if (idx >= 0) items[idx] = newItem;
    } else {
      items.push(newItem);
    }
    this.saveItems(items);
    this.editingId = null;
    this.renderCenter();
    this.setFormMode('add');
    this.renderForm(null);
  }

  handleShowAll() {
    this.showAll = this.els.showAll.checked;
    this.renderCenter();
  }

  setFormMode(mode) {
    const isAdd = mode === 'add';
    this.els.addNewBtn.style.display = isAdd ? 'block' : 'none';
    this.els.saveBtn.style.display = isAdd ? 'none' : 'block';
    this.els.cancelBtn.style.display = isAdd ? 'none' : 'block';
  }

  loadItems() {
    const config = this.getSectionConfig(this.currentSection);
    return JSON.parse(localStorage.getItem(config.storageKey) || '[]');
  }

  saveItems(items) {
    const config = this.getSectionConfig(this.currentSection);
    localStorage.setItem(config.storageKey, JSON.stringify(items));
  }

  uid() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
  }
}
