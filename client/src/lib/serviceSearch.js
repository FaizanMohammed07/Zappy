// Smart, intent-aware service search.
// Handles natural phrases like "book puncture", "I need a plumber",
// "my phone screen is broken" by stripping command/filler words, expanding
// synonyms, and ranking catalog matches — so the user always sees a result.

// Words that carry no service meaning (commands, fillers, grammar).
const STOPWORDS = new Set([
  'book', 'booking', 'need', 'needed', 'want', 'wanted', 'get', 'getting', 'a', 'an', 'the',
  'please', 'pls', 'for', 'me', 'my', 'i', 'to', 'can', 'could', 'you', 'find', 'some', 'someone',
  'service', 'services', 'near', 'nearby', 'around', 'at', 'home', 'house', 'guy', 'person', 'help',
  'with', 'of', 'do', 'does', 'is', 'are', 'any', 'show', 'order', 'fix', 'fixing', 'repairing',
  'it', 'and', 'call', 'now', 'today', 'urgent', 'urgently', 'asap', 'broke', 'broken', 'not',
  'working', 'issue', 'issues', 'problem', 'problems', 'wala', 'wale',
]);

// Spoken/typed term → catalog keyword(s). Maps everyday language to the words
// that actually appear in service names / codes / descriptions.
const SYNONYMS = {
  // vehicle
  tyre: 'puncture', tire: 'puncture', flat: 'puncture', wheel: 'puncture', tube: 'puncture',
  bike: 'bike', motorcycle: 'bike', motorbike: 'bike', scooter: 'bike', scooty: 'bike', activa: 'bike',
  car: 'car', vehicle: 'car', auto: 'car', four: 'car',
  wash: 'wash', cleaning: 'wash', clean: 'wash', detailing: 'detailing',
  fuel: 'fuel', petrol: 'fuel', diesel: 'fuel', gas: 'fuel',
  breakdown: 'breakdown', tow: 'breakdown', towing: 'breakdown', jumpstart: 'jump', jump: 'jump',
  chain: 'chain', brake: 'brake', brakes: 'brake',
  // mobile
  phone: 'screen', mobile: 'screen', cellphone: 'screen', smartphone: 'screen', cell: 'screen',
  iphone: 'screen', android: 'screen', display: 'screen', glass: 'screen', touch: 'screen',
  // laptop / computer
  laptop: 'laptop', computer: 'laptop', notebook: 'laptop', macbook: 'laptop', pc: 'laptop',
  ssd: 'ssd', ram: 'ram', virus: 'virus', keyboard: 'keyboard', motherboard: 'motherboard',
  slow: 'slow', hang: 'slow', hanging: 'slow',
  // power / battery / charging (shared)
  battery: 'battery', charging: 'charging', charger: 'charging', charge: 'charging',
  // smart devices
  tv: 'tv', television: 'tv', led: 'tv',
  cctv: 'cctv', camera: 'cctv', surveillance: 'cctv', security: 'cctv',
  wifi: 'router', internet: 'router', router: 'router', network: 'router',
  lock: 'lock', automation: 'automation', smart: 'smart',
  // home / trades
  electrician: 'electric', electrical: 'electric', wiring: 'electric', current: 'electric',
  power: 'electric', short: 'electric', circuit: 'electric', mcb: 'electric', switchboard: 'electric',
  fan: 'fan', light: 'light', bulb: 'light', switch: 'switch', socket: 'switch',
  plumber: 'plumb', plumbing: 'plumb', pipe: 'plumb', tap: 'plumb', leak: 'plumb', leakage: 'plumb',
  drain: 'plumb', tank: 'plumb', toilet: 'plumb', bathroom: 'plumb',
  carpenter: 'carpenter', wood: 'carpenter', furniture: 'carpenter', door: 'carpenter', wardrobe: 'carpenter',
  // pets
  pet: 'pet', dog: 'pet', cat: 'pet', puppy: 'pet', grooming: 'grooming', groom: 'grooming',
  walking: 'walk', walk: 'walk',
  // elder / family
  elder: 'elder', elderly: 'elder', senior: 'elder', oldage: 'elder', grandfather: 'elder',
  grandmother: 'elder', parent: 'elder', medicine: 'medicine', hospital: 'hospital', grocery: 'grocery',
  // events
  party: 'event', birthday: 'event', decoration: 'event', decor: 'event', event: 'event',
  wedding: 'event', anniversary: 'event', balloon: 'event', celebration: 'event',
  // ac / appliances
  ac: 'ac', cooler: 'ac', aircon: 'ac', airconditioner: 'ac', fridge: 'fridge', refrigerator: 'fridge',
  washing: 'washing', geyser: 'geyser', microwave: 'microwave',
};

function tokenize(raw) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Turn a raw phrase into a deduped set of meaningful keywords (+ synonyms).
export function expandQuery(raw) {
  const toks = tokenize(raw).filter((t) => !STOPWORDS.has(t));
  const out = new Set();
  for (const t of toks) {
    out.add(t);
    if (SYNONYMS[t]) out.add(SYNONYMS[t]);
    // naive singularize: "phones" -> "phone"
    if (t.length > 3 && t.endsWith('s')) {
      const sing = t.slice(0, -1);
      out.add(sing);
      if (SYNONYMS[sing]) out.add(SYNONYMS[sing]);
    }
  }
  return [...out];
}

function scoreService(s, keywords) {
  const name = (s.name || '').toLowerCase();
  const code = (s.code || '').toLowerCase().replace(/_/g, ' ');
  const desc = (s.description || '').toLowerCase();
  const cat = (s.category || '').toLowerCase();
  let score = 0;
  for (const k of keywords) {
    if (!k) continue;
    if (name.includes(k)) score += 10;
    if (code.includes(k)) score += 8;
    if (cat.includes(k)) score += 4;
    if (desc.includes(k)) score += 2;
  }
  return score;
}

/**
 * Returns services matching the phrase, ranked by relevance (best first).
 * Empty array means no confident match — callers should fall back to showing
 * everything rather than a dead-end "No services found".
 */
export function searchServices(services, raw) {
  const keywords = expandQuery(raw);
  if (!keywords.length) return services;
  return services
    .map((s) => ({ s, score: scoreService(s, keywords) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}
