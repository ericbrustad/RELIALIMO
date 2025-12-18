import { getPaymentMethods, getPaymentGateways, getDefaultPaymentGatewayId, getCardLast4 } from './payment-data.js';
import { wireMainNav, navigateToSection } from './navigation.js';

class Accounts {
  constructor() {
    this.currentTab = 'accounts';
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  clearDres4LoginFields() {
    const emailEl = document.getElementById('dres4LoginEmail');
    const passwordEl = document.getElementById('dres4LoginPassword');
    if (emailEl) emailEl.value = '';
    if (passwordEl) passwordEl.value = '';
  }

  getSelectedAccountId() {
    // Prefer the currently loaded account number (readonly field)
    const fromForm = document.getElementById('accountNumber')?.value?.trim();
    if (fromForm) return fromForm;
    // Fallback to listbox selection
    const fromList = document.getElementById('accountsListbox')?.value?.trim();
    return fromList || null;
  }

  getCurrentAccountDisplayName() {
    const first = document.getElementById('acctFirstName')?.value?.trim() || '';
    const last = document.getElementById('acctLastName')?.value?.trim() || '';
    const company = document.getElementById('acctCompany')?.value?.trim() || '';

    const person = `${first} ${last}`.trim();
    return company || person || 'this account';
  }

  isAccountLinkedToReservations(accountId) {
    if (!this.db) return false;

    try {
      const reservations = this.db.getAllReservations?.() || [];
      const id = (accountId ?? '').toString();
      return reservations.some(r => {
        // Primary supported linkage
        if ((r?.account_id ?? '').toString() === id) return true;

        // Back-compat / other storage patterns
        if ((r?.billing_account ?? '').toString() === id) return true;
        if ((r?.form_snapshot?.billing?.account ?? '').toString() === id) return true;

        return false;
      });
    } catch (e) {
      console.warn('⚠️ Failed to check reservation linkage:', e);
      return false;
    }
  }

  async makeAccountInactive(accountId) {
    if (!this.db) return false;
    try {
      const existing = this.db.getAccountById?.(accountId);
      if (!existing) return false;

      const updated = {
        ...existing,
        status: 'inactive',
        updated_at: new Date().toISOString()
      };

      await this.db.saveAccount(updated);
      return true;
    } catch (e) {
      console.error('❌ Failed to make account inactive:', e);
      return false;
    }
  }

  async deleteSelectedAccount() {
    if (!this.db) {
      alert('Database module not available. Please refresh the page.');
      return;
    }

    const accountId = this.getSelectedAccountId();
    if (!accountId) {
      alert('Please select an account to delete.');
      return;
    }

    // Are-you-sure confirmation
    const confirmDelete = confirm(`Are you sure you want to delete account ${accountId}?`);
    if (!confirmDelete) return;

    // If linked to reservations, block delete and offer to mark inactive
    if (this.isAccountLinkedToReservations(accountId)) {
      const name = this.getCurrentAccountDisplayName();
      const makeInactive = confirm(
        `We can not delete due to this account being attached to a reservation.\n` +
        `You may make the account inactive.\n\n` +
        `Make "${name}" inactive?\n\nOK = Yes\nCancel = No`
      );

      if (!makeInactive) return;

      const ok = await this.makeAccountInactive(accountId);
      if (!ok) {
        alert('Unable to mark account inactive.');
        return;
      }

      await this.loadAccountsList();
      alert('Account marked inactive.');
      return;
    }

    const deleted = this.db.deleteAccount(accountId);
    if (!deleted) {
      alert('Failed to delete account.');
      return;
    }

    // Also remove locally stored addresses for this account
    try {
      localStorage.removeItem(`relia_account_${accountId}_addresses`);
    } catch (e) {
      console.warn('⚠️ Failed to remove account addresses storage:', e);
    }

    // Clear form fields (best-effort)
    try {
      this.addNewAccount();
    } catch {
      // no-op
    }

    await this.loadAccountsList();
    alert('Account deleted.');
  }

  async init() {
    console.log('🔧 Initializing Accounts...');
    try {
      // Load database module
      await this.loadDbModule();
      
      // Load API service for Supabase
      await this.loadApiService();
      
      this.setupEventListeners();
      
      // Load accounts list
      await this.loadAccountsList();
      
      // Check if we should load a specific account
      const currentAccountId = localStorage.getItem('currentAccountId');
      if (currentAccountId) {
        this.loadAccount(currentAccountId);
        localStorage.removeItem('currentAccountId'); // Clear after loading
      }

      // Always apply any draft (used by Reservation "Create Account" and similar flows)
      this.applyDraftIfPresent();

      // Never prefill DRES4 / Passenger App login credentials (even if browser tries)
      this.clearDres4LoginFields();
      setTimeout(() => this.clearDres4LoginFields(), 0);
      setTimeout(() => this.clearDres4LoginFields(), 250);
      setTimeout(() => this.clearDres4LoginFields(), 1000);
      
      console.log('✅ Accounts initialization complete');
    } catch (error) {
      console.error('❌ Error initializing Accounts:', error);
    }
  }
  
  async loadApiService() {
    try {
      const module = await import('./api-service.js');
      this.api = module;
      await module.setupAPI();
      console.log('✅ API service loaded');
    } catch (error) {
      console.warn('⚠️ Failed to load API service:', error);
    }
  }
  
  async loadAccountsList() {
    try {
      // Load from localStorage first
      const localAccounts = this.db?.getAllAccounts() || [];
      
      // Try to load from Supabase
      let supabaseAccounts = [];
      if (this.api && this.api.fetchAccounts) {
        supabaseAccounts = await this.api.fetchAccounts() || [];
      }
      
      // Merge accounts (prefer Supabase if available)
      const allAccounts = supabaseAccounts.length > 0 ? supabaseAccounts : localAccounts;
      
      // Populate the listbox
      const listbox = document.getElementById('accountsListbox');
      if (listbox && allAccounts.length > 0) {
        listbox.innerHTML = allAccounts.map(acc => {
          const inactiveLabel = (acc.status || '').toString().toLowerCase() === 'inactive' ? ' (INACTIVE)' : '';
          const displayName = `${acc.account_number || acc.id}${inactiveLabel} - ${acc.first_name || ''} ${acc.last_name || ''} ${acc.company_name ? '- ' + acc.company_name : ''}`.trim();
          return `<option value="${acc.account_number || acc.id}">${displayName}</option>`;
        }).join('');
      }
      
      console.log(`✅ Loaded ${allAccounts.length} accounts`);
    } catch (error) {
      console.error('❌ Error loading accounts list:', error);
    }
  }
  
  async loadDbModule() {
    try {
      const module = await import('./assets/db.js');
      this.db = module.db;
      console.log('✅ Database module loaded');
    } catch (error) {
      console.error('❌ Failed to load database module:', error);
    }
  }
  
  loadAccount(accountId) {
    if (!this.db) {
      console.warn('⚠️ Database module not loaded yet');
      return;
    }
    
    try {
      const account = this.db.getAccountById(accountId);
      if (!account) {
        console.warn('⚠️ Account not found:', accountId);
        return;
      }
      
      console.log('✅ Loading account:', account);
      
      // Populate form fields with proper mapping
      const accountNumberEl = document.getElementById('accountNumber');
      const firstNameEl = document.getElementById('acctFirstName');
      const lastNameEl = document.getElementById('acctLastName');
      const companyEl = document.getElementById('acctCompany');
      const cellPhone1El = document.getElementById('acctCellPhone1'); // Top-left cell field
      const cellularPhone1El = document.getElementById('acctCellularPhone1'); // Contact Info > Cellular Phone 1
      const emailEl = document.getElementById('acctEmail2'); // Maps to email
      
      if (accountNumberEl) {
        accountNumberEl.value = account.account_number || account.id;
        accountNumberEl.setAttribute('readonly', true);
        accountNumberEl.style.backgroundColor = '#f5f5f5';
      }
      if (firstNameEl) firstNameEl.value = account.first_name || '';
      if (lastNameEl) lastNameEl.value = account.last_name || '';
      if (companyEl) companyEl.value = account.company_name || '';
      const cellValue = account.cell_phone || '';
      if (cellPhone1El) cellPhone1El.value = cellValue;
      if (cellularPhone1El) cellularPhone1El.value = cellValue;
        if (emailEl) emailEl.value = account.email || ''; // Accounts Email

        // Financial + Payment Profile (shared with Reservation payment tab/modal)
        this.applyFinancialData(account);

      // Ensure DRES4 fields never prefill from account data
      this.clearDres4LoginFields();
      
      // Switch to accounts tab
      this.switchAccountTab('info');
    } catch (error) {
      console.error('❌ Error loading account:', error);
    }
  }

  applyFinancialData(account) {
    const financial = account?.financial_settings || {};
    const profile = account?.payment_profile || {};

    const postMethodEl = document.getElementById('postMethod');
    const postTermsEl = document.getElementById('postTerms');
    if (postMethodEl) postMethodEl.value = financial.post_method || postMethodEl.value;
    if (postTermsEl) postTermsEl.value = financial.post_terms || postTermsEl.value;

    // Populate selects (methods/gateways) then set values
    this.populatePaymentSelects();

    const methodEl = document.getElementById('accountPaymentMethod');
    const gatewayEl = document.getElementById('accountPaymentGateway');
    if (methodEl && profile.method_code) methodEl.value = profile.method_code;
    if (gatewayEl && profile.gateway_id) gatewayEl.value = profile.gateway_id;

    const ccNumberEl = document.getElementById('creditCardNumber');
    const expMonthEl = document.getElementById('expMonth');
    const expYearEl = document.getElementById('expYear');
    const nameOnCardEl = document.getElementById('nameOnCard');
    const billingAddressEl = document.getElementById('billingAddressCC');
    const billingCityEl = document.getElementById('billingCityCC');
    const billingStateEl = document.getElementById('billingStateCC');
    const billingZipEl = document.getElementById('billingZipCC');
    const billingLine2El = document.getElementById('billingAddressLine2CC');
    const billingCountryEl = document.getElementById('billingCountryCC');
    const ccTypeEl = document.getElementById('ccType');
    const notesEl = document.getElementById('creditCardNotes');

    if (ccNumberEl) ccNumberEl.value = profile.card_number || '';
    if (expMonthEl) expMonthEl.value = profile.exp_month || '';
    if (expYearEl) expYearEl.value = profile.exp_year || '';
    if (nameOnCardEl) nameOnCardEl.value = profile.name_on_card || '';
    if (billingAddressEl) billingAddressEl.value = profile.billing_address1 || '';
    if (billingLine2El) billingLine2El.value = profile.billing_address2 || '';
    if (billingCityEl) billingCityEl.value = profile.billing_city || '';
    if (billingStateEl && profile.billing_state) billingStateEl.value = profile.billing_state;
    if (billingZipEl) billingZipEl.value = profile.billing_zip || '';
    if (billingCountryEl && profile.billing_country) billingCountryEl.value = profile.billing_country;
    if (ccTypeEl && profile.cc_type) ccTypeEl.value = profile.cc_type;
    if (notesEl) notesEl.value = profile.notes || '';

    // Never persist CVV; always clear when loading
    const cvvEl = document.getElementById('cvv');
    if (cvvEl) cvvEl.value = '';
  }

  populatePaymentSelects() {
    const methodEl = document.getElementById('accountPaymentMethod');
    if (methodEl && methodEl.dataset.optionsLoaded !== '1') {
      const methods = getPaymentMethods();
      methodEl.innerHTML = '<option value="">-- NOT SELECTED --</option>' +
        methods.map(m => `<option value="${m.code}">${m.name}</option>`).join('');
      methodEl.dataset.optionsLoaded = '1';
    }

    const gatewayEl = document.getElementById('accountPaymentGateway');
    if (gatewayEl && gatewayEl.dataset.optionsLoaded !== '1') {
      const gateways = getPaymentGateways();
      const defaultId = getDefaultPaymentGatewayId();
      gatewayEl.innerHTML = '<option value="">-- NOT SELECTED --</option>' +
        gateways.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
      if (!gatewayEl.value && defaultId) gatewayEl.value = defaultId;
      gatewayEl.dataset.optionsLoaded = '1';
    }
  }

  applyDraftIfPresent() {
    // Check if there's a draft account from the reservation form
    const raw = localStorage.getItem('relia_account_draft');
    if (!raw) return;

    try {
      const draft = JSON.parse(raw);
      console.log('✅ Draft account found, prefilling fields:', draft);

      const setIfEmpty = (el, value) => {
        if (!el) return;
        const current = (el.value ?? '').toString().trim();
        const next = (value ?? '').toString();
        if (!next) return;
        if (!current) el.value = next;
      };

      // Switch to Accounts tab (in case we're not already there)
      this.switchTab('accounts');

      // Use the IDs we just added to accounts.html
      const firstNameEl = document.getElementById('acctFirstName');
      const lastNameEl = document.getElementById('acctLastName');
      const companyEl = document.getElementById('acctCompany');
      const cellPhone1El = document.getElementById('acctCellPhone1');
      const cellularPhone1El = document.getElementById('acctCellularPhone1');
      const emailEl = document.getElementById('acctEmail2');
      const phoneEl = document.getElementById('acctPhone');

      // Fill basic info (do not overwrite existing values)
      setIfEmpty(firstNameEl, draft.first_name);
      setIfEmpty(lastNameEl, draft.last_name);
      setIfEmpty(companyEl, draft.company_name);

      // Auto-fill phone fields
      // Reservation/Billing "phone" should be treated as CELL and go into Cellular Phone 1.
      // Do not auto-fill Office Phone from the draft.
      const draftCell = draft.cell_phone || draft.phone;
      setIfEmpty(cellPhone1El, draftCell);
      setIfEmpty(cellularPhone1El, draftCell);

      // If Office Phone is empty, keep it empty (never fill from draft)
      if (phoneEl && !(phoneEl.value ?? '').toString().trim()) {
        // no-op
      }

      // Auto-fill email fields
      setIfEmpty(emailEl, draft.email);

      // Also fill the Contact Info email section (if it exists)
      const acctEmailContactEl = document.getElementById('acctEmail');
      setIfEmpty(acctEmailContactEl, draft.email);

      // Prefill account type tickers
      const types = draft.types || {};
      const billingTicker = document.getElementById('acctTypeBilling');
      const passengerTicker = document.getElementById('acctTypePassenger');
      const bookingTicker = document.getElementById('acctTypeBooking');

      if (billingTicker && types.billing) billingTicker.checked = true;
      if (passengerTicker && types.passenger) passengerTicker.checked = true;
      if (bookingTicker && types.booking) bookingTicker.checked = true;

      // Prefill address tab fields if present
      const addr = draft.address || {};
      const addressTypeEl = document.getElementById('addressType');
      const addressNameEl = document.getElementById('addressName');
      const primaryAddressEl = document.getElementById('primaryAddress');
      const addressCityEl = document.getElementById('addressCity');
      const addressStateEl = document.getElementById('addressState');
      const addressZipEl = document.getElementById('addressZip');
      const addressAptEl = document.getElementById('addressApt');
      const addressCountryEl = document.getElementById('addressCountry');

      if (addr && typeof addr === 'object') {
        // For selects, only set if empty/current default
        if (addressTypeEl && (addressTypeEl.value ?? '').toString().trim() === '') {
          addressTypeEl.value = addr.address_type || addressTypeEl.value;
        }
        setIfEmpty(addressNameEl, addr.address_name);
        setIfEmpty(primaryAddressEl, addr.address_line1);
        setIfEmpty(addressAptEl, addr.address_line2);
        setIfEmpty(addressCityEl, addr.city);
        if (addressStateEl && (addressStateEl.value ?? '').toString().trim() === '') {
          addressStateEl.value = addr.state || addressStateEl.value;
        }
        setIfEmpty(addressZipEl, addr.zip);
        if (addressCountryEl && (addressCountryEl.value ?? '').toString().trim() === '') {
          addressCountryEl.value = addr.country || addressCountryEl.value;
        }
      }

      // Prefill Financial Data payment profile if present
      const payment = draft.payment_profile || {};
      if (payment && typeof payment === 'object') {
        // Ensure selects are populated from Office lists
        this.populatePaymentSelects();

        const methodEl = document.getElementById('accountPaymentMethod');
        const gatewayEl = document.getElementById('accountPaymentGateway');
        if (methodEl && (methodEl.value ?? '').toString().trim() === '') {
          methodEl.value = payment.method_code || methodEl.value;
        }
        if (gatewayEl && (gatewayEl.value ?? '').toString().trim() === '') {
          gatewayEl.value = payment.gateway_id || gatewayEl.value;
        }

        setIfEmpty(document.getElementById('creditCardNumber'), payment.card_number);
        setIfEmpty(document.getElementById('expMonth'), payment.exp_month);
        setIfEmpty(document.getElementById('expYear'), payment.exp_year);
        setIfEmpty(document.getElementById('nameOnCard'), payment.name_on_card);
        setIfEmpty(document.getElementById('billingAddressCC'), payment.billing_address1);
        setIfEmpty(document.getElementById('billingAddressLine2CC'), payment.billing_address2);
        setIfEmpty(document.getElementById('billingCityCC'), payment.billing_city);

        const billingStateEl = document.getElementById('billingStateCC');
        if (billingStateEl && (billingStateEl.value ?? '').toString().trim() === '') {
          billingStateEl.value = payment.billing_state || billingStateEl.value;
        }

        setIfEmpty(document.getElementById('billingZipCC'), payment.billing_zip);

        const billingCountryEl = document.getElementById('billingCountryCC');
        if (billingCountryEl && (billingCountryEl.value ?? '').toString().trim() === '') {
          billingCountryEl.value = payment.billing_country || billingCountryEl.value;
        }

        const ccTypeEl = document.getElementById('ccType');
        if (ccTypeEl && (ccTypeEl.value ?? '').toString().trim() === '') {
          ccTypeEl.value = payment.cc_type || ccTypeEl.value;
        }

        setIfEmpty(document.getElementById('creditCardNotes'), payment.notes);

        // Never prefill CVV
        const cvvEl = document.getElementById('cvv');
        if (cvvEl) cvvEl.value = '';
      }

      // Clear the draft so it doesn't keep refilling
      localStorage.removeItem('relia_account_draft');
      console.log('✅ Draft applied and cleared');

      // Focus first name field for immediate entry
      if (firstNameEl) {
        setTimeout(() => firstNameEl.focus(), 100);
      }
    } catch (error) {
      console.error('Error parsing draft account:', error);
      localStorage.removeItem('relia_account_draft');
    }
  }

  setupEventListeners() {
    console.log('🔧 Setting up Accounts event listeners...');
    
    // Save Account button
    const saveAccountBtn = document.getElementById('saveAccountBtn');
    if (saveAccountBtn) {
      saveAccountBtn.addEventListener('click', () => {
        console.log('💾 Save Account button clicked');
        this.saveAccount();
      });
      console.log('✅ Save Account button listener attached');
    } else {
      console.warn('⚠️ saveAccountBtn not found');
    }

    // Clear Account form button (next to SAVE)
    const clearAccountFormBtn = document.getElementById('clearAccountFormBtn');
    if (clearAccountFormBtn) {
      clearAccountFormBtn.addEventListener('click', () => {
        console.log('🧹 Clear Account form button clicked');
        this.addNewAccount();
      });
      console.log('✅ Clear Account form button listener attached');
    }
    
    // Main navigation buttons
    wireMainNav();

    // Sidebar buttons: Delete / Reservation / Edit
    const sidebarButtons = document.querySelectorAll('.sidebar-buttons button');
    sidebarButtons.forEach((btn) => {
      const label = (btn.textContent || '').trim().toLowerCase();
      if (label === 'delete') {
        btn.addEventListener('click', () => this.deleteSelectedAccount());
      }
    });

    // Window tabs (Companies, Accounts, Export Customers, Email Lists)
    document.querySelectorAll('.window-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // View buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        
        if (action === 'user-view') {
          window.location.href = 'index.html?view=user';
        } else if (action === 'driver-view') {
          window.location.href = 'index.html?view=driver';
        } else if (action === 'reservations') {
          navigateToSection('reservations');
        } else if (action === 'farm-out') {
          navigateToSection('reservations', { url: 'reservations-list.html?filter=farm-out' });
        } else if (action === 'new-reservation') {
          // Route through the index shell so it doesn't open inside this iframe
          navigateToSection('new-reservation');
        }
      });
    });

    // Add Company button
    const addCompanyBtn = document.getElementById('addCompanyBtn');
    if (addCompanyBtn) {
      addCompanyBtn.addEventListener('click', () => {
        this.addCompany();
      });
    }

    // Edit Company button
    const editCompanyBtn = document.getElementById('editCompanyBtn');
    if (editCompanyBtn) {
      editCompanyBtn.addEventListener('click', () => {
        this.editCompany();
      });
    }

    // Add New Account link
    const addNewAccountLink = document.querySelector('.link-add');
    if (addNewAccountLink) {
      addNewAccountLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.addNewAccount();
      });
      console.log('✅ Add New Account link listener attached');
    }

    // Accounts listbox selection
    const accountsListbox = document.getElementById('accountsListbox');
    if (accountsListbox) {
      accountsListbox.addEventListener('change', (e) => {
        const accountId = e.target.value;
        if (accountId) {
          this.loadAccount(accountId);
        }
      });
      console.log('✅ Accounts listbox listener attached');
    }

    // Sidebar search
    const searchInput = document.querySelector('.sidebar-input');
    const searchBtn = document.querySelector('.btn-go');
    if (searchInput && searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.searchAccounts(searchInput.value);
      });
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.searchAccounts(searchInput.value);
        }
      });
      console.log('✅ Search listeners attached');
    }

    // Clear search
    const clearSearchBtn = document.getElementById('clearAccountsSearchBtn');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        const input = document.querySelector('.sidebar-input');
        if (input) input.value = '';
        this.searchAccounts('');
      });
    }

    // Companies list selection
    const companiesList = document.getElementById('companiesList');
    if (companiesList) {
      companiesList.addEventListener('dblclick', () => {
        this.editCompany();
      });
    }

    // Account sub-tabs (Account Info / Financial Data / Addresses / Booking / Misc)
    document.querySelectorAll('.account-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const btn = e.target.closest('.account-tab');
        const accountTab = btn?.dataset?.accountTab;
        if (!accountTab) return;
        this.switchAccountTab(accountTab);
      });
    });

    // Financial tab SAVE button (no id in HTML)
    const financialSaveBtn = document.querySelector('#financialDataTab button.btn.btn-primary');
    if (financialSaveBtn && financialSaveBtn.textContent.trim().toUpperCase() === 'SAVE') {
      financialSaveBtn.addEventListener('click', () => this.saveAccount());
    }

    // Addresses tab ADD button
    const addAddressBtn = document.getElementById('addAddressBtn');
    if (addAddressBtn) {
      addAddressBtn.addEventListener('click', () => this.addAddress());
    }

    // Email Lists - Include All Dates checkbox
    const emailIncludeAllDates = document.getElementById('emailIncludeAllDates');
    if (emailIncludeAllDates) {
      emailIncludeAllDates.addEventListener('change', (e) => {
        const dateFrom = document.getElementById('emailDateFrom');
        const dateTo = document.getElementById('emailDateTo');
        if (e.target.checked) {
          dateFrom.value = 'ALL DATES';
          dateTo.value = 'ALL DATES';
          dateFrom.disabled = true;
          dateTo.disabled = true;
        } else {
          dateFrom.value = '';
          dateTo.value = '';
          dateFrom.disabled = false;
          dateTo.disabled = false;
        }
      });
    }

    // Generate Email Export button
    const generateEmailExportBtn = document.getElementById('generateEmailExportBtn');
    if (generateEmailExportBtn) {
      generateEmailExportBtn.addEventListener('click', () => {
        this.generateEmailExport();
      });
    }
  }

  switchAccountTab(tabName) {
    // Update account tab active state
    document.querySelectorAll('.account-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.accountTab === tabName) {
        tab.classList.add('active');
      }
    });

    // Hide all account tab contents
    document.querySelectorAll('.account-tab-content').forEach(content => {
      content.classList.remove('active');
      content.style.display = 'none';
    });

    // Show the appropriate content
    if (tabName === 'info') {
      const el = document.getElementById('accountInfoTab');
      if (el) {
        el.classList.add('active');
        el.style.display = '';
      }
      // DRES4 login fields should never prefill (some browsers autofill on tab reveal)
      this.clearDres4LoginFields();
      setTimeout(() => this.clearDres4LoginFields(), 0);
      setTimeout(() => this.clearDres4LoginFields(), 250);
    } else if (tabName === 'financial') {
      const el = document.getElementById('financialDataTab');
      if (el) {
        el.classList.add('active');
        el.style.display = '';
      }

      // Ensure dropdowns are filled from Office lists
      this.populatePaymentSelects();
    } else if (tabName === 'addresses') {
      const el = document.getElementById('addressesTab');
      if (el) {
        el.classList.add('active');
        el.style.display = '';
      }
      this.loadStoredAddresses();
    } else if (tabName === 'booking') {
      const el = document.getElementById('bookingTab');
      if (el) {
        el.classList.add('active');
        el.style.display = '';
      }
      this.loadBookingContacts();
    } else if (tabName === 'misc') {
      const el = document.getElementById('miscTab');
      if (el) {
        el.classList.add('active');
        el.style.display = '';
      }
      this.loadMiscInfo();
    }
  }
  
  loadStoredAddresses() {
    const accountId = this.getCurrentAccountId();
    const container = document.getElementById('storedAddressesList');
    if (!container) return;

    if (!accountId) {
      container.innerHTML = '<p style="color: #999; text-align: center;">Save the account first to store addresses</p>';
      return;
    }

    const addresses = this.db?.getAccountAddresses(accountId) || [];
    if (!addresses.length) {
      container.innerHTML = '<p style="color: #999; text-align: center;">No stored addresses yet</p>';
      return;
    }

    container.innerHTML = addresses
      .slice()
      .sort((a, b) => (b.last_used_at || '').localeCompare(a.last_used_at || ''))
      .map(a => {
        const line2 = a.address_line2 ? ` ${a.address_line2}` : '';
        const city = a.city ? `, ${a.city}` : '';
        const state = a.state ? `, ${a.state}` : '';
        const zip = a.zip_code ? ` ${a.zip_code}` : '';
        const label = `${a.address_name || a.address_type || 'Address'}: ${a.address_line1 || ''}${line2}${city}${state}${zip}`;
        return `<div style="padding: 6px 8px; border-bottom: 1px solid #eee;">${label}</div>`;
      })
      .join('');
  }

  getCurrentAccountId() {
    const accountNumber = document.getElementById('accountNumber')?.value?.trim();
    if (accountNumber) return accountNumber;
    const selected = document.getElementById('accountsListbox')?.value?.trim();
    return selected || null;
  }

  async addAddress() {
    const accountId = this.getCurrentAccountId();
    if (!accountId) {
      alert('Please SAVE the account first (to get an Account#), then add addresses.');
      return;
    }

    const addressData = {
      address_type: document.getElementById('addressType')?.value?.trim() || 'primary',
      address_name: document.getElementById('addressName')?.value?.trim() || '',
      address_line1: document.getElementById('primaryAddress')?.value?.trim() || '',
      address_line2: document.getElementById('addressApt')?.value?.trim() || '',
      city: document.getElementById('addressCity')?.value?.trim() || '',
      state: document.getElementById('addressState')?.value?.trim() || '',
      zip_code: document.getElementById('addressZip')?.value?.trim() || '',
      country: document.getElementById('addressCountry')?.value?.trim() || 'United States'
    };

    if (!addressData.address_line1) {
      alert('Primary Address is required.');
      return;
    }

    const saved = this.db?.saveAccountAddress(accountId, addressData);
    if (!saved) {
      alert('Failed to save address.');
      return;
    }

    this.loadStoredAddresses();
  }
  
  loadBookingContacts() {
    // TODO: Load booking contacts from db
    console.log('Loading booking contacts...');
  }
  
  loadMiscInfo() {
    // TODO: Load misc info
    console.log('Loading misc info...');
  }

  addNewAccount() {
    console.log('🆕 Add New Account clicked');
    
    // Clear all form fields
    document.getElementById('acctFirstName').value = '';
    document.getElementById('acctLastName').value = '';
    document.getElementById('acctCompany').value = '';
    document.getElementById('acctCellPhone1').value = '';
    document.getElementById('acctEmail2').value = '';

    // Never carry DRES4 login fields between accounts
    this.clearDres4LoginFields();
    
    // Clear account number (will be assigned on save)
    const accountNumberEl = document.getElementById('accountNumber');
    if (accountNumberEl) {
      accountNumberEl.value = '';
      accountNumberEl.placeholder = 'Will be assigned on save';
      accountNumberEl.setAttribute('readonly', true);
      accountNumberEl.style.backgroundColor = '#f5f5f5';
    }
    
    // Clear misc account number too
    const miscAccountNumberEl = document.getElementById('miscAccountNumber');
    if (miscAccountNumberEl) {
      miscAccountNumberEl.value = '';
      miscAccountNumberEl.placeholder = 'Will be assigned on save';
    }
    
    // Switch to Account Info tab
    this.switchAccountTab('info');
    
    // Focus first name field
    setTimeout(() => {
      document.getElementById('acctFirstName')?.focus();
    }, 100);
    
    console.log('✅ New account form ready - account number will be assigned on save');
  }

  searchAccounts(query) {
    if (!query || !query.trim()) {
      // Show all accounts if no query
      this.loadAccountsList();
      return;
    }
    
    const searchTerm = query.toLowerCase().trim();
    console.log('🔍 Searching accounts for:', searchTerm);
    
    // Get all accounts
    const allAccounts = this.db?.getAllAccounts() || [];
    
    // Search across ALL fields
    const filtered = allAccounts.filter(acc => {
      const searchableText = [
        acc.account_number,
        acc.first_name,
        acc.last_name,
        acc.company_name,
        acc.email,
        acc.phone,
        acc.cell_phone
      ].filter(Boolean).join(' ').toLowerCase();
      
      return searchableText.includes(searchTerm);
    });
    
    // Update listbox
    const listbox = document.getElementById('accountsListbox');
    if (listbox && filtered.length > 0) {
      listbox.innerHTML = filtered.map(acc => {
        const inactiveLabel = (acc.status || '').toString().toLowerCase() === 'inactive' ? ' (INACTIVE)' : '';
        const displayName = `${acc.account_number || acc.id}${inactiveLabel} - ${acc.first_name || ''} ${acc.last_name || ''} ${acc.company_name ? '- ' + acc.company_name : ''}`.trim();
        return `<option value="${acc.account_number || acc.id}">${displayName}</option>`;
      }).join('');
    } else if (listbox) {
      listbox.innerHTML = '<option value="">-- No matches found --</option>';
    }
    
    console.log(`✅ Found ${filtered.length} matching accounts`);
  }

  navigateToSection(section) {
    navigateToSection(section);
  }

  switchTab(tabName) {
    // Update tab active state
    document.querySelectorAll('.window-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      }
    });

    // Hide all sections
    document.querySelectorAll('.accounts-section').forEach(section => {
      section.classList.remove('active');
      section.style.display = 'none';
    });

    // Show the appropriate section
    let sectionId = '';
    if (tabName === 'companies') {
      sectionId = 'companies-tab';
    } else if (tabName === 'accounts') {
      sectionId = 'accounts-tab';
    } else if (tabName === 'export-customers') {
      sectionId = 'export-customers-tab';
    } else if (tabName === 'email-lists') {
      sectionId = 'email-lists-tab';
    }

    const sectionElement = document.getElementById(sectionId);
    if (sectionElement) {
      sectionElement.classList.add('active');
      sectionElement.style.display = 'block';
    }

    this.currentTab = tabName;
  }

  addCompany() {
    // Get form values
    const companyNameInput = document.querySelector('.company-form-panel input[type="text"]');
    const companyName = companyNameInput ? companyNameInput.value.trim() : '';

    if (!companyName) {
      alert('Please enter a company name');
      return;
    }

    // In a real application, this would send data to the server
    console.log('Adding company:', companyName);
    
    // Add to list
    const companiesList = document.getElementById('companiesList');
    if (companiesList) {
      const option = document.createElement('option');
      option.value = Date.now().toString();
      option.textContent = companyName;
      companiesList.appendChild(option);
      
      // Select the new option
      option.selected = true;
    }

    // Clear form
    if (companyNameInput) {
      companyNameInput.value = '';
    }

    alert('Company added successfully!');
  }

  editCompany() {
    const companiesList = document.getElementById('companiesList');
    if (!companiesList) return;

    const selectedOption = companiesList.options[companiesList.selectedIndex];
    if (!selectedOption) {
      alert('Please select a company to edit');
      return;
    }

    const companyName = selectedOption.textContent;
    alert(`Edit company: ${companyName}\n\nFull company editing form will be available here.`);
  }

  async saveAccount() {
    console.log('💾 saveAccount() called');
    
    try {
      // Auto-fill: Email → Account Emails
      const email = document.getElementById('acctEmail2')?.value?.trim();

      // Use Contact Info "Cellular Phone 1" if present; otherwise use the top-left cell field
      const cellPhone =
        document.getElementById('acctCellularPhone1')?.value?.trim() ||
        document.getElementById('acctCellPhone1')?.value?.trim() ||
        '';

      // Keep the two cell fields in sync (best-effort)
      const topCellEl = document.getElementById('acctCellPhone1');
      const contactCellEl = document.getElementById('acctCellularPhone1');
      if (cellPhone) {
        if (topCellEl && !topCellEl.value) topCellEl.value = cellPhone;
        if (contactCellEl && !contactCellEl.value) contactCellEl.value = cellPhone;
      }
      
      // Auto-fill contact info email if empty
      const acctEmailContactEl = document.getElementById('acctEmail');
      if (acctEmailContactEl && email && !acctEmailContactEl.value) {
        acctEmailContactEl.value = email;
      }
      
      // Get account number (readonly field) or assign new one
      let accountNumber = document.getElementById('accountNumber')?.value?.trim();
      
      // If no account number, this is a NEW account - assign next number
      if (!accountNumber) {
        accountNumber = this.db.getNextAccountNumber().toString();
        console.log('🆕 New account - assigning account number:', accountNumber);
        
        // Increment for next account
        this.db.setNextAccountNumber(parseInt(accountNumber) + 1);
        
        // Update the form with the new account number
        const accountNumberEl = document.getElementById('accountNumber');
        if (accountNumberEl) {
          accountNumberEl.value = accountNumber;
          accountNumberEl.style.backgroundColor = '#f5f5f5';
        }
        
        // Update misc account number too
        const miscAccountNumberEl = document.getElementById('miscAccountNumber');
        if (miscAccountNumberEl) {
          miscAccountNumberEl.value = accountNumber;
        }
      }

      // Preserve existing nested data when updating an account
      const existingAccount = this.db.getAccountById?.(accountNumber) || {};
      
      // Collect form data with proper field mappings
      const accountData = {
        id: accountNumber,
        account_number: accountNumber,
        first_name: document.getElementById('acctFirstName')?.value?.trim() || '',
        last_name: document.getElementById('acctLastName')?.value?.trim() || '',
        company_name: document.getElementById('acctCompany')?.value?.trim() || '',
        phone: document.getElementById('acctPhone')?.value?.trim() || '',
        cell_phone: cellPhone, // Cellular Phone 1
        email: document.getElementById('acctEmail2')?.value?.trim() || '', // Accounts Email
        status: 'active',
        type: 'individual',
        updated_at: new Date().toISOString(),

        // Financial settings + shared payment profile
        financial_settings: {
          ...(existingAccount.financial_settings || {}),
          post_method: document.getElementById('postMethod')?.value || '',
          post_terms: document.getElementById('postTerms')?.value?.trim() || ''
        },
        payment_profile: {
          ...(existingAccount.payment_profile || {}),
          method_code: document.getElementById('accountPaymentMethod')?.value || '',
          gateway_id: document.getElementById('accountPaymentGateway')?.value || '',

          // Card details (stored with account per your workflow)
          // NOTE: CVV is intentionally NOT stored.
          card_number: document.getElementById('creditCardNumber')?.value?.trim() || '',
          card_last4: getCardLast4(document.getElementById('creditCardNumber')?.value),
          exp_month: document.getElementById('expMonth')?.value?.trim() || '',
          exp_year: document.getElementById('expYear')?.value?.trim() || '',
          name_on_card: document.getElementById('nameOnCard')?.value?.trim() || '',
          billing_address1: document.getElementById('billingAddressCC')?.value?.trim() || '',
          billing_address2: document.getElementById('billingAddressLine2CC')?.value?.trim() || '',
          billing_city: document.getElementById('billingCityCC')?.value?.trim() || '',
          billing_state: document.getElementById('billingStateCC')?.value || '',
          billing_zip: document.getElementById('billingZipCC')?.value?.trim() || '',
          billing_country: document.getElementById('billingCountryCC')?.value || '',
          cc_type: document.getElementById('ccType')?.value || '',
          notes: document.getElementById('creditCardNotes')?.value?.trim() || ''
        }
      };

      console.log('📝 Account data to save:', accountData);

      // Validate required fields
      if (!accountData.first_name || !accountData.last_name || !accountData.email) {
        alert('First Name, Last Name, and Email are required');
        console.warn('⚠️ Required fields missing');
        return;
      }

      // Use existing db module
      if (!this.db) {
        console.error('❌ Database module not loaded');
        alert('Database module not available. Please refresh the page.');
        return;
      }
      
      console.log('✅ Saving account with Supabase sync...');
      const saved = await this.db.saveAccount(accountData);
      
      if (!saved) {
        console.error('❌ saveAccount returned null/false');
        alert('Error saving account. Please try again.');
        return;
      }
      
      console.log('✅ Account saved successfully:', saved);
      alert('Account saved successfully!\nData synced to Supabase database.');

      // If this page was opened from Reservation, notify the opener/parent and return
      try {
        const params = new URLSearchParams(window.location.search);
        const from = (params.get('from') || '').toLowerCase();
        const payload = {
          action: 'relia:accountSaved',
          from,
          accountId: accountNumber,
          accountName: this.getCurrentAccountDisplayName?.() || ''
        };

        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, '*');
          if (from === 'reservation') {
            // Close popup if possible
            setTimeout(() => {
              try { window.close(); } catch { /* ignore */ }
            }, 150);
          }
        }

        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, '*');
        }

        // Fallback: same-window return (only when running top-level)
        if (window.self === window.top && from === 'reservation' && (!window.opener || window.opener.closed)) {
          const returnUrl = localStorage.getItem('relia_return_to_reservation_url');
          if (returnUrl) {
            try {
              const u = new URL(returnUrl, window.location.origin);
              u.searchParams.set('newAccountId', accountNumber);
              localStorage.removeItem('relia_return_to_reservation_url');
              window.location.href = u.toString();
            } catch {
              // If URL parsing fails, just go back to reservation form
              try {
                sessionStorage.setItem('relia_nav_override', JSON.stringify({
                  section: 'new-reservation',
                  url: 'reservation-form.html',
                  ts: Date.now()
                }));
              } catch {
                // ignore
              }
              window.location.href = `index.html?section=${encodeURIComponent('new-reservation')}`;
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Failed to return-to-reservation flow:', e);
      }

      // Show success feedback
      const btn = document.getElementById('saveAccountBtn');
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '✓ Saved!';
        btn.style.background = '#28a745';
        btn.disabled = true;

        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.disabled = false;
        }, 2000);
      }
      
      // Reload accounts list
      await this.loadAccountsList();
    } catch (error) {
      console.error('❌ Error saving account:', error);
    }
  }

  generateEmailExport() {
    // Get filter values
    const occasion = document.getElementById('emailOccasion')?.value || 'All';
    const referralSource = document.getElementById('emailReferralSource')?.value || 'All';
    const vehicleType = document.getElementById('emailVehicleType')?.value || 'All';
    const reservationStatus = document.getElementById('emailReservationStatus')?.value || 'All';

    // Get selected fields
    const selectedFields = [];
    if (document.getElementById('emailFieldPassengerName')?.checked) selectedFields.push('Passenger Name');
    if (document.getElementById('emailFieldEmail')?.checked) selectedFields.push('Email');
    if (document.getElementById('emailFieldOccasion')?.checked) selectedFields.push('Occasion');
    if (document.getElementById('emailFieldVehicleType')?.checked) selectedFields.push('Vehicle Type');
    if (document.getElementById('emailFieldReferralSource')?.checked) selectedFields.push('Referral Source');
    if (document.getElementById('emailFieldPrimaryPhone')?.checked) selectedFields.push('Primary Phone Number');
    if (document.getElementById('emailFieldDateOfQuote')?.checked) selectedFields.push('Date of Quote');

    // Get export type
    const exportType = document.querySelector('input[name="emailExportType"]:checked')?.value || 'remove-duplicates';

    // In a real application, this would generate and download the CSV file
    console.log('Generating email export with filters:', {
      occasion,
      referralSource,
      vehicleType,
      reservationStatus,
      selectedFields,
      exportType
    });

    // Show success message (no alert in sandbox)
    console.log('Email export file generated!');
  }
}

