/**
 * Search engine — tokenization, intent/synonym expansion, typo tolerance, and
 * a single tiered scoring function. Pure functions, no I/O — fed a prebuilt
 * corpus by search.corpus.js and called by search.service.js.
 *
 * Design goals: sub-millisecond per query over a few-hundred-entry corpus,
 * Zepto-style "always understand, never dead-end".
 */

// Command/filler words that carry no service meaning.
const STOPWORDS = new Set([
  'book', 'booking', 'need', 'needed', 'want', 'wanted', 'get', 'getting', 'a', 'an', 'the',
  'please', 'pls', 'for', 'me', 'my', 'i', 'to', 'can', 'could', 'you', 'find', 'some', 'someone',
  'service', 'services', 'near', 'nearby', 'around', 'at', 'home', 'house', 'guy', 'person', 'help',
  'with', 'of', 'do', 'does', 'is', 'are', 'any', 'show', 'order', 'fix', 'fixing', 'repairing',
  'it', 'and', 'call', 'now', 'today', 'urgent', 'urgently', 'asap', 'broke', 'broken', 'not',
  'working', 'issue', 'issues', 'problem', 'problems', 'wala', 'wale', 'wont', 'cant', 'in',
]);

// Everyday term → canonical keyword(s) that appear in service names/codes.
const SYNONYMS = {
  tyre: 'puncture', tire: 'puncture', flat: 'puncture', wheel: 'puncture', tube: 'puncture',
  bike: 'bike', motorcycle: 'bike', motorbike: 'bike', scooter: 'bike', scooty: 'bike', activa: 'bike',
  car: 'car', vehicle: 'car', auto: 'car', four: 'car',
  wash: 'wash', clean: 'wash', cleaning: 'wash', detailing: 'detailing',
  fuel: 'fuel', petrol: 'fuel', diesel: 'fuel', gas: 'fuel',
  breakdown: 'breakdown', tow: 'towing', towing: 'towing', jumpstart: 'jump', jump: 'jump',
  chain: 'chain', brake: 'brake', brakes: 'brake',
  phone: 'phone', mobile: 'phone', cellphone: 'phone', smartphone: 'phone', cell: 'phone',
  iphone: 'phone', android: 'phone', display: 'screen', glass: 'screen', touch: 'screen',
  laptop: 'laptop', computer: 'laptop', notebook: 'laptop', macbook: 'laptop', pc: 'laptop',
  ssd: 'ssd', ram: 'ram', virus: 'virus', keyboard: 'keyboard', motherboard: 'motherboard',
  slow: 'slow', hang: 'slow', hanging: 'slow',
  battery: 'battery', charging: 'charging', charger: 'charging', charge: 'charging',
  tv: 'tv', television: 'tv', led: 'tv',
  cctv: 'cctv', surveillance: 'cctv', security: 'cctv',
  wifi: 'router', internet: 'router', router: 'router', network: 'router',
  lock: 'lock', automation: 'automation', smart: 'smart',
  electrician: 'electrical', electric: 'electrical', electrical: 'electrical', wiring: 'electrical',
  current: 'electrical', short: 'electrical', circuit: 'electrical', mcb: 'electrical', switchboard: 'electrical',
  fan: 'electrical', light: 'electrical', bulb: 'electrical', switch: 'electrical', socket: 'electrical',
  plumber: 'plumbing', plumbing: 'plumbing', pipe: 'plumbing', tap: 'plumbing', leak: 'plumbing',
  leakage: 'plumbing', drain: 'plumbing', toilet: 'plumbing', bathroom: 'plumbing', sink: 'plumbing',
  carpenter: 'carpenter', wood: 'carpenter', furniture: 'carpenter', door: 'carpenter', wardrobe: 'carpenter',
  paint: 'painting', painting: 'painting', painter: 'painting',
  mason: 'mason', cement: 'mason', wall: 'mason', tiles: 'mason', construction: 'mason',
  pet: 'pet', dog: 'pet', cat: 'pet', puppy: 'pet', grooming: 'grooming', groom: 'grooming', walking: 'walk',
  elder: 'elder', elderly: 'elder', senior: 'elder', oldage: 'elder', grandfather: 'elder',
  grandmother: 'elder', parent: 'elder', medicine: 'medicine', hospital: 'hospital', grocery: 'grocery',
  party: 'event', birthday: 'event', decoration: 'event', decor: 'event', event: 'event',
  wedding: 'event', anniversary: 'event', balloon: 'event', celebration: 'event',
  ac: 'ac', cooler: 'ac', aircon: 'ac', airconditioner: 'ac',
  tank: 'tank', sump: 'tank', water: 'water',
};

/**
 * Intent phrases → the keywords a natural-language complaint should surface.
 * Matched as ordered substrings against the raw (lowercased) query so
 * "my bike won't start" → bike + battery + towing.
 */
