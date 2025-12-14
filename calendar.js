class Calendar {
  constructor() {
    this.currentView = 'day';
    this.currentDate = new Date();
    this.selectedFilters = {
      drivers: [],
      cars: [],
      vehicleTypes: [],
      statuses: []
    };
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadCalendarData();
  }

  setupEventListeners() {
    // Main navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const section = e.target.dataset.section;
        this.navigateToSection(section);
      });
    });

    // View type buttons
    document.querySelectorAll('.view-type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.target.dataset.view;
        this.switchView(view);
      });
    });

    // Date selector
    const goToDateBtn = document.getElementById('goToDate');
    if (goToDateBtn) {
      goToDateBtn.addEventListener('click', () => {
        this.goToSelectedDate();
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
      });
    }

    // Filter checkboxes
    const onlyReservations = document.getElementById('onlyReservations');
    if (onlyReservations) {
      onlyReservations.addEventListener('change', (e) => {
        this.filterByReservations(e.target.checked);
      });
    }

    const onlyMyEvents = document.getElementById('onlyMyEvents');
    if (onlyMyEvents) {
      onlyMyEvents.addEventListener('change', (e) => {
        this.filterByMyEvents(e.target.checked);
      });
    }

    // Launch filters button
    const launchBtn = document.getElementById('launchFilters');
    if (launchBtn) {
      launchBtn.addEventListener('click', () => {
        this.applyFilters();
      });
    }

    // Event item clicks
    document.querySelectorAll('.event-item').forEach(item => {
      item.addEventListener('click', (e) => {
        this.openEventDetails(e.currentTarget);
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

    // In a real application, this would reload the calendar with the appropriate view
    // For now, we'll just log the change
    switch(view) {
      case 'month':
        alert('Month view selected. Calendar will display full month.');
        break;
      case 'week':
        alert('Week view selected. Calendar will display weekly schedule.');
        break;
      case 'w-week':
        alert('Work Week view selected. Calendar will display Monday-Friday.');
        break;
      case 'day':
        alert('Day view selected. Calendar will display single day schedule.');
        break;
    }
  }

  goToSelectedDate() {
    const dateSelector = document.getElementById('dateSelector');
    if (dateSelector) {
      const selectedDate = dateSelector.value;
      console.log('Going to date:', selectedDate);
      alert(`Navigating to ${selectedDate}. Calendar will refresh with selected date.`);
      // In a real application, this would reload the calendar for the selected date
    }
  }

  printCalendar() {
    console.log('Printing calendar...');
    alert('Print dialog would open here. In production, this would generate a printable calendar view.');
    // In a real application, this would open the browser print dialog
    // window.print();
  }

  toggleMobileView(enabled) {
    console.log('Mobile view:', enabled);
    if (enabled) {
      alert('Mobile view enabled. Calendar layout optimized for mobile devices.');
    } else {
      alert('Mobile view disabled. Calendar displaying in desktop mode.');
    }
    // In a real application, this would toggle mobile-specific CSS classes
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
    
    let filterMessage = 'Filters applied:\n';
    if (driverFilter) filterMessage += `\n- Driver: ${driverFilter}`;
    if (carFilter) filterMessage += `\n- Car: ${carFilter}`;
    if (vehicleTypeFilter) filterMessage += `\n- Vehicle Type: ${vehicleTypeFilter}`;
    if (statusFilter) filterMessage += `\n- Status: ${statusFilter}`;
    
    if (!driverFilter && !carFilter && !vehicleTypeFilter && !statusFilter) {
      filterMessage = 'No filters selected. Showing all events.';
    }
    
    alert(filterMessage);
    
    // In a real application, this would reload the calendar with filtered data
  }

  openEventDetails(eventElement) {
    const timeText = eventElement.querySelector('.event-time')?.textContent || '';
    const vehicleText = eventElement.querySelector('.event-vehicle')?.textContent || '';
    
    console.log('Opening event details:', { time: timeText, vehicle: vehicleText });
    alert(`Event Details:\n\nTime: ${timeText}\nVehicle: ${vehicleText}\n\nIn production, this would open a detailed reservation view.`);
    
    // In a real application, this would open a modal or navigate to the reservation details page
  }

  loadCalendarData() {
    // In a real application, this would fetch calendar events from the server
    console.log('Loading calendar data for', this.currentDate);
  }

  // Helper method to generate calendar for a specific month
  generateCalendar(year, month) {
    // This would be used to dynamically generate the calendar grid
    console.log(`Generating calendar for ${year}-${month}`);
  }

  // Helper method to add events to calendar
  addEventToCalendar(event) {
    // This would add a new event to the calendar display
    console.log('Adding event to calendar:', event);
  }
}

// Initialize the calendar
const calendar = new Calendar();
