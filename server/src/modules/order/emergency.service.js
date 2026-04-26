/**
 * Emergency mode — priority booking with a surcharge.
 *
 * Behaviour:
 *   - Applies a 1.5× multiplier on top of the computed quote (before min-fare)
 *   - In dispatch, emergency orders jump to the front of the dispatch queue
 *   - Notification fan-out includes SMS (urgent channel)
 *
 * Pricing impact is computed here (small helper) so pricing.service stays
 * generic. Dispatch ordering is enforced in the queue enqueue (see below).
 */

const EMERGENCY_MULTIPLIER = 1.5;

function applyEmergencySurcharge(quote) {
  const surchargedTotal = Math.round(quote.total * EMERGENCY_MULTIPLIER);
  return {
    ...quote,
    total: surchargedTotal,
    emergencySurcharge: surchargedTotal - quote.total,
    paise: {
      ...quote.paise,
      total: surchargedTotal * 100,
      emergencySurcharge: (surchargedTotal - quote.total) * 100,
    },
    priority: 'emergency',
  };
}

module.exports = { applyEmergencySurcharge, EMERGENCY_MULTIPLIER };
