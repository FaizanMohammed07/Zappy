import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, SlidersHorizontal, Star, Heart, TrendingUp, X } from 'lucide-react';
import { useGetEventThemesQuery, useGetEventCategoriesQuery, useToggleSaveEventThemeMutation } from '../../services/api';
import toast from 'react-hot-toast';

const SORT_OPTIONS = [
  { value: 'trending',   label: '🔥 Trending'    },
  { value: 'rating',     label: '⭐ Top Rated'   },
  { value: 'price_asc',  label: '₹ Low to High'  },
  { value: 'price_desc', label: '₹ High to Low'  },
  { value: 'newest',     label: '✨ Newest'       },
];

export default function EventCategoryPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const category = params.get('category') || '';
  const searchQ  = params.get('search') || '';

  const [sort,       setSort]       = useState('trending');
  const [budgetMax,  setBudgetMax]  = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [city,       setCity]       = useState('');
  const [page,       setPage]       = useState(1);
  const [showFilter, setShowFilter] = useState(false);

  const { data, isLoading } = useGetEventThemesQuery({
    category: category || undefined, sort, page, search: searchQ || undefined,
    budgetMax: budgetMax ? Number(budgetMax) * 100 : undefined,
    guestCount: guestCount ? Number(guestCount) : undefined,
    city: city || undefined,
  });

  const { data: catData } = useGetEventCategoriesQuery();
  const [toggleSave] = useToggleSaveEventThemeMutation();

  const themes = data?.themes || [];
  const cat = catData?.categories?.find(c => c.slug === category);

  async function handleSave(id) {
    try { await toggleSave(id).unwrap(); }
    catch { toast.error('Sign in to save'); }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100">
            <ArrowLeft size={18} className="text-slate-700" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-slate-900">{cat ? `${cat.emoji} ${cat.name}` : searchQ ? `"${searchQ}"` : 'All Events'}</h1>
            <p className="text-xs text-slate-400">{data?.total || 0} themes available</p>
          </div>
          <button onClick={() => setShowFilter(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${showFilter ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
            <SlidersHorizontal size={12} />Filters
          </button>
        </div>

        {/* Sort pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {SORT_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setSort(o.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${sort === o.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter drawer */}
      {showFilter && (
        <div className="bg-white border-b border-slate-100 px-4 py-3 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Max Budget (₹)</label>
              <input type="number" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} placeholder="e.g. 5000"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Guests</label>
              <input type="number" value={guestCount} onChange={e => setGuestCount(e.target.value)} placeholder="e.g. 50"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">City</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="bangalore"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            </div>
          </div>
          {(budgetMax || guestCount || city) && (
            <button onClick={() => { setBudgetMax(''); setGuestCount(''); setCity(''); }} className="text-xs text-red-500 flex items-center gap-1"><X size={12} />Clear filters</button>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                <div className="h-44 bg-slate-100" />
                <div className="p-3 space-y-2"><div className="h-3 bg-slate-100 rounded w-3/4" /><div className="h-2 bg-slate-100 rounded w-1/2" /></div>
              </div>
            ))}
          </div>
        ) : themes.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {themes.map(theme => (
              <motion.div key={theme._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/events/themes/${theme._id}`)}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 cursor-pointer">
                <div className="relative">
                  <img src={theme.coverImage} alt={theme.title} className="w-full h-44 object-cover" />
                  <button onClick={e => { e.stopPropagation(); handleSave(theme._id); }}
                    className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center ${theme.isSaved ? 'bg-red-500' : 'bg-black/30 backdrop-blur-sm'}`}>
                    <Heart size={12} className={theme.isSaved ? 'text-white fill-white' : 'text-white'} />
                  </button>
                  {theme.isTrending && <div className="absolute top-2 left-2 px-2 py-0.5 bg-orange-500 rounded-full text-white text-[10px] font-bold">🔥</div>}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm text-slate-900 leading-tight truncate">{theme.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{theme.categoryId?.name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-indigo-600">₹{Math.round((theme.startingPricePaise || 0) / 100).toLocaleString('en-IN')}</span>
                    <div className="flex items-center gap-0.5">
                      <Star size={10} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-xs text-slate-500">{theme.rating?.toFixed(1) || '–'}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold text-slate-700">No themes found</p>
            <p className="text-sm text-slate-400 mt-1">Try adjusting your filters</p>
          </div>
        )}

        {/* Pagination */}
        {data?.pages > 1 && (
          <div className="flex gap-2 justify-center mt-6">
            {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-9 h-9 rounded-xl text-sm font-semibold ${p === page ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{p}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