// Initialize the app
const app = new Accounts();

// Global helper functions for Account Emails section - Setup event delegation
document.addEventListener('DOMContentLoaded', function() {
  // Add New Email button handler
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('add-new-email-btn')) {
      e.preventDefault();
      addNewAccountEmail();
    }
  });
  
  // Email type dropdown button handler
  document.addEventListener('click', function(e) {
    if (e.target.closest('.email-type-button')) {
      e.preventDefault();
      const button = e.target.closest('.email-type-button');
      toggleEmailTypeDropdown(button);
    }
  });
  
  // Email type checkbox handler
  document.addEventListener('change', function(e) {
    if (e.target.classList.contains('email-type-option')) {
      if (e.target.value === 'select-all') {
        toggleSelectAll(e.target);
      } else {
        updateSelectedTypes(e.target);
      }
    }
    
    // Email active checkbox handler (for scheduled messaging toggle)
    if (e.target.classList.contains('email-active-checkbox')) {
      toggleScheduledMessagingPlaceholder(e.target);
    }
  });
});

function toggleScheduledMessagingPlaceholder(checkbox) {
  const emailRow = checkbox.closest('.account-email-row');
  const emailInput = emailRow.querySelector('.email-input');
  
  if (emailInput) {
    if (checkbox.checked) {
      emailInput.placeholder = 'Exclude from scheduled messaging';
    } else {
      emailInput.placeholder = 'Include in scheduled messaging';
    }
  }
}

