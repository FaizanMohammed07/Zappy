/**
 * Pre-Diagnosis Questionnaire Configuration
 * ---------------------------------------------------------------------------
 * Each service has a structured flow of questions. Answers become part of
 * the order and are shown to the worker BEFORE they arrive, so they can:
 *   1. Bring the right tools
 *   2. Know the severity
 *   3. Set accurate expectations on arrival time + cost
 *
 * This eliminates the #1 worker complaint: "I arrived and the job was
 * completely different from what was described."
 *
 * Format: question → options (with metadata like urgency, tools, route)
 * ---------------------------------------------------------------------------
 */

const DIAGNOSIS_FLOWS = {

  /* ── Electrical ────────────────────────────────────────────────── */
  electrical: [
    {
      id: 'q1',
      text: 'What is the main problem?',
      type: 'single',
      options: [
        { id: 'no_power',    label: 'No power in room/area',   urgency: 'high',   tools: ['multimeter', 'screwdriver'] },
        { id: 'mcb_trip',    label: 'MCB/fuse keeps tripping', urgency: 'high',   tools: ['multimeter', 'clamp_meter'] },
        { id: 'fan_light',   label: 'Fan/light not working',   urgency: 'normal', tools: ['screwdriver', 'tester'] },
        { id: 'switch_dead', label: 'Switch/socket issue',     urgency: 'normal', tools: ['screwdriver', 'tester'] },
        { id: 'new_fitting', label: 'New fitting/wiring',      urgency: 'normal', tools: ['drill', 'wiring'] },
        { id: 'sparking',    label: 'Sparking/burning smell',  urgency: 'urgent', tools: ['multimeter'] },
      ],
    },
    {
      id: 'q2',
      text: 'How many rooms / circuits are affected?',
      type: 'single',
      showIf: { q1: ['no_power', 'mcb_trip'] },
      options: [
        { id: 'one_room',    label: 'One room',            priceHint: 'base'   },
        { id: 'half_house',  label: '2–3 rooms',           priceHint: 'medium' },
        { id: 'full_house',  label: 'Whole house/building',priceHint: 'large'  },
      ],
    },
    {
      id: 'q3',
      text: 'Any of these present?',
      type: 'multi',
      options: [
        { id: 'burning_smell', label: 'Burning smell',   urgency: 'urgent' },
        { id: 'wet_area',      label: 'Near water/bathroom' },
        { id: 'exposed_wire',  label: 'Exposed wire visible', urgency: 'urgent' },
        { id: 'old_wiring',    label: 'Old building (>20y)' },
      ],
    },
  ],

  /* ── Plumbing ───────────────────────────────────────────────────── */
  plumbing: [
    {
      id: 'q1',
      text: 'What type of plumbing issue?',
      type: 'single',
      options: [
        { id: 'leak',       label: 'Water leak/dripping',    urgency: 'high',   tools: ['wrench', 'sealant'] },
        { id: 'block',      label: 'Blocked drain/pipe',     urgency: 'high',   tools: ['plunger', 'snake'] },
        { id: 'no_water',   label: 'No water supply',        urgency: 'high',   tools: ['wrench'] },
        { id: 'tap_repair', label: 'Tap/valve repair',       urgency: 'normal', tools: ['wrench', 'tape'] },
        { id: 'toilet',     label: 'Toilet problem',         urgency: 'high',   tools: ['plunger', 'wrench'] },
        { id: 'new_pipe',   label: 'New pipe/installation',  urgency: 'normal', tools: ['pipe_cutter'] },
      ],
    },
    {
      id: 'q2',
      text: 'Where is the leak?',
      type: 'single',
      showIf: { q1: ['leak'] },
      options: [
        { id: 'kitchen',   label: 'Kitchen sink' },
        { id: 'bathroom',  label: 'Bathroom' },
        { id: 'ceiling',   label: 'Ceiling/overhead', urgency: 'urgent' },
        { id: 'outside',   label: 'Outside pipe/wall', urgency: 'high' },
      ],
    },
    {
      id: 'q3',
      text: 'How bad is the leak?',
      type: 'single',
      showIf: { q1: ['leak'] },
      options: [
        { id: 'drip',   label: 'Minor drip',        urgency: 'normal' },
        { id: 'steady', label: 'Steady flow',       urgency: 'high'   },
        { id: 'burst',  label: 'Burst/heavy flow',  urgency: 'urgent' },
      ],
    },
  ],

  /* ── AC Repair ──────────────────────────────────────────────────── */
  ac_repair: [
    {
      id: 'q1',
      text: 'What is the AC problem?',
      type: 'single',
      options: [
        { id: 'no_cool',     label: 'Not cooling',          urgency: 'high',   tools: ['gas_kit', 'leak_detector'] },
        { id: 'not_start',   label: 'Not switching on',     urgency: 'high',   tools: ['multimeter'] },
        { id: 'water_leak',  label: 'Water dripping inside',urgency: 'high',   tools: ['drain_kit'] },
        { id: 'noise',       label: 'Strange noise',        urgency: 'normal', tools: ['screwdriver'] },
        { id: 'service',     label: 'General service/cleaning', urgency: 'normal', tools: ['cleaning_kit'] },
        { id: 'gas_refill',  label: 'Gas refill needed',    urgency: 'high',   tools: ['gas_kit', 'manifold'] },
      ],
    },
    {
      id: 'q2',
      text: 'AC brand & tonnage?',
      type: 'single',
      options: [
        { id: '1ton',  label: '1 ton' },
        { id: '15ton', label: '1.5 ton' },
        { id: '2ton',  label: '2 ton' },
        { id: 'unknown', label: 'Not sure' },
      ],
    },
    {
      id: 'q3',
      text: 'How old is the AC?',
      type: 'single',
      options: [
        { id: 'new',     label: 'Under 2 years' },
        { id: 'mid',     label: '2–5 years' },
        { id: 'old',     label: '5–10 years' },
        { id: 'very_old',label: 'Over 10 years', urgency: 'high' },
      ],
    },
  ],

  /* ── Mobile Phone ──────────────────────────────────────────────── */
  screen_replacement: [
    {
      id: 'q1',
      text: 'What is the screen condition?',
      type: 'single',
      options: [
        { id: 'cracked',  label: 'Cracked/shattered',  urgency: 'normal' },
        { id: 'lines',    label: 'Lines/spots on display' },
        { id: 'no_touch', label: 'Touch not working' },
        { id: 'black',    label: 'Black screen / no display', urgency: 'high' },
      ],
    },
    {
      id: 'q2',
      text: 'Is the phone functional otherwise?',
      type: 'single',
      options: [
        { id: 'works',   label: 'Yes, works fine otherwise' },
        { id: 'partial', label: 'Partially (some features broken)' },
        { id: 'dead',    label: 'Cannot use phone at all', urgency: 'high' },
      ],
    },
  ],

  /* ── Cleaning ──────────────────────────────────────────────────── */
  cleaning: [
    {
      id: 'q1',
      text: 'What needs cleaning?',
      type: 'multi',
      options: [
        { id: 'bedrooms',   label: 'Bedrooms' },
        { id: 'bathrooms',  label: 'Bathrooms' },
        { id: 'kitchen',    label: 'Kitchen' },
        { id: 'living',     label: 'Living/Dining' },
        { id: 'balcony',    label: 'Balcony/Outdoor' },
        { id: 'sofa',       label: 'Sofa/Upholstery' },
      ],
    },
    {
      id: 'q2',
      text: 'How many rooms total?',
      type: 'single',
      options: [
        { id: '1bhk',  label: '1 BHK (1-2 rooms)',  rooms: 2 },
        { id: '2bhk',  label: '2 BHK (3-4 rooms)',  rooms: 4 },
        { id: '3bhk',  label: '3 BHK (5-6 rooms)',  rooms: 6 },
        { id: 'villa', label: 'Villa/Bungalow',      rooms: 8 },
      ],
    },
    {
      id: 'q3',
      text: 'When was last cleaning done?',
      type: 'single',
      options: [
        { id: 'recent',  label: 'Within a week',       dirtLevel: 1 },
        { id: 'month',   label: 'Last month',           dirtLevel: 2 },
        { id: 'quarter', label: '2–3 months ago',       dirtLevel: 3 },
        { id: 'long',    label: 'More than 3 months',   dirtLevel: 4 },
      ],
    },
  ],

  /* ── Puncture/Vehicle ──────────────────────────────────────────── */
  puncture: [
    {
      id: 'q1',
      text: 'What is the vehicle type?',
      type: 'single',
      options: [
        { id: 'bike',    label: 'Bike/Scooter', baseMultiplier: 1.0 },
        { id: 'car',     label: 'Car',          baseMultiplier: 1.5 },
        { id: 'truck',   label: 'Truck/Heavy',  baseMultiplier: 2.0 },
      ],
    },
    {
      id: 'q2',
      text: 'How many tyres are flat?',
      type: 'single',
      options: [
        { id: '1', label: '1 tyre',  count: 1 },
        { id: '2', label: '2 tyres', count: 2 },
        { id: '4', label: 'All flat', count: 4 },
      ],
    },
    {
      id: 'q3',
      text: 'Are you safely parked?',
      type: 'single',
      options: [
        { id: 'safe',   label: 'Yes, on roadside / safe spot' },
        { id: 'middle', label: 'Partially blocking traffic', urgency: 'high' },
        { id: 'highway',label: 'On highway/expressway',      urgency: 'urgent' },
      ],
    },
  ],

  /* ── Carpenter ─────────────────────────────────────────────────── */
  carpenter: [
    {
      id: 'q1',
      text: 'What is the carpenter work?',
      type: 'single',
      options: [
        { id: 'repair',    label: 'Repair existing furniture' },
        { id: 'door',      label: 'Door/window repair' },
        { id: 'new',       label: 'New furniture/installation' },
        { id: 'polish',    label: 'Polishing/finishing' },
        { id: 'modular',   label: 'Modular kitchen/wardrobe' },
      ],
    },
    {
      id: 'q2',
      text: 'How many items need work?',
      type: 'single',
      options: [
        { id: 'one',   label: '1 item',       timeHint: 1 },
        { id: 'few',   label: '2–3 items',    timeHint: 2 },
        { id: 'many',  label: 'More than 3',  timeHint: 4 },
      ],
    },
  ],
};

