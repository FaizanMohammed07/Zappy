/**
 * Zappy Voice — Orchestration
 * ----------------------------------------------------------------------------
 * Runs the conversational tool-calling loop:
 *   user turn → model → (tool calls → execute → feed back)* → final reply.
 *
 * Conversation memory lives client-side as a plain user/assistant transcript
 * sent on every turn. Within a single turn we run a bounded tool loop and also
 * harvest structured "cards" from tool results so the UI can render price / ETA
 * / booking-confirmation widgets instead of just text.
 * ----------------------------------------------------------------------------
 */

const config = require('../../config');
const logger = require('../../utils/logger');
const { chat } = require('./voice.openrouter');
const { TOOL_DEFS, executeTool } = require('./voice.tools');
const User = require('../user/user.model');

const MAX_HISTORY_TURNS = 12;

function buildSystemPrompt({ name, hasLocation, locationLabel, lensScanId }) {
  const istNow = new Date(Date.now() + 330 * 60000).toISOString().replace('T', ' ').slice(0, 16);
  return [
    'You are Zappy Voice, the AI booking concierge for Zappy (on-demand home, vehicle, electronics & family-assist services in India). Users speak to you to book, hands-free.',
    '',
    'STYLE — THIS IS CRITICAL. Your replies are spoken aloud, so be FAST and PUNCHY:',
    '- ONE sentence. Max ~15 words. Never two sentences unless you are both stating a fact AND asking to confirm.',
    '- No greetings, no preamble, no filler ("Sure!", "I can help with that", "Let me...", "Great"). Just answer.',
    '- Never list options or explain your steps. Talk like a quick text reply, not a paragraph.',
    '- Numbers shown as cards — say price/ETA in a few words, do not read out every detail.',
    '',
    'LANGUAGE: reply in the same language the user spoke (English, Hindi, or Telugu). Mirror code-mixing.',
    '',
    'JOB: turn speech into a real booking via tools. Never invent prices, ETAs or confirmations — always from a tool.',
    'FLOW (do it tersely):',
    '1. search_services to map the problem to a real service_code. If genuinely ambiguous, ask ONE 5-word question.',
    '2. estimate_price (and optionally find_nearest_worker).',
    '3. Confirm in ONE line that names the SERVICE, PRICE and LOCATION AREA, then ask to book.',
    `   e.g. "Puncture repair, ₹120, at ${locationLabel || 'your location'} — book it?"`,
    '4. Only after a clear yes, call book_service. Then: "Done — pro on the way." Nothing more.',
    '',
    'LOCATION — handle every case:',
    `- Default booking location is the user's CURRENT location${locationLabel ? ` (${locationLabel})` : ''}. Always name this area in your confirm line so the user can correct it before booking.`,
    '- If the user says "yes / book it / confirm" without naming a place, book at the current location — do NOT pass lat/lng/address, the system uses it automatically.',
    '- If the user names a different place — "at home", "office", "my work", or an area — call get_user_profile to find a matching saved address, then pass that address\'s lat, lng and address to book_service. If none matches and you only have an area name, ask them to share location for that spot.',
    '- If current location is NOT shared and there is no saved address, ask them to share location (or name a saved place) before booking.',
    '',
    'RULES:',
    '- Never book_service or cancel_booking before the user confirms in that turn.',
    '- service_code for estimate_price/book_service MUST come from search_services.',
    '- Stranded/accident/breakdown → priority "emergency".',
    '- Tool returns ok:false → if it has a userMessage, say THAT (almost verbatim). Otherwise state the problem in a few words. Never fake success.',
    '- "repeat last booking" → get_booking_history, confirm in one line, book.',
    '',
    `CONTEXT: User${name ? ` is ${name}` : ''}. Current location: ${hasLocation ? (locationLabel || 'shared (coordinates available)') : 'NOT shared yet'}. Time IST ${istNow}.`,
    lensScanId ? `User just shot a ZappyLens photo (scanId ${lensScanId}). Call get_lens_scan, then quote and offer to book — in one line.` : '',
  ].filter(Boolean).join('\n');
}