function addNewAccountEmail() {
  const container = document.getElementById('account-emails-container');
  if (!container) return;
  
  // Create new email row
  const newRow = document.createElement('div');
  newRow.className = 'account-email-row';
  newRow.style.cssText = 'display: flex; gap: 10px; align-items: center; margin-bottom: 8px; position: relative;';
  
  newRow.innerHTML = `
    <input type="checkbox" class="email-active-checkbox" style="width: 16px; height: 16px;" />
    <input type="text" class="form-control email-input" placeholder="Include in scheduled messaging" style="flex: 1;" />
    <div class="email-type-selector" style="position: relative; width: 300px;">
      <button type="button" class="form-control email-type-button" style="text-align: left; cursor: pointer; background: white; display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border: 1px solid #ccc;">
        <span class="selected-types-display">Select email types...</span>
        <span style="color: #999;">▼</span>
      </button>
      <div class="email-type-dropdown-menu" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #666; margin-top: 1px; z-index: 1000; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
        <label style="display: flex; align-items: center; padding: 6px 12px; cursor: pointer; font-size: 12px; border-bottom: 1px solid #e0e0e0;" onmouseover="this.style.background='#e8f4ff'" onmouseout="this.style.background='white'">
          <input type="checkbox" class="email-type-option" value="select-all" style="margin-right: 10px; width: 16px; height: 16px; cursor: pointer;" />
          <span class="checkbox-label">Select All</span>
        </label>
        <label style="display: flex; align-items: center; padding: 6px 12px; cursor: pointer; font-size: 12px; border-bottom: 1px solid #e0e0e0;" onmouseover="this.style.background='#e8f4ff'" onmouseout="this.style.background='white'">
          <input type="checkbox" class="email-type-option" value="confirmation" style="margin-right: 10px; width: 16px; height: 16px; cursor: pointer;" />
          <span class="checkbox-label">Confirmation</span>
        </label>
        <label style="display: flex; align-items: center; padding: 6px 12px; cursor: pointer; font-size: 12px; border-bottom: 1px solid #e0e0e0;" onmouseover="this.style.background='#e8f4ff'" onmouseout="this.style.background='white'">
          <input type="checkbox" class="email-type-option" value="payment-receipt" style="margin-right: 10px; width: 16px; height: 16px; cursor: pointer;" />
          <span class="checkbox-label">Payment Receipt</span>
        </label>
        <label style="display: flex; align-items: center; padding: 6px 12px; cursor: pointer; font-size: 12px; border-bottom: 1px solid #e0e0e0;" onmouseover="this.style.background='#e8f4ff'" onmouseout="this.style.background='white'">
          <input type="checkbox" class="email-type-option" value="invoices" style="margin-right: 10px; width: 16px; height: 16px; cursor: pointer;" />
          <span class="checkbox-label">Invoices</span>
        </label>
        <label style="display: flex; align-items: center; padding: 6px 12px; cursor: pointer; font-size: 12px;" onmouseover="this.style.background='#e8f4ff'" onmouseout="this.style.background='white'">
          <input type="checkbox" class="email-type-option" value="other" style="margin-right: 10px; width: 16px; height: 16px; cursor: pointer;" />
          <span class="checkbox-label">Other</span>
        </label>
      </div>
    </div>
  `;
  
  container.appendChild(newRow);
  
  // Focus on the new email input
  const newEmailInput = newRow.querySelector('.email-input');
  if (newEmailInput) {
    newEmailInput.focus();
  }
}

