/**
 * Combo Repair System
 * Book multiple repairs in one visit — customer saves time, worker earns more.
 * Combos get a 15% discount when 2 repairs combined, 20% for 3+.
 *
 * No Indian competitor has in-app combo repair booking.
 * Cashify/iFixit only do one repair per booking.
 */

const COMBO_DISCOUNTS = {
  2: 0.15,  // 15% off total
  3: 0.20,  // 20% off total
};

/* Common repair combos suggested based on statistics */
const POPULAR_COMBOS = [
  {
    id: 'screen_battery',
    label: 'Screen + Battery',
    services: ['screen_replacement', 'battery_replacement'],
    reason: 'Most common — old screen & battery degrade together',
    saveLabel: 'Save 15%',
  },
  {
    id: 'screen_charging',
    label: 'Screen + Charging Port',
    services: ['screen_replacement', 'charging_issue'],
    reason: 'Common after drops — both often damaged',
    saveLabel: 'Save 15%',
  },
  {
    id: 'battery_software',
    label: 'Battery + Software Tune',
    services: ['battery_replacement', 'software_issue'],
    reason: 'Refresh phone performance completely',
    saveLabel: 'Save 15%',
  },
  {
    id: 'screen_battery_charging',
    label: 'Screen + Battery + Charging',
    services: ['screen_replacement', 'battery_replacement', 'charging_issue'],
    reason: 'Complete phone revival',
    saveLabel: 'Save 20%',
  },
];

/**
 * Given selected services, compute combo discount.
 * Returns null if only 1 service selected (no combo).
 */
function computeComboDiscount(services, individualPrices) {
  if (!services || services.length < 2) return null;

  const count   = Math.min(services.length, 3); // cap at 3 for discount
  const rate    = COMBO_DISCOUNTS[count] || COMBO_DISCOUNTS[3];
  const baseTotal = Object.values(individualPrices).reduce((s, p) => s + p, 0);
  const discount  = Math.round(baseTotal * rate);

  return {
    servicesCount:   services.length,
    discountRate:    rate,
    discountPaise:   discount,
    discountRupees:  Math.round(discount / 100),
    baseTotal,
    finalTotal:      baseTotal - discount,
    label:           `${Math.round(rate * 100)}% Combo Discount`,
  };
}

/**
 * Get suggested combos for a given service.
 */
function getSuggestedCombos(service) {
  return POPULAR_COMBOS.filter(c => c.services.includes(service));
}

module.exports = { POPULAR_COMBOS, COMBO_DISCOUNTS, computeComboDiscount, getSuggestedCombos };
