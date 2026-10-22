/**
 * Booking and Payment Business Calculation Service
 * Centralizes financial formulas according to PBGMS SRS (BR-5, BR-6, BR-4)
 */

/**
 * Calculates mandatory deposit based on booking total and configured percentage.
 * @param {number} totalAmount - Total cost of the booking in INR.
 * @param {number} [depositPercentage=20] - Configured deposit percentage (default 20%).
 * @returns {number} The calculated deposit amount in INR.
 * @throws {Error} If totalAmount is negative.
 */
function calculateDeposit(totalAmount, depositPercentage = 20) {
  if (totalAmount < 0) {
    throw new Error('Booking price cannot be negative.');
  }
  if (totalAmount === 0) {
    return 0;
  }
  const pct = depositPercentage !== undefined && depositPercentage !== null ? Number(depositPercentage) : 20;
  return Math.round((totalAmount * (pct / 100)) * 100) / 100;
}

/**
 * Calculates the remaining balance due after considering all verified paid sums.
 * @param {number} totalAmount - Total cost of booking including late checkout fees.
 * @param {number} paidAmount - Total amount already verified and paid.
 * @returns {number} Outstanding balance (minimum 0).
 */
function calculateRemainingBalance(totalAmount, paidAmount) {
  if (totalAmount < 0) {
    throw new Error('Total booking price cannot be negative.');
  }
  const paid = Math.max(0, Number(paidAmount || 0));
  return Math.max(0, Math.round((totalAmount - paid) * 100) / 100);
}

module.exports = {
  calculateDeposit,
  calculateRemainingBalance
};