function toggleEmailTypeDropdown(button) {
  const dropdown = button.nextElementSibling;
  const allDropdowns = document.querySelectorAll('.email-type-dropdown-menu');
  
  // Close all other dropdowns
  allDropdowns.forEach(d => {
    if (d !== dropdown) {
      d.style.display = 'none';
    }
  });
  
  // Toggle current dropdown
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

function toggleSelectAll(selectAllCheckbox) {
  const dropdown = selectAllCheckbox.closest('.email-type-dropdown-menu');
  const checkboxes = dropdown.querySelectorAll('.email-type-option:not([value="select-all"])');
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = selectAllCheckbox.checked;
  });
  
  updateSelectedTypes(selectAllCheckbox);
}

function updateSelectedTypes(checkbox) {
  const dropdown = checkbox.closest('.email-type-dropdown-menu');
  const button = dropdown.previousElementSibling;
  const display = button.querySelector('.selected-types-display');
  const checkboxes = dropdown.querySelectorAll('.email-type-option:not([value="select-all"])');
  const selectAllCheckbox = dropdown.querySelector('[value="select-all"]');
  
  // Update checkbox labels with checkmarks
  const allOptions = dropdown.querySelectorAll('.email-type-option');
  allOptions.forEach(opt => {
    const label = opt.parentElement.querySelector('.checkbox-label');
    if (label) {
      const text = label.textContent.replace('☑ ', '').replace('☐ ', '');
      if (opt.checked) {
        label.textContent = '☑ ' + text;
        label.style.color = '#2196F3';
        label.style.fontWeight = '500';
      } else {
        label.textContent = text;
        label.style.color = '#333';
        label.style.fontWeight = 'normal';
      }
    }
  });
  
  // Get selected values
  const selected = [];
  const selectedLabels = [];
  checkboxes.forEach(cb => {
    if (cb.checked) {
      const labelText = cb.parentElement.querySelector('.checkbox-label').textContent.replace('☑ ', '').replace('☐ ', '').trim();
      selected.push(cb.value);
      selectedLabels.push(labelText);
    }
  });
  
  // Update select all checkbox state
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = allChecked;
    const selectAllLabel = selectAllCheckbox.parentElement.querySelector('span');
    if (selectAllLabel) {
      if (allChecked) {
        selectAllLabel.textContent = '☑ Select All';
        selectAllLabel.style.color = '#2196F3';
        selectAllLabel.style.fontWeight = '500';
      } else {
        selectAllLabel.textContent = 'Select All';
        selectAllLabel.style.color = '#333';
        selectAllLabel.style.fontWeight = 'normal';
      }
    }
  }
  
  // Update display text
  if (selected.length === 0) {
    display.textContent = 'Select email types...';
  } else if (selected.length === checkboxes.length) {
    display.textContent = 'Confirmation, Payment Receipt, Invoice, Oth...';
  } else {
    const displayText = selectedLabels.join(', ');
    display.textContent = displayText.length > 45 ? displayText.substring(0, 42) + '...' : displayText;
  }
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(event) {
  if (!event.target.closest('.email-type-selector')) {
    document.querySelectorAll('.email-type-dropdown-menu').forEach(dropdown => {
      dropdown.style.display = 'none';
    });
  }
});
