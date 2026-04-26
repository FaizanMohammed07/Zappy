/**
 * Seed the service catalog — one entry per service offering.
 * Idempotent (upsert on `code`).
 *
 *   node scripts/bootstrap-catalog.js
 */
require('dotenv').config();
const { connectMongo } = require('../src/config/mongo');
const ServiceCatalog = require('../src/models/ServiceCatalog');

const SERVICES = [
  {
    code: 'puncture',
    name: 'Puncture Repair',
    icon: '🔧',
    category: 'vehicle',
    description: 'Tyre puncture fix for 2-wheelers and cars.',
    estimatedDurationMinutes: 20,
    priceRangeMinPaise: 10000,  // ₹100
    priceRangeMaxPaise: 30000,  // ₹300
    requiredSkills: ['puncture'],
    requiredTools: ['Tyre patch kit', 'Air pump', 'Tyre lever', 'Soap solution'],
    checklist: [
      { item: 'Locate puncture accurately using soap water', required: true },
      { item: 'Clean and buff the area before patching', required: true },
      { item: 'Apply rubber patch with adhesive', required: true },
      { item: 'Inflate to correct PSI (confirm with customer)', required: true },
      { item: 'Check for other leaks before leaving', required: true },
    ],
    guidelines: [
      'Confirm vehicle make/model before starting',
      'Use OEM-grade patches only',
      'Do not quote extra charges without customer approval',
    ],
    sortOrder: 1,
  },
  {
    code: 'helper',
    name: 'Helper / Loader',
    icon: '💪',
    category: 'helper',
    description: 'General-purpose helper for lifting, moving, shifting items.',
    estimatedDurationMinutes: 60,
    priceRangeMinPaise: 15000,
    priceRangeMaxPaise: 50000,
    requiredSkills: ['helper'],
    requiredTools: ['Gloves', 'Rope (optional)', 'Trolley (if specified)'],
    checklist: [
      { item: 'Confirm scope of work before starting', required: true },
      { item: 'Wear gloves when handling heavy/sharp items', required: true },
      { item: 'Handle customer items with care', required: true },
      { item: 'Clean up after work is done', required: false },
    ],
    guidelines: [
      'No smoking/eating inside customer premises',
      'Report any accidental damage immediately — do not hide it',
    ],
    sortOrder: 2,
  },
  {
    code: 'plumbing',
    name: 'Plumbing',
    icon: '🚰',
    category: 'home',
    description: 'Leak fixes, tap replacement, basic drainage work.',
    estimatedDurationMinutes: 45,
    priceRangeMinPaise: 20000,
    priceRangeMaxPaise: 80000,
    requiredSkills: ['plumbing'],
    requiredTools: ['Pipe wrench', 'Thread tape', 'Spanner set', 'Plunger', 'Bucket'],
    checklist: [
      { item: 'Turn off main water supply before work', required: true },
      { item: 'Test fix by running water for 2 full minutes', required: true },
      { item: 'Show customer before/after the fix', required: true },
      { item: 'Mop any spilled water before leaving', required: true },
    ],
    guidelines: [
      'Share exact material cost before purchasing anything',
      'Do not cut any wall/tile without explicit customer permission',
    ],
    sortOrder: 3,
  },
  {
    code: 'electrical',
    name: 'Electrical',
    icon: '💡',
    category: 'home',
    description: 'Switches, fans, basic wiring, socket fixes.',
    estimatedDurationMinutes: 45,
    priceRangeMinPaise: 20000,
    priceRangeMaxPaise: 80000,
    requiredSkills: ['electrical'],
    requiredTools: ['Screwdriver set', 'Insulation tape', 'Tester', 'Wire cutter', 'Multimeter'],
    checklist: [
      { item: 'Switch off MCB before opening any switchboard', required: true },
      { item: 'Verify no current with tester before touching wires', required: true },
      { item: 'Use proper insulation on all joints', required: true },
      { item: 'Test fitted device in customer\'s presence', required: true },
    ],
    guidelines: [
      'Never work on exposed wires while main is ON',
      'Recommend an inspection if you see burned wiring — do not patch over it',
    ],
    sortOrder: 4,
  },
  {
    code: 'carpenter',
    name: 'Carpenter',
    icon: '🪚',
    category: 'home',
    description: 'Furniture fixes, hinge repair, drilling, assembly.',
    estimatedDurationMinutes: 60,
    priceRangeMinPaise: 25000,
    priceRangeMaxPaise: 100000,
    requiredSkills: ['carpenter'],
    requiredTools: ['Drill machine', 'Screwdriver set', 'Hammer', 'Measuring tape', 'Sandpaper'],
    checklist: [
      { item: 'Protect floor with cloth during drilling', required: true },
      { item: 'Collect and dispose of all sawdust/shavings', required: true },
      { item: 'Double-check measurements before cutting', required: true },
    ],
    guidelines: [
      'Confirm replacement material colour/finish with customer',
      'Do not leave screws/nails on the floor — children\'s safety',
    ],
    sortOrder: 5,
  },
  {
    code: 'ac_repair',
    name: 'AC Repair',
    icon: '❄️',
    category: 'home',
    description: 'AC cooling issues, gas top-up, cleaning, installation check.',
    estimatedDurationMinutes: 60,
    priceRangeMinPaise: 40000,
    priceRangeMaxPaise: 200000,
    requiredSkills: ['ac_repair', 'electrical'],
    requiredTools: ['Gauge manifold', 'Coil cleaner', 'Screwdriver set', 'Vacuum pump'],
    checklist: [
      { item: 'Check inlet/outlet temperature differential', required: true },
      { item: 'Inspect filter — clean or recommend replacement', required: true },
      { item: 'Check for gas leaks before suggesting top-up', required: true },
      { item: 'Run AC for 10 min after fix to confirm cooling', required: true },
    ],
    guidelines: [
      'Quote gas top-up cost BEFORE starting, not after',
      'Old gas (R22) vs new gas (R32) — never mix',
    ],
    sortOrder: 6,
  },
];

(async () => {
  await connectMongo();
  for (const svc of SERVICES) {
    await ServiceCatalog.findOneAndUpdate({ code: svc.code }, svc, { upsert: true });
    console.log(`✓ Service upserted: ${svc.code}`);
  }
  console.log(`\n${SERVICES.length} services in catalog.`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
