import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { useAdminGetCatalogServicesQuery, useAdminGetVerticalsQuery, useAdminUpdateVerticalMutation } from '../../services/api';
import toast from 'react-hot-toast';
import { TABS, CAT_MAP } from './components/services/_service-shared';
import ServicePricingCard from './components/services/ServicePricingCard';
import { HomeCategoryPanel, MobileCategoryPanel, ConstructionCategoryPanel, VehicleCategoryPanel } from './components/services/CategoryPanels';

export default function Services() {
  const [activeTab, setActiveTab] = useState('vehicle');
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState('');

  const { data: catalogData,  isLoading: catalogLoading  } = useAdminGetCatalogServicesQuery();
  const { data: verticalData, isLoading: verticalLoading, refetch } = useAdminGetVerticalsQuery();
  const [doUpdate] = useAdminUpdateVerticalMutation();

  const allServices   = catalogData?.services  || [];
  const configs       = verticalData?.configs   || {};
  const currentTab    = TABS.find(t => t.key === activeTab);
  const tabServices   = allServices.filter(s => CAT_MAP[activeTab]?.includes(s.category));
  const filteredServices = search.trim()
    ? tabServices.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()))
    : tabServices;
  const isLoading = catalogLoading || verticalLoading;

  async function handleVerticalSave(vertical, patch) {
    setSaving(true);
    try { await doUpdate({ vertical, ...patch }).unwrap(); toast.success(`${vertical} pricing saved`); refetch(); }
    catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Pricing Management</h2>
        <p className="text-sm text-slate-500 mt-0.5">Click any service to edit its pricing. Category-level settings apply as the base formula for all services in that group.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ key, label, Icon, color, bg, border }) => (
          <motion.button key={key} onClick={() => { setActiveTab(key); setSearch(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${activeTab === key ? `${bg} ${color} ${border} shadow-sm` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            whileTap={{ scale: 0.96 }}>
            <Icon size={15} />{label}
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="space-y-4">

          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20 transition-all">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search in ${currentTab?.label}…`} className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400" />
            {search && <button onClick={() => setSearch('')} className="text-slate-300 hover:text-slate-500"><X size={14} /></button>}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-48"><Loader2 size={22} className="animate-spin text-slate-300" /></div>
          ) : (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">
                {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''} — click to edit pricing
              </p>
              {filteredServices.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  {search ? `No services matching "${search}"` : 'No services in this category yet'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredServices.map(svc => (
                    <ServicePricingCard key={svc._id} svc={svc}
                      accent={currentTab?.accent} gradFrom={currentTab?.gradFrom}
                      gradTo={currentTab?.gradTo} tabColor={currentTab?.color}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {!isLoading && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Category-level pricing formula</p>
              {activeTab === 'home'         && <HomeCategoryPanel />}
              {activeTab === 'mobile'       && <MobileCategoryPanel config={configs.mobile}       onSave={handleVerticalSave} saving={saving} />}
              {activeTab === 'construction' && <ConstructionCategoryPanel config={configs.construction} onSave={handleVerticalSave} saving={saving} />}
              {activeTab === 'vehicle'      && <VehicleCategoryPanel config={configs.vehicle}     onSave={handleVerticalSave} saving={saving} />}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
