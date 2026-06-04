import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, User, FileText, Wrench } from 'lucide-react';
import { useGetWorkerMeQuery, useUpdateWorkerProfileMutation } from '../services/api';

const ALL_SKILLS = [
  { code: 'electrical',            label: 'Electrical' },
  { code: 'plumbing',              label: 'Plumbing' },
  { code: 'ac_repair',             label: 'AC Repair' },
  { code: 'carpenter',             label: 'Carpenter' },
  { code: 'helper',                label: 'Helper' },
  { code: 'puncture',              label: 'Puncture Repair' },
  { code: 'cleaning',              label: 'Cleaning' },
  { code: 'painting',              label: 'Painting' },
  { code: 'screen_replacement',    label: 'Screen Replacement' },
  { code: 'battery_replacement',   label: 'Battery Replacement' },
  { code: 'charging_issue',        label: 'Charging Issue' },
  { code: 'speaker_mic_issue',     label: 'Speaker / Mic' },
  { code: 'software_issue',        label: 'Software Issue' },
  { code: 'water_damage_check',    label: 'Water Damage Check' },
  { code: 'mason',                 label: 'Mason' },
  { code: 'battery_jump_start',    label: 'Battery Jump Start' },
  { code: 'fuel_delivery',         label: 'Fuel Delivery' },
  { code: 'bike_wash',             label: 'Bike Wash' },
  { code: 'car_wash',              label: 'Car Wash' },
  { code: 'minor_roadside_repair', label: 'Roadside Repair' },
];

export default function WorkerEditProfilePage() {
  const nav = useNavigate();
  const { data: meData, isLoading } = useGetWorkerMeQuery();
  const me = meData?.worker; // API returns { worker: {...} }
  const [updateProfile, { isLoading: isSaving, error }] = useUpdateWorkerProfileMutation();

  const [name,   setName]   = useState('');
  const [bio,    setBio]    = useState('');
  const [skills, setSkills] = useState(null);

  // Initialise form from server data once loaded
  if (me && skills === null) {
    setName(me.name ?? '');
    setBio(me.bio ?? '');
    setSkills(me.skills ?? []);
  }

  const toggleSkill = (code) => {
    setSkills((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code]
    );
  };

  const handleSave = async () => {
    const body = {};
    if (name.trim()  !== (me?.name ?? ''))  body.name   = name.trim();
    if (bio.trim()   !== (me?.bio  ?? ''))  body.bio    = bio.trim();
    const origSkills = JSON.stringify([...(me?.skills ?? [])].sort());
    const newSkills  = JSON.stringify([...(skills ?? [])].sort());
    if (newSkills !== origSkills)            body.skills = skills;

    if (!Object.keys(body).length) { nav('/worker'); return; }

    const res = await updateProfile(body);
    if (!res.error) nav('/worker');
  };

  if (isLoading || skills === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-slate-50 pb-10"
    >
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3">
        <button onClick={() => nav('/worker')} className="p-2 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <h1 className="font-semibold text-slate-800">Edit Profile</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* Name */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <User size={16} className="text-indigo-500" />
            <span className="text-sm font-semibold text-slate-700">Display Name</span>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="Your full name"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* Bio */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={16} className="text-indigo-500" />
            <span className="text-sm font-semibold text-slate-700">Bio</span>
            <span className="ml-auto text-xs text-slate-400">{bio.length}/300</span>
          </div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Brief intro shown to customers…"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* Skills */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Wrench size={16} className="text-indigo-500" />
            <span className="text-sm font-semibold text-slate-700">Skills</span>
            <span className="ml-auto text-xs text-slate-400">{skills.length}/10 selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_SKILLS.map(({ code, label }) => {
              const selected = skills.includes(code);
              return (
                <button
                  key={code}
                  onClick={() => skills.length < 10 || selected ? toggleSkill(code) : null}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {skills.length === 0 && (
            <p className="mt-3 text-xs text-red-500">Select at least 1 skill to appear in dispatch.</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center">
            {error.data?.error ?? 'Failed to save. Please try again.'}
          </p>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={isSaving || skills.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold rounded-2xl py-3.5 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
        >
          <Save size={16} />
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </motion.div>
  );
}
