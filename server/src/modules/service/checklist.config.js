/**
 * Service Completion Checklists
 * Worker checks off each item; customer reviews and signs off digitally.
 * Creates a verifiable service record, enables warranty, prevents disputes.
 * No Indian competitor has structured digital sign-off.
 */

const CHECKLISTS = {
  electrical: [
    { id: 'power_restored',  label: 'Power restored to all affected circuits',  required: true  },
    { id: 'connections',     label: 'All connections tightened and insulated',   required: true  },
    { id: 'earthing',        label: 'Earthing checked and confirmed',            required: true  },
    { id: 'mcb_load',        label: 'MCB/fuse load tested',                      required: false },
    { id: 'no_exposed',      label: 'No exposed wires remaining',               required: true  },
    { id: 'area_cleaned',    label: 'Work area cleaned',                         required: false },
  ],

  plumbing: [
    { id: 'leak_fixed',      label: 'Leak completely stopped',                  required: true  },
    { id: 'pressure_ok',     label: 'Water pressure tested and normal',          required: true  },
    { id: 'no_seepage',      label: 'No seepage on walls/floor',                required: true  },
    { id: 'fittings_tight',  label: 'All fittings tightened',                   required: true  },
    { id: 'drain_clear',     label: 'Drain flowing freely',                     required: false },
    { id: 'area_dry',        label: 'Area dried and cleaned',                    required: false },
  ],

  ac_repair: [
    { id: 'cooling_ok',      label: 'AC cooling to target temperature',         required: true  },
    { id: 'no_water_leak',   label: 'No water dripping inside',                 required: true  },
    { id: 'filters_cleaned', label: 'Filters cleaned/replaced',                 required: false },
    { id: 'condenser_ok',    label: 'Condenser and fan unit checked',            required: false },
    { id: 'gas_level',       label: 'Gas level verified (if applicable)',        required: false },
    { id: 'remote_working',  label: 'Remote control all modes working',          required: true  },
  ],

  screen_replacement: [
    { id: 'screen_works',    label: 'New screen installed and working',          required: true  },
    { id: 'touch_works',     label: 'Touch working on all areas of screen',     required: true  },
    { id: 'no_backlight',    label: 'No backlight bleeding or dead pixels',     required: true  },
    { id: 'camera_ok',       label: 'Front/rear camera unaffected',             required: false },
    { id: 'sealed',          label: 'Phone properly sealed',                    required: true  },
  ],

  cleaning: [
    { id: 'floors',          label: 'All floors swept and mopped',              required: true  },
    { id: 'bathrooms',       label: 'Bathrooms scrubbed and disinfected',       required: false },
    { id: 'kitchen',         label: 'Kitchen surfaces cleaned',                 required: false },
    { id: 'dust_removed',    label: 'Surfaces dusted',                          required: true  },
    { id: 'trash',           label: 'Trash cleared and bins emptied',           required: false },
    { id: 'no_damage',       label: 'No damage to property',                    required: true  },
  ],

  carpenter: [
    { id: 'work_done',       label: 'All requested work completed',             required: true  },
    { id: 'joints_secure',   label: 'All joints secure and tested',             required: true  },
    { id: 'finish_ok',       label: 'Finish/polish smooth and even',            required: false },
    { id: 'sawdust_cleaned', label: 'Wood dust/debris cleaned',                 required: false },
    { id: 'hardware_tight',  label: 'Hinges/handles tightened',                 required: false },
  ],

  painting: [
    { id: 'coverage',        label: 'All areas have uniform coverage',          required: true  },
    { id: 'no_drips',        label: 'No drips or smudges',                     required: true  },
    { id: 'furniture',       label: 'Furniture/fixtures protected or restored', required: true  },
    { id: 'floor_clean',     label: 'Floor cleaned of paint drops',            required: false },
    { id: 'edges_clean',     label: 'Edges and borders clean',                 required: true  },
  ],

  puncture: [
    { id: 'tyre_inflated',   label: 'Tyre inflated to correct pressure',       required: true  },
    { id: 'other_tyres',     label: 'Other tyres pressure checked',            required: false },
    { id: 'secure_rim',      label: 'Rim bolts tightened',                     required: true  },
    { id: 'spare_returned',  label: 'Spare tyre/tools returned',               required: false },
  ],
};

/* Default checklist for services without specific one */
const DEFAULT_CHECKLIST = [
  { id: 'work_done',   label: 'All requested work completed', required: true  },
  { id: 'area_clean',  label: 'Work area cleaned',            required: false },
  { id: 'no_damage',   label: 'No damage to property',        required: true  },
];

function getChecklist(service) {
  return CHECKLISTS[service] || DEFAULT_CHECKLIST;
}

function validateCompletion(service, completedIds) {
  const checklist = getChecklist(service);
  const required  = checklist.filter(c => c.required).map(c => c.id);
  const missing   = required.filter(id => !completedIds.includes(id));
  return { valid: missing.length === 0, missing };
}

module.exports = { CHECKLISTS, DEFAULT_CHECKLIST, getChecklist, validateCompletion };
