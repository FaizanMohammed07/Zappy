import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search, Loader2, X } from 'lucide-react';
import { selectAuth, selectIsAuthed } from '../modules/auth/authSlice';
import { useGeolocation, loadGeoLocation } from '../hooks/useGeolocation';
import { reverseGeocode } from '../utils/reverseGeocode';

import PageTransition from '../components/common/PageTransition';
import IntroSplash from '../components/common/IntroSplash';
import BottomNav from '../components/layout/BottomNav';
import Header from '../components/layout/Header';
import SearchBar from '../components/home/SearchBar';
import LiveTrustStrip from '../components/home/LiveTrustStrip';
import CharacterServiceGrid from '../components/home/CharacterServiceGrid';
import PromoCarousel from '../components/home/PromoCarousel';
import RecentRail from '../components/home/RecentRail';
import TrendingTicker from '../components/home/TrendingTicker';
import CategoryShelf from '../components/home/CategoryShelf';
import PremiumWalletDuo from '../components/home/PremiumWalletDuo';
import StatsBand from '../components/home/StatsBand';
import TrustBadges from '../components/home/TrustBadges';
import Footer from '../components/layout/Footer';
import { PromoBannerVehicle, PromoBannerElectronics, PromoBannerFamily, PromoBannerEvents } from '../components/home/PromoBanners';

