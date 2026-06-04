import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Heart, Star, Clock, Users, CheckCircle, XCircle, ChevronLeft, ChevronRight, Play, Share2, Calendar } from 'lucide-react';
import { useGetEventThemeQuery, useToggleSaveEventThemeMutation } from '../../services/api';
import toast from 'react-hot-toast';

export default function EventThemePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useGetEventThemeQuery(id);
  const [toggleSave] = useToggleSaveEventThemeMutation();
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [showVideo, setShowVideo] = useState(false);

  const theme = data?.theme;

  async function handleSave() {
    try {
      const res = await toggleSave(id).unwrap();
      toast.success(res.saved ? 'Saved!' : 'Removed from saved');
    } catch { toast.error('Sign in to save themes'); }
  }

  if (isLoading) return (
    <div className="min-h-screen bg-white animate-pulse">
      <div className="h-72 bg-slate-100" />
      <div className="p-5 space-y-3">
        <div className="h-5 bg-slate-100 rounded w-2/3" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
      </div>
    </div>
  );

  if (!theme) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl mb-3">😔</p>
        <p className="font-semibold text-slate-700">Theme not found</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-indigo-600 text-sm font-medium">Go back</button>
      </div>
    </div>
  );

  const allMedia = [theme.coverImage, ...theme.gallery].filter(Boolean);
  const currentMedia = allMedia[galleryIdx];

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* Gallery */}
      <div className="relative bg-black">
        <div className="relative h-80">
          {showVideo && theme.videoUrl ? (
            <video src={theme.videoUrl} autoPlay controls className="w-full h-full object-cover" />
          ) : (
            <img src={currentMedia} alt={theme.title} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        </div>

        {/* Nav arrows */}
        {!showVideo && allMedia.length > 1 && (
          <>
            <button onClick={() => setGalleryIdx(i => (i - 1 + allMedia.length) % allMedia.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 backdrop-blur rounded-full flex items-center justify-center">
              <ChevronLeft size={16} className="text-white" />
            </button>
            <button onClick={() => setGalleryIdx(i => (i + 1) % allMedia.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 backdrop-blur rounded-full flex items-center justify-center">
              <ChevronRight size={16} className="text-white" />
            </button>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
              {allMedia.map((_, i) => (
                <div key={i} onClick={() => setGalleryIdx(i)} className={`h-1.5 rounded-full transition-all cursor-pointer ${i === galleryIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />
              ))}
            </div>
          </>
        )}

        {/* Top controls */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pt-12">
          <button onClick={() => navigate(-1)} className="w-9 h-9 bg-black/40 backdrop-blur rounded-full flex items-center justify-center">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="flex gap-2">
            {theme.videoUrl && (
              <button onClick={() => setShowVideo(v => !v)} className="w-9 h-9 bg-black/40 backdrop-blur rounded-full flex items-center justify-center">
                <Play size={14} className="text-white ml-0.5" />
              </button>
            )}
            <button onClick={handleSave} className={`w-9 h-9 rounded-full flex items-center justify-center ${theme.isSaved ? 'bg-red-500' : 'bg-black/40 backdrop-blur'}`}>
              <Heart size={14} className={theme.isSaved ? 'text-white fill-white' : 'text-white'} />
            </button>
          </div>
        </div>
      </div>

      {/* Thumbnail strip */}
      {allMedia.length > 1 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none bg-black">
          {allMedia.map((url, i) => (
            <button key={i} onClick={() => setGalleryIdx(i)} className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === galleryIdx ? 'border-white' : 'border-transparent opacity-60'}`}>
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-5 space-y-5">
        {/* Title + Rating */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-black text-slate-900 leading-tight flex-1">{theme.title}</h1>
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1 shrink-0">
              <Star size={13} className="text-amber-400 fill-amber-400" />
              <span className="text-sm font-bold text-amber-700">{theme.rating?.toFixed(1) || '–'}</span>
              <span className="text-xs text-amber-500">({theme.reviewCount})</span>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1">{theme.categoryId?.name} · {theme.partnerId?.businessName}</p>
        </div>

        {/* Price + Meta */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Starting from</p>
              <p className="text-2xl font-black text-indigo-600">₹{Math.round((theme.startingPricePaise || 0) / 100).toLocaleString('en-IN')}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">{theme.bookingCount} people booked</p>
              <p className="text-xs text-slate-400 mt-0.5">{theme.cities?.join(', ')}</p>
            </div>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-slate-600">
            {theme.setupDurationMinutes && (
              <div className="flex items-center gap-1"><Clock size={12} />{theme.setupDurationMinutes} min setup</div>
            )}
            {theme.guestCapacity && (
              <div className="flex items-center gap-1"><Users size={12} />Up to {theme.guestCapacity.max} guests</div>
            )}
          </div>
        </div>

        {/* Description */}
        {theme.description && (
          <div>
            <h3 className="font-bold text-slate-900 mb-1.5">About this theme</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{theme.description}</p>
          </div>
        )}

        {/* What's included / excluded */}
        {(theme.includedItems?.length > 0 || theme.excludedItems?.length > 0) && (
          <div className="space-y-3">
            {theme.includedItems?.length > 0 && (
              <div>
                <h3 className="font-bold text-slate-900 mb-2">What's included</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {theme.includedItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle size={14} className="text-green-500 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {theme.excludedItems?.length > 0 && (
              <div>
                <h3 className="font-bold text-slate-900 mb-2">Not included</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {theme.excludedItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-500">
                      <XCircle size={14} className="text-red-400 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Partner info */}
        {theme.partnerId && (
          <div className="bg-slate-50 rounded-2xl p-4">
            <h3 className="font-bold text-slate-900 mb-2">About the Partner</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {theme.partnerId.businessName?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-900">{theme.partnerId.businessName}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star size={11} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs text-slate-600">{theme.partnerId.rating?.toFixed(1)} · {theme.partnerId.completedEvents} events</span>
                </div>
              </div>
            </div>
            {theme.partnerId.bio && <p className="text-xs text-slate-500 mt-2 leading-relaxed">{theme.partnerId.bio}</p>}
          </div>
        )}
      </div>

      {/* CTA footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-4 flex gap-3">
        <button onClick={() => navigate(`/events/book/${theme._id}?scheduled=true`)}
          className="flex-1 py-3 border-2 border-indigo-600 text-indigo-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
          <Calendar size={16} />Schedule Later
        </button>
        <button onClick={() => navigate(`/events/book/${theme._id}`)}
          className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-sm">
          Book Now
        </button>
      </div>
    </div>
  );
}
