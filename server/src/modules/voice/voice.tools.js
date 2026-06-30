/**
 * Zappy Voice — Tool layer
 * ----------------------------------------------------------------------------
 * The AI never touches data directly. It calls these tools, which are thin
 * wrappers over the EXISTING booking / pricing / worker / wallet services. No
 * business logic is duplicated here — every tool delegates to the same code the
 * REST controllers use, so prices, abuse gates, one-active-order rules, shield
 * fees etc. all apply identically.
 *
 * Each implementation returns a plain JSON-serialisable object. Errors are
 * caught and returned as { ok:false, error, code } so the model can explain the
 * problem conversationally instead of the turn blowing up.
 * ----------------------------------------------------------------------------
 */

const logger = require('../../utils/logger');
const ServiceCatalog = require('../service/service-catalog.model');
const pricingService = require('../pricing/pricing.service');
const geoService = require('../worker/geo.service');
const mapsService = require('../worker/maps.service');
const orderService = require('../order/order.service');
const orderRepo = require('../order/order.repository');
const walletService = require('../wallet/wallet.service');
const promoService = require('../promo/promo.service');
const User = require('../user/user.model');
const Worker = require('../worker/worker.model');

const ASSUMED_SPEED_KMPH = 22; // urban two-wheeler average, used for rough voice ETAs

// ── Tool definitions (OpenAI / OpenRouter `tools` schema) ────────────────────