const ELECTRONICS_SHELF = [
  { name: 'Screen Replacement', rating: '4.8', reviews: '12K+', price: '₹1499', mrp: '₹2499', discount: '₹1000 OFF', image: 'https://images.unsplash.com/photo-1597740985671-2a8a3b80502e?auto=format&fit=crop&w=400&q=80' },
  { name: 'Battery Replacement', rating: '4.7', reviews: '8K+', price: '₹999', mrp: '₹1499', image: 'https://images.unsplash.com/photo-1588508065123-287b28e01397?auto=format&fit=crop&w=400&q=80' },
  { name: 'Laptop Speed Fix', rating: '4.9', reviews: '5K+', price: '₹499', mrp: '₹999', discount: '50% OFF', image: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=400&q=80' },
  { name: 'Charging Port Fix', rating: '4.6', reviews: '3K+', price: '₹599', mrp: '₹899', image: 'https://images.unsplash.com/photo-1601524909162-ae8725290836?auto=format&fit=crop&w=400&q=80' },
];

const PHONE_SHELF = [
  { name: 'Screen Fix', rating: '4.8', reviews: '10K+', price: '₹1299', mrp: '₹1999', discount: '₹700 OFF', image: 'https://images.unsplash.com/photo-1512054502232-10a0a035d672?auto=format&fit=crop&w=400&q=80' },
  { name: 'Battery Change', rating: '4.7', reviews: '7K+', price: '₹899', mrp: '₹1299', image: 'https://images.unsplash.com/photo-1601784551446-20c9e07cd8db?auto=format&fit=crop&w=400&q=80' },
  { name: 'Camera Repair', rating: '4.6', reviews: '2K+', price: '₹799', mrp: '₹1199', image: 'https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?auto=format&fit=crop&w=400&q=80' },
  { name: 'Speaker Fix', rating: '4.5', reviews: '1.5K+', price: '₹499', mrp: '₹699', image: 'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?auto=format&fit=crop&w=400&q=80' },
];

const LAPTOP_SHELF = [
  { name: 'Slow Laptop Fix', rating: '4.9', reviews: '6K+', price: '₹499', mrp: '₹999', discount: '50% OFF', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=400&q=80' },
  { name: 'SSD Upgrade', rating: '4.9', reviews: '4K+', price: '₹2499', mrp: '₹3499', discount: '₹1000 OFF', image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=400&q=80' },
  { name: 'Screen Repair', rating: '4.7', reviews: '2K+', price: '₹3499', mrp: '₹4999', image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=400&q=80' },
  { name: 'Virus Removal', rating: '4.8', reviews: '5K+', price: '₹299', mrp: '₹599', image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=400&q=80' },
];

const SMART_DEVICES_SHELF = [
  { name: 'Smart TV Setup', rating: '4.8', reviews: '8K+', price: '₹399', mrp: '₹599', discount: '₹200 OFF', image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=400&q=80' },
  { name: 'WiFi Setup', rating: '4.7', reviews: '5K+', price: '₹299', mrp: '₹499', image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=400&q=80' },
  { name: 'CCTV Install', rating: '4.9', reviews: '3K+', price: '₹999', mrp: '₹1499', discount: '₹500 OFF', image: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=400&q=80' },
  { name: 'Smart Lock', rating: '4.8', reviews: '1K+', price: '₹499', mrp: '₹799', image: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=400&q=80' },
];

const VEHICLE_SHELF = [
  { name: 'Puncture Repair', rating: '4.9', reviews: '15K+', price: '₹99', mrp: '₹149', image: 'https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?auto=format&fit=crop&w=400&q=80' },
  { name: 'Car Wash', rating: '4.7', reviews: '20K+', price: '₹349', mrp: '₹499', discount: '30% OFF', image: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=400&q=80' },
  { name: 'Jump Start', rating: '4.9', reviews: '5K+', price: '₹199', mrp: '₹299', image: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=400&q=80' },
  { name: 'Bike Service', rating: '4.8', reviews: '12K+', price: '₹499', mrp: '₹799', discount: '₹300 OFF', image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=400&q=80' },
];

const FAMILY_SHELF = [
  { name: 'Medicine Delivery', rating: '4.9', reviews: '25K+', price: '₹49', mrp: '₹99', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80' },
  { name: 'Hospital Help', rating: '4.9', reviews: '8K+', price: '₹299', mrp: '₹499', image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=400&q=80' },
  { name: 'Elder Care', rating: '4.8', reviews: '4K+', price: '₹499', mrp: '₹799', discount: '₹300 OFF', image: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=400&q=80' },
  { name: 'Grocery Run', rating: '4.7', reviews: '30K+', price: '₹49', mrp: '₹99', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80' },
];

const EVENTS_SHELF = [
  { name: 'Birthday Decor', rating: '4.8', reviews: '6K+', price: '₹1499', mrp: '₹1999', discount: '₹500 OFF', image: 'https://images.unsplash.com/photo-1530103862676-de8892b07d62?auto=format&fit=crop&w=400&q=80' },
  { name: 'Anniversary', rating: '4.9', reviews: '3K+', price: '₹1999', mrp: '₹2499', image: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=400&q=80' },
  { name: 'Baby Shower', rating: '4.8', reviews: '2K+', price: '₹1799', mrp: '₹2299', discount: '₹500 OFF', image: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=400&q=80' },
  { name: 'Reception', rating: '4.7', reviews: '1.5K+', price: '₹2999', mrp: '₹3999', image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=400&q=80' },
];

export default function HomePage() {
  const nav = useNavigate();
  const { profile } = useSelector(selectAuth);
  const firstName = profile?.name?.split(' ')[0] || 'there';

  /* ── GPS location detection ── */
  const { getCurrent } = useGeolocation();
  const [loc, setLoc] = useState(() => {
    const cached = loadGeoLocation();
    return cached
      ? { primary: 'Detecting...', secondary: null, loading: true, lat: cached.lat, lng: cached.lng }
      : { primary: 'Detecting...', secondary: null, loading: true };
  });

  const [locSheet, setLocSheet] = useState(false);
  const [locSearch, setLocSearch] = useState('');
  const [locResults, setLocResults] = useState([]);
  const [locDetecting, setLocDetecting] = useState(false);

  useEffect(() => {
    getCurrent()
      .then(async ({ lat, lng, accuracy }) => {
        if (accuracy && accuracy > 500) {
          setLoc({ primary: 'Set location', secondary: 'Tap to choose', loading: false });
          setLocSheet(true);
          return;
        }
        const { primary, secondary } = await reverseGeocode(lat, lng);
        setLoc({ primary, secondary, loading: false, lat, lng });
      })
      .catch(() => {
        const cached = loadGeoLocation();
        if (cached) {
          reverseGeocode(cached.lat, cached.lng)
            .then(({ primary, secondary }) => setLoc({ primary, secondary, loading: false }));
        } else {
          setLoc({ primary: 'Set location', secondary: 'Tap to choose', loading: false });
          setLocSheet(true);
        }
      });
  }, [getCurrent]);

  // Mapbox address search
  useEffect(() => {
    if (!locSearch.trim() || locSearch.length < 3) { setLocResults([]); return; }
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) return;
    const ctrl = new AbortController();
    fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(locSearch)}.json?access_token=${token}&country=IN&types=address,neighborhood,locality,place&limit=5`,
      { signal: ctrl.signal },
    )
      .then(r => r.json())
      .then(d => setLocResults(d.features || []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [locSearch]);

  async function detectCurrentLocation() {
    setLocDetecting(true);
    try {
      const { lat, lng } = await getCurrent();
      const { primary, secondary } = await reverseGeocode(lat, lng);
      setLoc({ primary, secondary, loading: false, lat, lng });
      setLocSheet(false);
    } catch { } finally { setLocDetecting(false); }
  }

  function pickLocResult(feat) {
    const [lng, lat] = feat.center;
    const ctx = feat.context || [];
    const get = (prefix) => ctx.find(c => c.id?.startsWith(prefix))?.text ?? null;
    const primary = get('neighborhood') || get('locality') || feat.text;
    const secondary = [get('place') || get('locality'), get('region')].filter(Boolean).join(', ') || null;
    setLoc({ primary, secondary, loading: false, lat, lng });
    setLocSheet(false);
    setLocSearch('');
    setLocResults([]);
  }

  return (
    <PageTransition>
      <IntroSplash />
      <div className="page-shell">
        
        <Header loc={loc} onOpenLocSheet={() => setLocSheet(true)} firstName={firstName} />

        {/* --- ABOVE THE FOLD CONTENT --- */}
        <main className="page-container pt-4 pb-32">
          <SearchBar />
          <LiveTrustStrip />
          <CharacterServiceGrid />
          
          {/* --- SCROLLABLE CONTENT --- */}
          <div className="mt-8">
            <PromoCarousel />
            <RecentRail />
            <TrendingTicker />
            
            {/* Deep Content Shelves */}
            <CategoryShelf title="Electronics Rescue" tag="Most Booked" items={ELECTRONICS_SHELF} />
            <PromoBannerElectronics />
            <CategoryShelf title="Phone Repair" tag="Android & iPhone" items={PHONE_SHELF} />
            <CategoryShelf title="Laptop Services" tag="All Brands" items={LAPTOP_SHELF} />
            <PromoBannerVehicle />
            <CategoryShelf title="Smart Devices" tag="Install & Fix" items={SMART_DEVICES_SHELF} />
            <PremiumWalletDuo />
            <CategoryShelf title="Vehicle Care" tag="On-Road Help" items={VEHICLE_SHELF} />
            <StatsBand />
            <PromoBannerFamily />
            <CategoryShelf title="Family Assist" tag="Trusted Help" items={FAMILY_SHELF} />
            <PromoBannerEvents />
            <CategoryShelf title="Event Decorations" tag="Book a Theme" items={EVENTS_SHELF} />
            
            <TrustBadges />
          </div>
        </main>

        <Footer />
        <BottomNav />

        {/* ─── Location Sheet ────────────────────────────── */}
        <AnimatePresence>
          {locSheet && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]" onClick={() => setLocSheet(false)} />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 bg-[var(--surface)] rounded-t-[32px] p-6 z-[120] max-h-[85vh] overflow-y-auto border border-[var(--border)] shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-black text-hi">Select Location</h3>
                  <button onClick={() => setLocSheet(false)} className="p-2 bg-[var(--surface-2)] rounded-full"><X size={16} className="text-mid" /></button>
                </div>
                
                <button onClick={detectCurrentLocation} disabled={locDetecting} className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--accent-ink)] rounded-[9999px] py-3.5 font-bold mb-6 hover:brightness-110 disabled:opacity-50 transition-all shadow-md">
                  {locDetecting ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
                  Use current location
                </button>

                <div className="relative mb-6">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-mid" />
                  <input type="text" placeholder="Search for area, street..." value={locSearch} onChange={e => setLocSearch(e.target.value)}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[9999px] py-3 pl-11 pr-4 text-hi focus:border-[var(--violet)] outline-none transition-colors" />
                </div>

                {locResults.length > 0 && (
                  <div className="space-y-2">
                    {locResults.map(r => (
                      <button key={r.id} onClick={() => pickLocResult(r)} className="w-full flex flex-col text-left p-3 rounded-[22px] hover:bg-[var(--surface-2)] transition-colors border border-transparent hover:border-[var(--border-strong)]">
                        <span className="font-bold text-hi">{r.text}</span>
                        <span className="text-xs text-mid mt-0.5">{r.place_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
