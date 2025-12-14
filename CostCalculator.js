export class CostCalculator {
  constructor() {
    // Calculator for reservation costs
  }

  calculate(costs) {
    // Calculate line item totals
    const flat = costs.flat.qty * costs.flat.rate;
    const hour = costs.hour.qty * costs.hour.rate;
    const unit = costs.unit.qty * costs.unit.rate;
    const ot = costs.ot.qty * costs.ot.rate;
    const stops = costs.stops.qty * costs.stops.rate;
    const pass = costs.pass.qty * costs.pass.rate;
    const mile = costs.mile.qty * costs.mile.rate;
    const admin = costs.admin.qty * costs.admin.rate;

    // Calculate subtotal (before percentages)
    const subtotal = flat + hour + unit + ot + stops + pass + mile + admin;

    // Calculate percentage-based charges
    const gratuity = (subtotal * costs.gratuity) / 100;
    const fuel = (subtotal * costs.fuel) / 100;
    const discount = (subtotal * costs.discount) / 100;
    const surface = (subtotal * costs.surface) / 100;
    const baseRate = (subtotal * costs.baseRate) / 100;

    // Calculate grand total
    // Note: discount is subtracted, others are added
    const grandTotal = subtotal + gratuity + fuel - discount + surface + baseRate;

    return {
      flat,
      hour,
      unit,
      ot,
      stops,
      gratuity,
      fuel,
      discount,
      pass,
      mile,
      surface,
      baseRate,
      admin,
      subtotal,
      grandTotal: Math.max(0, grandTotal) // Ensure non-negative
    };
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  calculateTax(amount, taxRate) {
    return (amount * taxRate) / 100;
  }

  applyDiscount(amount, discountPercent) {
    return amount - (amount * discountPercent) / 100;
  }

  calculateMileageCharge(miles, ratePerMile) {
    return miles * ratePerMile;
  }

  calculateHourlyCharge(hours, hourlyRate, minimumHours = 0) {
    const billableHours = Math.max(hours, minimumHours);
    return billableHours * hourlyRate;
  }

  calculateGratuity(subtotal, gratuityPercent) {
    return (subtotal * gratuityPercent) / 100;
  }
}