/* Urgency-based priority mapping */
const URGENCY_TO_PRIORITY = {
  urgent: 'emergency',
  high:   'normal',
  normal: 'normal',
};

/* Get flow for a service */
function getDiagnosisFlow(service) {
  return DIAGNOSIS_FLOWS[service] || null;
}

/* Compute urgency from answers */
function computeUrgencyFromAnswers(service, answers) {
  const flow = getDiagnosisFlow(service);
  if (!flow) return 'normal';

  let maxUrgency = 'normal';
  const urgencyOrder = ['normal', 'high', 'urgent'];

  for (const question of flow) {
    const answer = answers[question.id];
    if (!answer) continue;
    const ids = Array.isArray(answer) ? answer : [answer];
    for (const id of ids) {
      const opt = question.options.find(o => o.id === id);
      if (opt?.urgency && urgencyOrder.indexOf(opt.urgency) > urgencyOrder.indexOf(maxUrgency)) {
        maxUrgency = opt.urgency;
      }
    }
  }
  return maxUrgency;
}

/* Compute required tools from answers */
function computeToolsFromAnswers(service, answers) {
  const flow = getDiagnosisFlow(service);
  if (!flow) return [];
  const tools = new Set();
  for (const question of flow) {
    const answer = answers[question.id];
    if (!answer) continue;
    const ids = Array.isArray(answer) ? answer : [answer];
    for (const id of ids) {
      const opt = question.options.find(o => o.id === id);
      opt?.tools?.forEach(t => tools.add(t));
    }
  }
  return [...tools];
}

/* Compute room/quantity multiplier (for cleaning etc.) */
function computeQuantityMultiplier(service, answers) {
  const flow = getDiagnosisFlow(service);
  if (!flow) return 1;

  if (service === 'cleaning') {
    const q2 = flow.find(q => q.id === 'q2');
    const roomAns = answers['q2'];
    if (roomAns && q2) {
      const opt = q2.options.find(o => o.id === roomAns);
      if (opt?.rooms) return Math.max(1, opt.rooms / 2);
    }
  }
  return 1;
}

module.exports = {
  DIAGNOSIS_FLOWS,
  getDiagnosisFlow,
  computeUrgencyFromAnswers,
  computeToolsFromAnswers,
  computeQuantityMultiplier,
  URGENCY_TO_PRIORITY,
};
