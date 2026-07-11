import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ChevronRight, Loader2 } from 'lucide-react';
import { useListOrdersQuery } from '../services/api';
import BottomNav from '../components/layout/BottomNav';
import PageTransition from '../components/common/PageTransition';

const ACTIVE_STATUSES = new Set(['created', 'searching', 'assigned', 'on_the_way', 'arrived', 'in_progress']);

export default function TrackPage() {
  const nav = useNavigate();
  const { data, isLoading } = useListOrdersQuery(1);

  const activeOrder = data?.orders?.find((o) => ACTIVE_STATUSES.has(o.status));

  useEffect(() => {
    if (activeOrder) nav(`/orders/${activeOrder._id}`, { replace: true });
  }, [activeOrder, nav]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center pb-24">
        <Loader2 size={28} className="text-slate-400 animate-spin" />
        <BottomNav active="track" />
      </div>
    );
  }

  if (activeOrder) return null;

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#F8FAFC] pb-40 flex flex-col">
        <div className="mx-auto w-full max-w-[480px] sm:max-w-xl md:max-w-2xl lg:max-w-4xl transition-all duration-300 flex-1 flex flex-col">
          <header className="px-6 pt-12 pb-6 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }}>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#0F172A] tracking-tight">Live Track</h1>
          </header>

          <div className="px-6 flex-1 flex flex-col items-center justify-center -mt-12 sm:-mt-16">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-slate-100 flex items-center justify-center mb-8">
              <MapPin size={40} strokeWidth={1.5} className="text-slate-400" />
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] tracking-tight mb-3 text-center">No active trips</h2>
            <p className="text-base md:text-lg text-slate-500 text-center leading-relaxed mb-10 max-w-sm md:max-w-md">
              Live tracking will appear here automatically when you have a booking in progress.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm md:max-w-lg">
              <button 
                onClick={() => nav('/services')} 
                className="flex-1 py-4 md:py-5 px-6 bg-black text-white rounded-xl md:rounded-2xl font-semibold text-base md:text-lg hover:bg-slate-900 active:bg-slate-800 transition-colors"
              >
                Book a Service
              </button>
              <button 
                onClick={() => nav('/orders')} 
                className="flex-1 py-4 md:py-5 px-6 bg-white border border-slate-200 text-[#0F172A] rounded-xl md:rounded-2xl font-semibold text-base md:text-lg flex items-center justify-center gap-2 hover:bg-slate-50 active:bg-slate-100 transition-colors"
              >
                Past Bookings
                <ChevronRight size={18} className="text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        <BottomNav active="track" />
      </div>
    </PageTransition>
  );
}
