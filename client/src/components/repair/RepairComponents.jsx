import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import { springSnap } from '../../lib/animations';

export function BrandCard({ brand, isSelected, onClick }) {
  return (
    <motion.button
      onClick={() => onClick(brand)}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.96 }}
      transition={springSnap}
      className={`relative w-full aspect-[4/3] rounded-2xl flex flex-col items-center justify-center p-4 border-2 transition-all duration-300 ${isSelected
          ? 'border-indigo-600 bg-indigo-50/50 shadow-md'
          : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-soft'
        }`}
    >
      {/* If logo is provided, we can render it. For now, using text as primary identifier */}
      <span className="text-sm md:text-base font-bold text-slate-800 tracking-tight">
        {brand.name}
      </span>
      {isSelected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-sm"
        >
          <Check size={14} strokeWidth={3} />
        </motion.div>
      )}
    </motion.button>
  );
}

export function BrandGrid({ brands, selectedBrand, onSelect }) {
  const [showOther, setShowOther] = useState(false);
  const [otherBrand, setOtherBrand] = useState('');

  const handleSelect = (brand) => {
    if (brand.id === 'other') {
      setShowOther(true);
    } else {
      setShowOther(false);
      onSelect(brand);
    }
  };

  const handleOtherSubmit = (e) => {
    e.preventDefault();
    if (otherBrand.trim()) {
      onSelect({ id: 'other', name: otherBrand.trim(), isCustom: true });
    }
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
        {brands.map((brand) => (
          <BrandCard
            key={brand.id}
            brand={brand}
            isSelected={selectedBrand?.id === brand.id || (brand.id === 'other' && selectedBrand?.isCustom)}
            onClick={handleSelect}
          />
        ))}
      </div>
      {showOther && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
          className="overflow-hidden"
        >
          <form onSubmit={handleOtherSubmit} className="flex max-w-md gap-3">
            <input
              type="text"
              placeholder="Enter brand name"
              value={otherBrand}
              onChange={(e) => setOtherBrand(e.target.value)}
              className="flex-1 h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm"
              autoFocus
            />
            <button
              type="submit"
              className="h-12 px-6 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition shadow-sm"
            >
              Confirm
            </button>
          </form>
        </motion.div>
      )}
    </div>
  );
}

export function ModelCard({ model, isSelected, onClick }) {
  return (
    <motion.button
      onClick={() => onClick(model)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full text-left px-5 py-4 rounded-xl border transition-all duration-200 ${isSelected
          ? 'border-indigo-600 bg-indigo-50/30 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-soft'
        } flex items-center justify-between group`}
    >
      <span className="text-[15px] font-semibold text-slate-800">{model.name}</span>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 group-hover:border-slate-400'
        }`}>
        {isSelected && <Check size={12} strokeWidth={3} className="text-white" />}
      </div>
    </motion.button>
  );
}

export function ModelGrid({ models, selectedModel, onSelect }) {
  const [search, setSearch] = useState('');

  const filtered = models.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full">
      {models.length > 8 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white/50 backdrop-blur-sm"
          />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {filtered.map(model => (
          <ModelCard
            key={model.id}
            model={model}
            isSelected={selectedModel?.id === model.id}
            onClick={onSelect}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-slate-500 py-4 col-span-full">No models found.</p>
        )}
      </div>
    </div>
  );
}

export function ServiceCard({ service, isSelected, onClick }) {
  const Icon = service.icon;
  return (
    <motion.button
      onClick={() => onClick(service)}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.96 }}
      transition={springSnap}
      className={`relative w-full text-left p-5 rounded-[20px] border-2 transition-all duration-300 flex flex-col gap-3 ${isSelected
          ? 'border-indigo-600 bg-indigo-50/50 shadow-md'
          : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-soft'
        }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${service.gradient}`}>
        <Icon size={20} strokeWidth={2} className="text-white" />
      </div>
      <div>
        <h3 className="text-[15px] font-bold text-slate-900 leading-snug mb-1">{service.label}</h3>
        <p className="text-[13px] text-slate-500 font-medium leading-tight">{service.description}</p>
      </div>

      {isSelected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute top-4 right-4 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-sm"
        >
          <Check size={14} strokeWidth={3} />
        </motion.div>
      )}
    </motion.button>
  );
}

export function ServiceGrid({ services, selectedService, onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {services.map(svc => (
        <ServiceCard
          key={svc.key}
          service={svc}
          isSelected={selectedService?.key === svc.key}
          onClick={onSelect}
        />
      ))}
    </div>
  );
}

export function BookingStepper({ steps, currentStepIndex }) {
  return (
    <div className="w-full flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
      {steps.map((step, idx) => {
        const isActive = idx === currentStepIndex;
        const isPast = idx < currentStepIndex;

        return (
          <div key={step.id} className="flex items-center gap-2 shrink-0">
            <div className={`flex items-center justify-center h-8 px-3 rounded-full text-[13px] font-bold transition-colors ${isActive ? 'bg-indigo-600 text-white shadow-sm' :
                isPast ? 'bg-indigo-100 text-indigo-700' :
                  'bg-slate-100 text-slate-400'
              }`}>
              {idx + 1}. {step.label}
            </div>
            {idx < steps.length - 1 && (
              <ChevronRight size={16} className={isPast ? 'text-indigo-300' : 'text-slate-300'} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BookingSummary({ brand, model, service, priceEstimate, onConfirm, isCreating }) {
  return (
    <div className="w-full max-w-lg bg-white rounded-[24px] border border-slate-100 shadow-soft-xl p-6 md:p-8">
      <h3 className="text-[20px] font-bold text-slate-900 mb-6 tracking-tight">Booking Summary</h3>

      <div className="space-y-4 mb-8">
        <div className="flex justify-between items-center py-3 border-b border-slate-100">
          <span className="text-[15px] font-medium text-slate-500">Device</span>
          <span className="text-[15px] font-bold text-slate-900 text-right">{brand?.name} {model?.name}</span>
        </div>
        <div className="flex justify-between items-center py-3 border-b border-slate-100">
          <span className="text-[15px] font-medium text-slate-500">Service</span>
          <span className="text-[15px] font-bold text-slate-900 text-right">{service?.label}</span>
        </div>
        <div className="flex justify-between items-center py-3">
          <span className="text-[15px] font-medium text-slate-500">Estimated Price</span>
          <span className="text-[18px] font-black text-indigo-600 text-right">
            {priceEstimate != null ? `₹${priceEstimate}` : 'Evaluating...'}
          </span>
        </div>
      </div>

      <button
        onClick={onConfirm}
        disabled={isCreating || priceEstimate == null}
        className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-[16px] hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center"
      >
        {isCreating ? 'Confirming...' : 'Continue Booking'}
      </button>
      <p className="text-center text-[11px] font-medium text-slate-400 mt-4">
        Price may vary based on exact device condition.
      </p>
    </div>
  );
}