const INTENTS = [
  { phrases: ["won't start", 'wont start', 'not starting', 'not turning on', 'dead battery'], keywords: ['battery', 'jump', 'breakdown', 'towing'] },
  { phrases: ['not cooling', 'no cooling', 'ac not working', 'ac repair', 'gas filling'], keywords: ['ac'] },
  { phrases: ['tyre burst', 'tire burst', 'flat tyre', 'flat tire', 'puncture'], keywords: ['puncture', 'towing'] },
  { phrases: ['no power', 'power gone', 'short circuit', 'sparking', 'shock'], keywords: ['electrical'] },
  { phrases: ['water leak', 'pipe leak', 'tap leak', 'clogged', 'blockage'], keywords: ['plumbing'] },
  { phrases: ['screen broken', 'screen crack', 'cracked screen', 'broken display'], keywords: ['screen', 'phone'] },
  { phrases: ['need decoration', 'birthday party', 'wedding setup', 'event tomorrow'], keywords: ['event'] },
  { phrases: ['water tank', 'tank cleaning', 'sump cleaning'], keywords: ['tank', 'water'] },
  { phrases: ['stuck on road', 'car stopped', 'vehicle stopped', 'engine problem'], keywords: ['breakdown', 'towing'] },
];

function tokenize(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Bounded Damerau-Levenshtein — returns edit distance, early-exits past `max`.
function editDistance(a, b, max = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const al = a.length, bl = b.length;
  let prev = new Array(bl + 1);
  let curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      // transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        curr[j] = Math.min(curr[j], prev[j - 1] + cost); // approx (prev-prev)
      }
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}

// True when `token` fuzzily matches `term` (short words need exactness).
function fuzzyEq(token, term) {
  return fuzzyTier(token, term) > 0;
}

// Graded fuzzy match: closer edits score higher so `punctr`→puncture clearly
// beats an incidental 2-edit collision. Returns a 0..0.7 tier (0 = no match).
function fuzzyTier(token, term) {
  if (token === term) return 0.7;
  if (term.includes(token) && token.length >= 4) return 0.6;   // strong substring
  const maxDist = token.length <= 4 ? 1 : 2;
  const d = editDistance(token, term, maxDist);
  if (d > maxDist) return 0;
  return d === 1 ? 0.6 : 0.4;                                    // 1-edit strong, 2-edit weaker
}

/**
 * Expand a raw phrase into a de-duped keyword set: meaningful tokens + their
 * synonyms + naive singular + any triggered intent keywords.
 */
function expandQuery(raw) {
  const toks = tokenize(raw).filter((t) => !STOPWORDS.has(t));
  const out = new Set();
  for (const t of toks) {
    out.add(t);
    if (SYNONYMS[t]) out.add(SYNONYMS[t]);
    if (t.length > 3 && t.endsWith('s')) {
      const sing = t.slice(0, -1);
      out.add(sing);
      if (SYNONYMS[sing]) out.add(SYNONYMS[sing]);
    }
  }
  const lower = String(raw || '').toLowerCase();
  for (const intent of INTENTS) {
    if (intent.phrases.some((p) => lower.includes(p))) {
      intent.keywords.forEach((k) => out.add(k));
    }
  }
  return { keywords: [...out], tokens: toks };
}

/**
 * Tiered text score for one corpus entry against the expanded keywords.
 * Returns { text, matched } where text is 0..1-ish tier weight (pre-ranking).
 */
function textScore(entry, keywords, tokens) {
  const name = entry._name;                     // lowercased once at build time
  const code = entry._code;
  const nameTerms = entry._nameTerms || entry._terms; // strong signal (title/code)
  const terms = entry._terms;                   // recall signal (desc/skills/aliases)
  let best = 0;
  let matched = false;

  // Whole-query prefix/substring against the display name (strongest signal).
  const joined = tokens.join(' ');
  if (joined) {
    if (name === joined) { best = Math.max(best, 1.0); matched = true; }
    else if (name.startsWith(joined)) { best = Math.max(best, 0.9); matched = true; }
    else if (name.includes(joined)) { best = Math.max(best, 0.75); matched = true; }
  }

  for (const k of keywords) {
    if (!k) continue;
    if (nameTerms.has(k)) { best = Math.max(best, 0.95); matched = true; continue; } // exact in NAME
    if (name.includes(k) || code.includes(k)) { best = Math.max(best, 0.8); matched = true; continue; }
    if (terms.has(k)) { best = Math.max(best, 0.6); matched = true; continue; }       // exact in peripheral
    // fuzzy (typo tolerance): a name-term match dominates a peripheral one.
    let fz = 0;
    for (const t of nameTerms) { const v = fuzzyTier(k, t); if (v > fz) fz = v; }
    if (fz > 0) { best = Math.max(best, fz); matched = true; continue; }
    for (const t of terms) { const v = fuzzyTier(k, t); if (v > fz) fz = v; }
    if (fz > 0) { best = Math.max(best, fz * 0.5); matched = true; }                   // peripheral fuzzy halved
  }
  return { text: best, matched };
}

module.exports = { tokenize, editDistance, fuzzyEq, expandQuery, textScore, SYNONYMS, STOPWORDS, INTENTS };
