import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Send, Zap, Heart, ShieldCheck } from 'lucide-react';
import { ZappyLogo } from '../common/ZappyLogo';

export default function Footer() {
  const nav = useNavigate();

  return (
    <footer className="relative bg-slate-900 pt-20 pb-28 overflow-hidden mt-12 rounded-t-[2.5rem] md:rounded-t-[4rem] border-t border-slate-800">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-zappy-600 blur-[120px] opacity-20 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-16">
          
          {/* Brand & Newsletter Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <ZappyLogo className="w-10 h-10 text-zappy-500" />
              <span className="text-2xl font-black text-white tracking-tight">Zappy</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-sm">
              The ultimate hyperlocal on-demand platform. We bring instant repairs, reliable vehicle care, trusted family assistance, and premium event planning directly to your doorstep in minutes.
            </p>

            <div className="space-y-4">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Subscribe to Updates</p>
              <div className="flex items-center p-1.5 bg-slate-800/50 border border-slate-700/50 rounded-2xl backdrop-blur-sm max-w-sm focus-within:ring-2 focus-within:ring-zappy-500/50 transition-all">
                <input 
                  type="email" 
                  placeholder="Enter your email address" 
                  className="bg-transparent border-none outline-none text-sm text-slate-300 px-4 w-full placeholder-slate-500"
                />
                <motion.button 
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 shrink-0 bg-zappy-gradient rounded-xl flex items-center justify-center text-white shadow-lg shadow-zappy-500/20"
                >
                  <Send size={16} className="-ml-0.5" />
                </motion.button>
              </div>
            </div>
          </div>

          {/* Links Sections */}
          <div>
            <p className="text-white font-bold mb-6">Services</p>
            <ul className="space-y-4 text-sm text-slate-400">
              <li><button onClick={() => nav('/services')} className="hover:text-zappy-400 transition-colors">Electronics Rescue</button></li>
              <li><button onClick={() => nav('/services')} className="hover:text-zappy-400 transition-colors">Vehicle Care</button></li>
              <li><button onClick={() => nav('/services')} className="hover:text-zappy-400 transition-colors">Family Assist</button></li>
              <li><button onClick={() => nav('/events')} className="hover:text-zappy-400 transition-colors flex items-center gap-2">Event Portal <span className="text-[9px] font-black bg-fuchsia-500/20 text-fuchsia-400 px-2 py-0.5 rounded-full uppercase">Hot</span></button></li>
              <li><button onClick={() => nav('/services')} className="hover:text-zappy-400 transition-colors">Smart Devices</button></li>
            </ul>
          </div>

          <div>
            <p className="text-white font-bold mb-6">Partners</p>
            <ul className="space-y-4 text-sm text-slate-400">
              <li><button onClick={() => nav('/worker/login')} className="hover:text-zappy-400 transition-colors">Join as a Worker</button></li>
              <li><button onClick={() => nav('/partner/login')} className="hover:text-zappy-400 transition-colors">Event Partner Login</button></li>
              <li><button onClick={() => nav('/partner/advertise')} className="hover:text-zappy-400 transition-colors">Advertise with Zappy</button></li>
              <li><a href="#" className="hover:text-zappy-400 transition-colors">Partner Guidelines</a></li>
            </ul>
          </div>

          <div>
            <p className="text-white font-bold mb-6">Company</p>
            <ul className="space-y-4 text-sm text-slate-400">
              <li><a href="#" className="hover:text-zappy-400 transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-zappy-400 transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-zappy-400 transition-colors">Trust & Safety</a></li>
              <li><a href="#" className="hover:text-zappy-400 transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-zappy-400 transition-colors">Privacy Policy</a></li>
            </ul>
          </div>

        </div>

        {/* Divider */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-800 to-transparent mb-8" />

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
            <span>Made with</span>
            <Heart size={14} className="text-rose-500 fill-rose-500" />
            <span>by the Zappy Team</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#" className="text-slate-500 hover:text-white transition-colors text-sm font-bold">Twitter</a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors text-sm font-bold">Instagram</a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors text-sm font-bold">LinkedIn</a>
          </div>
          
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>100% Secure Platform</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
