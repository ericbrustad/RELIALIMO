export class UIManager {
  constructor(reservationManager, mapManager) {
    this.reservationManager = reservationManager;
    this.mapManager = mapManager;
    this.currentView = 'userView';
    this.currentFilter = 'all';
  }

  init() {
    // Set initial date/time
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const time = now.toTimeString().slice(0, 5);
    
    document.getElementById('pickupDate').value = today;
    document.getElementById('pickupTime').value = time;
  }

  switchView(viewId) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });

    // Show selected view
    document.getElementById(viewId).classList.add('active');

    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    if (viewId === 'userView') {
      document.getElementById('userViewBtn').classList.add('active');
    } else if (viewId === 'driverView') {
      document.getElementById('driverViewBtn').classList.add('active');
    } else if (viewId === 'reservationsView') {
      document.getElementById('reservationsBtn').classList.add('active');
    } else if (viewId === 'farm-out_reservations_View') {
      document.getElementById('farmOutBtn').classList.add('active');
    }

    this.currentView = viewId;

    // Update maps when switching views
    setTimeout(() => {
      if (viewId === 'userView') {
        this.mapManager.userMap.invalidateSize();
        this.updateUserMap();
      } else if (viewId === 'driverView') {
        this.mapManager.driverMap.invalidateSize();
        this.updateDriverView();
      }
    }, 100);
  }

  updateAllViews() {
    this.updateUserMap();
    this.updateDriverView();
    this.updateReservationsTable();
  }

  updateUserMap() {
    const allReservations = this.reservationManager.getAllReservations();
    this.mapManager.addUserMapMarkers(allReservations);
  }

  updateDriverView() {
    const pendingReservations = this.reservationManager.getReservationsByStatus('pending');
    const container = document.getElementById('availableReservations');

    if (pendingReservations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🚗</div>
          <div class="empty-state-text">No available reservations at the moment</div>
        </div>
      `;
    } else {
      container.innerHTML = pendingReservations.map(reservation => 
        this.createReservationCard(reservation, true)
      ).join('');

      // Add event listeners for accept buttons
      container.querySelectorAll('.btn-success').forEach((btn, index) => {
        btn.addEventListener('click', () => {
          this.handleAcceptReservation(pendingReservations[index].id);
        });
      });

      // Add event listeners for view on map buttons
      container.querySelectorAll('.btn-secondary').forEach((btn, index) => {
        btn.addEventListener('click', () => {
          this.mapManager.focusOnReservation(pendingReservations[index], this.mapManager.driverMap);
        });
      });
    }

    // Update driver map
    const allReservations = this.reservationManager.getAllReservations();
    this.mapManager.addDriverMapMarkers(allReservations);
  }

  createReservationCard(reservation, showAcceptButton = false) {
    return `
      <div class="reservation-card ${reservation.status}">
        <div class="card-header">
          <span class="card-id">Reservation #${reservation.id}</span>
          <span class="status-badge ${reservation.status}">${reservation.status}</span>
        </div>
        <div class="card-body">
          <div class="card-field">
            <span class="field-label">Passenger:</span>
            <span class="field-value">${reservation.passengerName}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Phone:</span>
            <span class="field-value">${reservation.phone}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Pickup:</span>
            <span class="field-value">${reservation.pickupLocation}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Dropoff:</span>
            <span class="field-value">${reservation.dropoffLocation}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Date/Time:</span>
            <span class="field-value">${reservation.pickupDate} ${reservation.pickupTime}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Vehicle:</span>
            <span class="field-value">${this.reservationManager.getVehicleTypeLabel(reservation.vehicleType)}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Passengers:</span>
            <span class="field-value">${reservation.passengers}</span>
          </div>
          ${reservation.specialInstructions ? `
            <div class="card-field">
              <span class="field-label">Instructions:</span>
              <span class="field-value">${reservation.specialInstructions}</span>
            </div>
          ` : ''}
          ${reservation.driverName ? `
            <div class="card-field">
              <span class="field-label">Driver:</span>
              <span class="field-value">${reservation.driverName}</span>
            </div>
          ` : ''}
        </div>
        ${showAcceptButton ? `
          <div class="card-actions">
            <button class="btn btn-success">Accept Reservation</button>
            <button class="btn btn-secondary">View on Map</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  handleAcceptReservation(reservationId) {
    const driverName = prompt('Enter driver name:');
    if (driverName && driverName.trim()) {
      this.reservationManager.acceptReservation(reservationId, driverName.trim());
      this.updateAllViews();
      alert(`Reservation #${reservationId} accepted successfully!`);
    }
  }

  filterReservations(filter) {
    this.currentFilter = filter;
    this.updateReservationsTable();
  }

  updateReservationsTable() {
    // Update both reservation views
    const farmOutContainer = document.getElementById('allReservations');
    const allReservationsContainer = document.getElementById('allReservationsList');
    let reservations;

    if (this.currentFilter === 'all') {
      reservations = this.reservationManager.getAllReservations();
    } else {
      reservations = this.reservationManager.getReservationsByStatus(this.currentFilter);
    }

    // Update farm-out reservations view
    this.updateReservationContainer(farmOutContainer, reservations);
    
    // Update all reservations view (show all reservations)
    const allReservations = this.reservationManager.getAllReservations();
    this.updateReservationContainer(allReservationsContainer, allReservations);
  }

  renderReservationsFromDb(allReservations, farmOutReservations) {
    const allReservationsContainer = document.getElementById('allReservationsList');
    const farmOutContainer = document.getElementById('allReservations');
    this.updateReservationContainer(allReservationsContainer, allReservations || []);
    this.updateReservationContainer(farmOutContainer, farmOutReservations || []);
  }

  updateReservationContainer(container, reservations) {
    if (!container) return;

    if (reservations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">No reservations found</div>
        </div>
      `;
      return;
    }

    // Create table
    let html = `
      <div class="table-row header">
        <div class="table-cell">ID</div>
        <div class="table-cell">Passenger</div>
        <div class="table-cell">Pickup Location</div>
        <div class="table-cell">Dropoff Location</div>
        <div class="table-cell">Date</div>
        <div class="table-cell">Time</div>
        <div class="table-cell">Status</div>
        <div class="table-cell">Driver</div>
      </div>
    `;

    reservations.forEach(reservation => {
      const statusClass = (reservation.status || '').toString().toLowerCase() || 'pending';
      const statusLabel = reservation.statusLabel || reservation.status || '—';

      html += `
        <div class="table-row">
          <div class="table-cell">#${reservation.id}</div>
          <div class="table-cell">${reservation.passengerName}</div>
          <div class="table-cell">${reservation.pickupLocation}</div>
          <div class="table-cell">${reservation.dropoffLocation}</div>
          <div class="table-cell">${reservation.pickupDate}</div>
          <div class="table-cell">${reservation.pickupTime}</div>
          <div class="table-cell">
            <span class="status-badge ${statusClass}">${statusLabel}</span>
          </div>
          <div class="table-cell">${reservation.driverName || '-'}</div>
        </div>
      `;
    });

    container.innerHTML = html;
  }
}