const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'search_services',
      description:
        'Find Zappy services that match what the user described (e.g. "punctured bike", "AC not cooling", "cracked phone screen"). Returns matching service codes you MUST use verbatim for pricing and booking. Always call this to resolve the user\'s intent into a real service before quoting or booking.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Plain-language description of the problem or service.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'estimate_price',
      description:
        'Get a real price quote and ETA for a service at the user\'s location. Uses the live pricing engine (surge, distance, service rates). Call before confirming a booking so you can tell the user the price.',
      parameters: {
        type: 'object',
        properties: {
          service: { type: 'string', description: 'A service_code from search_services, verbatim.' },
          priority: { type: 'string', enum: ['normal', 'emergency'], description: 'Use "emergency" for urgent roadside/breakdown situations.' },
          lat: { type: 'number' },
          lng: { type: 'number' },
        },
        required: ['service'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_nearest_worker',
      description:
        'Check how many service pros are available near the user and the soonest realistic arrival time. Use to reassure the user before booking. Does not assign anyone — assignment happens automatically after booking.',
      parameters: {
        type: 'object',
        properties: {
          service: { type: 'string', description: 'A service_code, verbatim (optional — filters by skill).' },
          lat: { type: 'number' },
          lng: { type: 'number' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_service',
      description:
        'Place a real booking. ONLY call this AFTER the user has explicitly confirmed they want to book (e.g. they said "yes", "book it", "confirm"). Never book speculatively. The correct worker is dispatched automatically.',
      parameters: {
        type: 'object',
        properties: {
          service: { type: 'string', description: 'A service_code from search_services, verbatim.' },
          priority: { type: 'string', enum: ['normal', 'emergency'] },
          paymentMethod: { type: 'string', enum: ['cash', 'upi', 'card'] },
          description: { type: 'string', description: 'Short note describing the issue for the worker.' },
          scheduledAt: { type: 'string', description: 'ISO-8601 datetime for a future booking. Omit for "book now".' },
          deviceBrand: { type: 'string', enum: ['Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Vivo', 'Oppo', 'Others'], description: 'Mobile/phone services only.' },
          vehicleType: { type: 'string', enum: ['bike', 'scooter', 'car'], description: 'Vehicle services only.' },
          lat: { type: 'number' },
          lng: { type: 'number' },
          address: { type: 'string', description: 'Human-readable pickup address. If omitted it is resolved from the coordinates.' },
        },
        required: ['service'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'track_booking',
      description: 'Get the live status, assigned worker and ETA of an order. If orderId is omitted, the user\'s most recent active order is used.',
      parameters: {
        type: 'object',
        properties: { orderId: { type: 'string' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_booking',
      description: 'Cancel an order. If orderId is omitted, the user\'s most recent active order is cancelled. A cancellation fee may apply per policy. Confirm with the user before calling.',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_booking_history',
      description: 'List the user\'s recent bookings (service, status, amount, date). Use for "repeat my last booking", "what did I book", "my booking status".',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'How many recent orders (default 5, max 10).' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_wallet',
      description: 'Get the user\'s Zappy wallet balance.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_coupon',
      description: 'Validate a promo/coupon code and return the discount it would give for a service. Does not place an order.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          service: { type: 'string', description: 'service_code the coupon would apply to (optional).' },
          orderTotalRupees: { type: 'number', description: 'The quoted total in rupees, to compute the discount.' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_profile',
      description: 'Get the user\'s name and saved addresses (home/work). Use to pick a booking location when the user says "at home" or to greet them.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_lens_scan',
      description: 'Read a ZappyLens visual scan the user just captured with their camera. Returns the detected problem and matching service codes so you can quote and book from a photo.',
      parameters: {
        type: 'object',
        properties: { scanId: { type: 'string' } },
        required: ['scanId'],
      },
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve a usable {lat,lng,address}: explicit args → request location → user default address. */
async function resolveLocation(args, ctx) {
  if (args.lat != null && args.lng != null) {
    return { lat: Number(args.lat), lng: Number(args.lng), address: args.address || ctx.address || null };
  }
  if (ctx.location?.lat != null && ctx.location?.lng != null) {
    return { lat: ctx.location.lat, lng: ctx.location.lng, address: args.address || ctx.address || null };
  }
  // Fall back to the user's default saved address.
  const user = await User.findById(ctx.userId).select('savedAddresses').lean();
  const saved = user?.savedAddresses || [];
  const chosen = saved.find((a) => a.isDefault) || saved[0];
  if (chosen?.location?.coordinates?.length === 2) {
    const [lng, lat] = chosen.location.coordinates;
    return { lat, lng, address: chosen.address || args.address || null };
  }
  return null;
}

async function isValidService(code) {
  if (!code) return false;
  const doc = await ServiceCatalog.findOne({ code: String(code).toLowerCase(), isActive: true }).select('_id').lean();
  return !!doc;
}

/**
 * Resolve whatever the model passed (exact code, or a loose name like
 * "car puncture") into a real, active catalog code. Returns the code or null.
 * Makes booking forgiving when the model doesn't echo the code verbatim.
 */
async function resolveServiceCode(input) {
  if (!input) return null;
  const raw = String(input).toLowerCase().trim();
  // 1) exact code
  const exact = await ServiceCatalog.findOne({ code: raw, isActive: true }).select('code').lean();
  if (exact) return exact.code;
  // 2) "car puncture" → "car_puncture"
  const underscored = raw.replace(/\s+/g, '_');
  const us = await ServiceCatalog.findOne({ code: underscored, isActive: true }).select('code').lean();
  if (us) return us.code;
  // 3) fuzzy by name/code tokens
  const docs = await ServiceCatalog.find({ isActive: true }).select('code name').lean();
  const terms = raw.split(/\s+/).filter(Boolean);
  let best = null, bestScore = 0;
  for (const d of docs) {
    const hay = `${d.code} ${d.name}`.toLowerCase();
    let score = 0;
    for (const t of terms) if (hay.includes(t)) score += 1;
    if (score > bestScore) { bestScore = score; best = d.code; }
  }
  return bestScore >= Math.max(1, terms.length) ? best : null; // require all terms to match
}

// createOrder/cancel error codes → short, ready-to-speak messages.
const BOOK_ERROR_MESSAGES = {
  ACTIVE_ORDER_EXISTS: 'You already have an active booking — finish or cancel it first.',
  NO_WORKERS_IN_AREA:  'No pros are available in your area right now.',
  QUEUE_AT_CAPACITY:   "We're at capacity — try again in a minute.",
  PRICING_TIMEOUT:     'Pricing timed out — try once more.',
  ORDER_CREATE_IN_PROGRESS: 'A booking is already going through — one sec.',
};

function orderSummary(o) {
  return {
    orderId: String(o._id),
    service: o.service,
    status: o.status,
    totalRupees: o.pricing?.total ?? null,
    scheduledAt: o.scheduledAt || null,
    createdAt: o.createdAt,
  };
}

// ── Implementations ──────────────────────────────────────────────────────────

async function search_services({ query }) {
  const docs = await ServiceCatalog.find({ isActive: true })
    .select('code name category description priceRangeMinPaise priceRangeMaxPaise estimatedDurationMinutes')
    .lean();

  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const scored = docs.map((d) => {
    const hay = `${d.code} ${d.name} ${d.category} ${d.description || ''}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (hay.includes(t)) score += 2;
      if (d.code.includes(t) || d.name.toLowerCase().includes(t)) score += 1;
    }
    return { d, score };
  });
  const matches = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ d }) => ({
      service_code: d.code,
      name: d.name,
      category: d.category,
      priceHintMin: Math.round((d.priceRangeMinPaise || 0) / 100),
      priceHintMax: Math.round((d.priceRangeMaxPaise || 0) / 100),
      durationMinutes: d.estimatedDurationMinutes,
    }));

  return { ok: true, count: matches.length, matches };
}

async function estimate_price({ service, priority, lat, lng }, ctx) {
  if (!(await isValidService(service))) {
    return { ok: false, code: 'UNKNOWN_SERVICE', error: `"${service}" is not a bookable service. Call search_services first.` };
  }
  const loc = await resolveLocation({ lat, lng }, ctx);
  if (!loc) {
    return { ok: false, code: 'NO_LOCATION', error: 'I need your location to price this. Ask the user for their area or to share location.' };
  }
  const quote = await pricingService.quote({
    origin: { lat: loc.lat, lng: loc.lng },
    dest: { lat: loc.lat + 0.00045, lng: loc.lng }, // ~50m nominal, same as booking
    service,
    userId: ctx.userId,
    priority: priority === 'emergency' ? 'emergency' : 'normal',
  });
  return {
    ok: true,
    service,
    totalRupees: quote.total ?? null,
    currency: quote.currency || 'INR',
    etaMinutes: quote.etaMinutes ?? null,
    surgeMultiplier: quote.surgeMultiplier ?? null,
  };
}

async function find_nearest_worker({ service, lat, lng }, ctx) {
  const loc = await resolveLocation({ lat, lng }, ctx);
  if (!loc) {
    return { ok: false, code: 'NO_LOCATION', error: 'I need the user\'s location to find nearby pros.' };
  }
  const nearby = await geoService.findNearbyWorkers({ lat: loc.lat, lng: loc.lng, radiusKm: 8, limit: 25 });
  if (!nearby.length) {
    return { ok: true, available: 0, message: 'No pros are online very close right now, but a booking still searches a wider area.' };
  }
  const nearest = nearby[0];
  const etaMinutes = Math.max(4, Math.round((nearest.distanceKm / ASSUMED_SPEED_KMPH) * 60) + 3); // +3 min handling
  return {
    ok: true,
    available: nearby.length,
    nearestDistanceKm: Number(nearest.distanceKm.toFixed(1)),
    etaMinutes,
    serviceFilterApplied: false, // proximity only; skill-matched assignment happens at dispatch
  };
}

async function book_service(args, ctx) {
  const { priority, paymentMethod, description, scheduledAt, deviceBrand, vehicleType } = args;
  const service = await resolveServiceCode(args.service);
  if (!service) {
    return { ok: false, code: 'UNKNOWN_SERVICE', userMessage: "I couldn't pin the exact service — tell me again what you need.", error: `"${args.service}" did not resolve to a catalog service. Call search_services and use the returned code.` };
  }
  const loc = await resolveLocation(args, ctx);
  if (!loc) {
    return { ok: false, code: 'NO_LOCATION', userMessage: 'Share your location or area and I\'ll book it.', error: 'No coordinates in request and no saved address.' };
  }

  // Resolve a human-readable address. Priority: a place the user named / a saved
  // address (loc.address) → an OSM-backed area label for the GPS pin → coords.
  // getZoneLabel works without the Google key, so we never store a useless
  // "pinned location" string.
  let address = loc.address;
  if (!address) {
    try { address = await mapsService.getZoneLabel(loc.lat, loc.lng); } catch { /* best-effort */ }
    if (!address) address = `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
  }

  try {
    const order = await orderService.createOrder({
      userId: ctx.userId,
      service,
      pickupLocation: { lat: loc.lat, lng: loc.lng, address: String(address).slice(0, 500) },
      description: (description || '').slice(0, 500),
      images: [],
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      paymentMethod: ['cash', 'upi', 'card'].includes(paymentMethod) ? paymentMethod : 'upi',
      priority: priority === 'emergency' ? 'emergency' : 'normal',
      ...(deviceBrand ? { deviceBrand } : {}),
      ...(vehicleType ? { vehicleType } : {}),
      tier: 'standard',
    });
    return {
      ok: true,
      orderId: String(order._id),
      service: order.service,
      status: order.status,
      totalRupees: order.pricing?.total ?? null,
      otp: order.otp || null,
      scheduledAt: order.scheduledAt || null,
      message: 'Booking placed. A nearby pro is being assigned.',
    };
  } catch (err) {
    logger.warn({ err: err.message, code: err.code, userId: ctx.userId }, 'Voice book_service failed');
    return {
      ok: false,
      code: err.code || 'BOOK_FAILED',
      userMessage: BOOK_ERROR_MESSAGES[err.code] || 'Booking didn\'t go through — try again.',
      error: err.message || 'Booking failed.',
      ...(err.activeOrderId ? { activeOrderId: String(err.activeOrderId) } : {}),
    };
  }
}

async function track_booking({ orderId }, ctx) {
  let order;
  if (orderId) {
    order = await orderRepo.findByIdWithOtp(orderId);
    if (!order || String(order.userId) !== String(ctx.userId)) {
      return { ok: false, code: 'NOT_FOUND', error: 'No such order for this user.' };
    }
  } else {
    order = await orderRepo.findActiveByUser(ctx.userId);
    if (!order) return { ok: false, code: 'NO_ACTIVE', error: 'The user has no active booking right now.' };
  }

  let workerName = null;
  if (order.workerId) {
    const w = await Worker.findById(order.workerId).select('name').lean();
    workerName = w?.name || null;
  }
  const etaMinutes = order.pricing?.etaMinutes ?? null;

  return {
    ok: true,
    orderId: String(order._id),
    service: order.service,
    status: order.status,
    workerName,
    etaMinutes,
    totalRupees: order.pricing?.total ?? null,
    otp: order.otp || null,
    scheduledAt: order.scheduledAt || null,
  };
}

async function cancel_booking({ orderId, reason }, ctx) {
  let id = orderId;
  if (!id) {
    const active = await orderRepo.findActiveByUser(ctx.userId);
    if (!active) return { ok: false, code: 'NO_ACTIVE', error: 'The user has no active booking to cancel.' };
    id = String(active._id);
  }
  try {
    await orderService.cancelByUser({ orderId: id, userId: ctx.userId, reason: reason || 'cancelled_via_voice' });
    return { ok: true, orderId: id, message: 'Booking cancelled.' };
  } catch (err) {
    return { ok: false, code: err.code || 'CANCEL_FAILED', error: err.message || 'Could not cancel.' };
  }
}

async function get_booking_history({ limit }, ctx) {
  const n = Math.min(Math.max(Number(limit) || 5, 1), 10);
  const [orders] = await orderService.listByUser(ctx.userId, { page: 1, limit: n });
  return { ok: true, count: orders.length, orders: orders.map(orderSummary) };
}

async function get_wallet(_args, ctx) {
  const { balancePaise, currency } = await walletService.getBalance({ kind: 'user', id: ctx.userId });
  return { ok: true, balanceRupees: Math.round((balancePaise || 0) / 100), currency: currency || 'INR' };
}

async function apply_coupon({ code, service, orderTotalRupees }, ctx) {
  try {
    const orderTotalPaise = orderTotalRupees != null ? Math.round(Number(orderTotalRupees) * 100) : 0;
    const result = await promoService.validate({ code, userId: ctx.userId, orderTotalPaise, service });
    return {
      ok: true,
      code,
      discountRupees: result.discountPaise != null ? Math.round(result.discountPaise / 100) : null,
      description: result.description || null,
    };
  } catch (err) {
    return { ok: false, code: 'INVALID_COUPON', error: err.message || 'That coupon is not valid.' };
  }
}

async function get_user_profile(_args, ctx) {
  const user = await User.findById(ctx.userId).select('name savedAddresses').lean();
  if (!user) return { ok: false, code: 'NOT_FOUND', error: 'User not found.' };
  const addresses = (user.savedAddresses || []).map((a) => ({
    label: a.label || a.tag || 'address',
    tag: a.tag,
    address: a.address,
    lat: a.location?.coordinates?.[1] ?? null,
    lng: a.location?.coordinates?.[0] ?? null,
    isDefault: !!a.isDefault,
  }));
  return { ok: true, name: user.name || null, addresses };
}

async function get_lens_scan({ scanId }, ctx) {
  const lensService = require('../lens/lens.service');
  const scan = await lensService.getScan({ scanId, userId: ctx.userId });
  if (!scan) return { ok: false, code: 'NOT_FOUND', error: 'No such scan for this user.' };
  return {
    ok: true,
    scanId: String(scan._id || scanId),
    detectedObject: scan.detectedObject || null,
    isServiceable: !!scan.isServiceable,
    matches: (scan.matches || []).map((m) => ({
      service_code: m.serviceCode,
      name: m.name,
      issueSummary: m.issueSummary,
      severity: m.severity,
    })),
  };
}

const IMPLS = {
  search_services,
  estimate_price,
  find_nearest_worker,
  book_service,
  track_booking,
  cancel_booking,
  get_booking_history,
  get_wallet,
  apply_coupon,
  get_user_profile,
  get_lens_scan,
};

/** Dispatch one tool call. Always resolves to a JSON-serialisable result. */
async function executeTool({ name, args, ctx }) {
  const impl = IMPLS[name];
  if (!impl) return { ok: false, code: 'UNKNOWN_TOOL', error: `Unknown tool: ${name}` };
  try {
    return await impl(args || {}, ctx);
  } catch (err) {
    logger.warn({ err: err.message, tool: name }, 'Voice tool execution error');
    return { ok: false, code: err.code || 'TOOL_ERROR', error: err.message || 'Tool failed.' };
  }
}

module.exports = { TOOL_DEFS, executeTool };
