import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ICONS } from '../constants';

interface CustomerLoginProps {
  onLogin: (name: string, phone: string) => void;
  onExit: () => void;
  onStaffLogin: () => void;
  logo?: string;
}

const CustomerLogin: React.FC<CustomerLoginProps> = ({ onLogin, onExit, onStaffLogin, logo }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && phone) {
      onLogin(name, phone);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-[var(--bg-card)] rounded-[40px] border border-[var(--border)] p-8 shadow-2xl space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="w-[200px] h-[200px] bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/10 shadow-lg overflow-hidden p-2">
            <img src={logo || "/logo.png"} className="w-full h-full object-contain" alt="Logo" />
          </div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">Akbar <span className="text-orange-600">Tikka</span></h2>
          <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Please enter your details to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4 tracking-widest">Your Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ali Khan"
              required
              className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-black placeholder:text-white/10 focus:border-orange-600 transition-all outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4 tracking-widest">WhatsApp Number</label>
            <input 
              type="tel" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 03001234567"
              required
              className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-black placeholder:text-white/10 focus:border-orange-600 transition-all outline-none"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-orange-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-600/20 active:scale-95 transition-all mt-4"
          >
            View Menu
          </button>
          <div className="grid grid-cols-2 gap-4">
            <button 
              type="button"
              onClick={onStaffLogin}
              className="py-4 bg-white/5 text-[var(--text-muted)] font-black uppercase text-[10px] tracking-widest rounded-2xl hover:text-white transition-colors border border-white/5"
            >
              Staff Login
            </button>
            <button 
              type="button"
              onClick={onExit}
              className="py-4 bg-white/5 text-[var(--text-muted)] font-black uppercase text-[10px] tracking-widest rounded-2xl hover:text-white transition-colors border border-white/5"
            >
              Exit
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default CustomerLogin;
