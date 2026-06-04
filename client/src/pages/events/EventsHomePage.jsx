import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, Play, Heart, Star, ChevronRight, Sparkles } from 'lucide-react';
import { useGetEventCategoriesQuery, useGetEventThemesQuery, useToggleSaveEventThemeMutation } from '../../services/api';
import toast from 'react-hot-toast';

/* ── Video reel card with auto-play on intersection ───────────────────── */
function VideoReelCard({ theme, onSave }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !theme.videoUrl) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) videoRef.current?.play().catch(() => {});
      else videoRef.current?.pause();
    }, { threshold: 0.6 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [theme.videoUrl]);

  const navigate = useNavigate();
  return (
    <div ref={containerRef} className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] cursor-pointer" onClick={() => navigate(`/events/themes/${theme._id}`)}>
      {theme.videoUrl ? (
        <video ref={videoRef} src={theme.videoUrl} loop muted playsInline className="w-full h-full object-cover" />
      ) : (
        <img src={theme.coverImage} alt={theme.title} className="w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-white font-bold text-sm leading-tight">{theme.title}</p>
        <p className="text-white/70 text-xs mt-0.5">₹{Math.round((theme.startingPricePaise || 0) / 100).toLocaleString('en-IN')} starting</p>
        <div className="flex items-center gap-2 mt-1">
          <Star size={10} className="text-yellow-400 fill-yellow-400" />
          <span className="text-white/80 text-xs">{theme.rating?.toFixed(1) || '–'}</span>
          <span className="text-white/50 text-xs">·</span>
          <span className="text-white/70 text-xs">{theme.bookingCount} booked</span>
        </div>
      </div>
      <button onClick={e => { e.stopPropagation(); onSave(theme._id); }}
        className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center ${theme.isSaved ? 'bg-red-500' : 'bg-black/40 backdrop-blur-sm'}`}>
        <Heart size={14} className={theme.isSaved ? 'text-white fill-white' : 'text-white'} />
      </button>
      {theme.status === 'featured' && (
        <div className="absolute top-3 left-3 px-2 py-0.5 bg-purple-500 rounded-full text-white text-xs font-semibold flex items-center gap-1">
          <Sparkles size={10} />Featured
        </div>
      )}
    </div>
  );
}

/* ── Theme grid card ─────────────────────────────────────────────────────── */
function ThemeCard({ theme, onSave }) {
  const navigate = useNavigate();
  return (
    <motion.div whileHover={{ y: -2 }} onClick={() => navigate(`/events/themes/${theme._id}`)}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 cursor-pointer">
      <div className="relative">
        <img src={theme.coverImage} alt={theme.title} className="w-full h-44 object-cover" />
        {theme.videoUrl && (
          <div className="absolute bottom-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center">
            <Play size={10} className="text-white ml-0.5" />
          </div>
        )}
        <button onClick={e => { e.stopPropagation(); onSave(theme._id); }}
          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center ${theme.isSaved ? 'bg-red-500' : 'bg-black/30 backdrop-blur-sm'}`}>
          <Heart size={12} className={theme.isSaved ? 'text-white fill-white' : 'text-white'} />
        </button>
        {theme.isTrending && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-orange-500 rounded-full text-white text-[10px] font-bold">🔥 Trending</div>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold text-sm text-slate-900 leading-tight">{theme.title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{theme.categoryId?.name} · {theme.partnerId?.businessName}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-bold text-indigo-600">₹{Math.round((theme.startingPricePaise || 0) / 100).toLocaleString('en-IN')}</span>
          <div className="flex items-center gap-1">
            <Star size={10} className="text-yellow-400 fill-yellow-400" />
            <span className="text-xs text-slate-500">{theme.rating?.toFixed(1) || '–'} ({theme.reviewCount})</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function EventsHomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showReels, setShowReels] = useState(false);

  const { data: catData } = useGetEventCategoriesQuery();
  const { data: trendingData } = useGetEventThemesQuery({ sort: 'trending', limit: 12 });
  const { data: videoData } = useGetEventThemesQuery({ sort: 'trending', limit: 6 });
  const [toggleSave] = useToggleSaveEventThemeMutation();

  const categories = catData?.categories || [];
  const trending   = trendingData?.themes || [];
  const videoThemes = (videoData?.themes || []).filter(t => t.videoUrl);

  async function handleSave(id) {
    try { await toggleSave(id).unwrap(); }
    catch { toast.error('Sign in to save themes'); }
  }

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) navigate(`/events/browse?search=${encodeURIComponent(search.trim())}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 via-pink-500 to-rose-400 px-4 pt-12 pb-8 text-white">
        <p className="text-sm font-medium opacity-80 mb-1">Discover & Book</p>
        <h1 className="text-2xl font-black leading-tight">Beautiful Event<br />Decorations</h1>
        <form onSubmit={handleSearch} className="mt-4 flex items-center gap-2 bg-white/20 backdrop-blur rounded-xl px-4 py-3">
          <Search size={16} className="text-white/70" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Birthday, Anniversary, Baby Shower…"
            className="flex-1 bg-transparent text-white placeholder:text-white/60 text-sm outline-none" />
        </form>
      </div>

      <div className="px-4 mt-5 space-y-6">
        {/* Categories */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Browse by Occasion</h2>
            <button onClick={() => navigate('/events/browse')} className="text-xs text-indigo-600 font-medium flex items-center gap-0.5">See all <ChevronRight size={12} /></button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {categories.map(cat => (
              <button key={cat._id} onClick={() => navigate(`/events/browse?category=${cat.slug}`)}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 bg-white rounded-2xl p-3 shadow-sm border border-slate-100 min-w-[72px]">
                <span className="text-2xl">{cat.emoji}</span>
                <span className="text-xs font-medium text-slate-700 text-center leading-tight whitespace-nowrap">{cat.name}</span>
              </button>
            ))}
            {!categories.length && [{ emoji: '🎂', name: 'Birthday' }, { emoji: '👶', name: 'Baby Shower' }, { emoji: '💑', name: 'Anniversary' }, { emoji: '🏡', name: 'Housewarming' }, { emoji: '❤️', name: 'Romantic' }].map(c => (
              <div key={c.name} className="flex-shrink-0 flex flex-col items-center gap-1.5 bg-white rounded-2xl p-3 shadow-sm border border-slate-100 min-w-[72px]">
                <span className="text-2xl">{c.emoji}</span>
                <span className="text-xs font-medium text-slate-700">{c.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Video Reels toggle */}
        {videoThemes.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <span className="w-5 h-5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center"><Play size={10} className="text-white ml-0.5" /></span>
                See it Live
              </h2>
              <button onClick={() => setShowReels(v => !v)} className="text-xs text-indigo-600 font-medium">{showReels ? 'Hide' : 'Play reels'}</button>
            </div>
            <AnimatePresence>
              {showReels && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-2 gap-3">
                  {videoThemes.slice(0, 4).map(theme => (
                    <VideoReelCard key={theme._id} theme={theme} onSave={handleSave} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* Trending */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><TrendingUp size={16} className="text-orange-500" />Trending Now</h2>
            <button onClick={() => navigate('/events/browse?sort=trending')} className="text-xs text-indigo-600 font-medium flex items-center gap-0.5">See all <ChevronRight size={12} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {trending.map(theme => (
              <ThemeCard key={theme._id} theme={theme} onSave={handleSave} />
            ))}
          </div>
          {!trending.length && (
            <div className="text-center py-8 text-slate-400">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-sm">No themes yet — check back soon!</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