/** Sanitise the client-supplied transcript into clean user/assistant turns. */
function normalizeHistory(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

/** Convert a tool name + result into an optional UI card for the client. */
function toCard(name, result) {
  if (!result || result.ok === false) return null;
  switch (name) {
    case 'estimate_price':
      return { type: 'price', service: result.service, totalRupees: result.totalRupees, etaMinutes: result.etaMinutes, surgeMultiplier: result.surgeMultiplier };
    case 'find_nearest_worker':
      return result.available > 0
        ? { type: 'eta', available: result.available, nearestDistanceKm: result.nearestDistanceKm, etaMinutes: result.etaMinutes }
        : null;
    case 'book_service':
      return { type: 'booking', orderId: result.orderId, service: result.service, status: result.status, totalRupees: result.totalRupees, otp: result.otp, scheduledAt: result.scheduledAt };
    case 'track_booking':
      return { type: 'tracking', orderId: result.orderId, service: result.service, status: result.status, workerName: result.workerName, etaMinutes: result.etaMinutes, otp: result.otp };
    case 'get_booking_history':
      return result.orders?.length ? { type: 'history', orders: result.orders } : null;
    case 'get_wallet':
      return { type: 'wallet', balanceRupees: result.balanceRupees };
    default:
      return null;
  }
}

/**
 * Run one assistant turn.
 * @param {object} p
 * @param {string} p.userId
 * @param {Array}  p.messages          client transcript (user/assistant)
 * @param {{lat,lng}|null} [p.location]
 * @param {string} [p.address]
 * @param {string} [p.lensScanId]
 * @returns {{ reply, cards, actions, model }}
 */
async function converse({ userId, messages, location, address, lensScanId }) {
  const started = Date.now();
  const history = normalizeHistory(messages);
  if (!history.length || history[history.length - 1].role !== 'user') {
    throw Object.assign(new Error('The last message must be from the user.'), { status: 400, code: 'BAD_TRANSCRIPT' });
  }

  // Resolve a readable area label ONCE per turn (cached, OSM-backed — works even
  // when the Google key is restricted). Used both to confirm the spot with the
  // user AND as the booking address, so we never book a generic "pinned location".
  let locationLabel = null;
  if (location) {
    try { locationLabel = await require('../worker/maps.service').getZoneLabel(location.lat, location.lng); } catch { /* best-effort */ }
  }

  const user = await User.findById(userId).select('name').lean().catch(() => null);
  const ctx = { userId, location: location || null, address: address || locationLabel || null, locationLabel };

  const convo = [
    { role: 'system', content: buildSystemPrompt({ name: user?.name, hasLocation: !!location, locationLabel, lensScanId }) },
    ...history,
  ];

  const cards = [];
  const actions = [];
  let finalText = '';
  let modelUsed = config.voice.model;

  try {
  for (let round = 0; round < config.voice.maxToolRounds; round++) {
    const { message, model } = await chat({ messages: convo, tools: TOOL_DEFS });
    modelUsed = model;

    const toolCalls = message.tool_calls || [];
    if (!toolCalls.length) {
      finalText = (message.content || '').trim();
      break;
    }

    // Persist the assistant tool-call message, then run the requested tools
    // CONCURRENTLY (e.g. estimate_price + find_nearest_worker in one round) so a
    // multi-tool turn costs one tool latency, not the sum. Order is preserved.
    convo.push({ role: 'assistant', content: message.content || '', tool_calls: toolCalls });

    const results = await Promise.all(toolCalls.map((call) => {
      let args = {};
      try { args = JSON.parse(call.function?.arguments || '{}'); } catch { args = {}; }
      return executeTool({ name: call.function?.name, args, ctx });
    }));

    toolCalls.forEach((call, i) => {
      const name = call.function?.name;
      const result = results[i];
      if (result && result.ok === false) {
        logger.info({ userId, tool: name, code: result.code, err: result.error }, 'Zappy Voice tool returned ok:false');
      }
      const card = toCard(name, result);
      if (card) cards.push(card);
      if (name === 'book_service' && result.ok && result.orderId) {
        actions.push({ type: 'navigate', label: 'Track booking', to: `/orders/${result.orderId}` });
      }
      convo.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, 4000) });
    });
  }

  if (!finalText) {
    // Ran out of tool rounds without a final natural-language reply — ask the model
    // once more with tools disabled so it must produce text.
    const { message } = await chat({ messages: convo, tools: [], toolChoice: 'none' });
    finalText = (message.content || '').trim();
  }
  } catch (err) {
    // Model unreachable / out of credits / bad key / timeout. Degrade to a spoken
    // message instead of a 5xx so the UI stays usable — and log clearly so the
    // operator knows to fund or fix the OpenRouter key.
    const UPSTREAM = { VOICE_NO_CREDITS: 1, VOICE_BAD_KEY: 1, VOICE_UPSTREAM: 1, VOICE_TIMEOUT: 1, VOICE_DISABLED: 1 };
    if (UPSTREAM[err.code]) {
      logger.warn({ userId, code: err.code, detail: err.detail }, 'Zappy Voice upstream unavailable — degrading');
      const reply = err.code === 'VOICE_NO_CREDITS' || err.code === 'VOICE_BAD_KEY' || err.code === 'VOICE_DISABLED'
        ? "Voice assistant isn't set up yet on this account. Please add an AI key, then try again."
        : "I'm having trouble reaching the assistant right now. Please try again in a moment.";
      return { reply, cards, actions, model: modelUsed, degraded: err.code };
    }
    throw err; // genuine bug — let the error handler surface it
  }
  if (!finalText) finalText = "Sorry, I didn't quite catch that. Could you say it again?";

  logger.info({ userId, rounds: cards.length, ms: Date.now() - started, model: modelUsed }, 'Zappy Voice turn complete');
  return { reply: finalText, cards, actions, model: modelUsed };
}

module.exports = { converse };
