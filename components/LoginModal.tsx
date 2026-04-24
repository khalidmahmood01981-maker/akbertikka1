
import React, { useState } from 'react';
import { ICONS } from '../constants';

interface LoginModalProps {
  onLogin: (pass: string) => void;
  onEnterCustomerMode: () => void;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onLogin, onEnterCustomerMode, onClose }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setTimeout(() => {
      onLogin(password);
      setLoading(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[5000] flex items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-8 animate-in zoom-in duration-500">
        <div className="text-center space-y-4">
           <div className="w-24 h-24 bg-gradient-to-br from-orange-600 to-orange-700 rounded-[32px] mx-auto flex items-center justify-center shadow-2xl rotate-6 border-2 border-white/10">
              <span className="text-white scale-[1.8]">{ICONS.Lock}</span>
           </div>
           <div className="space-y-1">
             <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">Security <span className="text-orange-600">Check</span></h1>
             <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Enter your Access Key</p>
           </div>
        </div>

        <div className="bg-[#111] p-10 rounded-[56px] border border-white/5 shadow-2xl space-y-8 relative overflow-hidden w-full">
           <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 blur-[60px] rounded-full"></div>
           
           <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
              <div className="space-y-4">
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  autoFocus
                  className="w-full p-6 bg-black border border-white/5 rounded-[32px] text-white font-black outline-none focus:border-orange-600 transition-all text-2xl text-center tracking-[0.5em] shadow-inner"
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                />
                <p className="text-[8px] font-bold text-gray-600 text-center uppercase tracking-widest px-4 leading-relaxed">
                  Aapka password decide karega ke aap Admin hain, Owner hain ya Order Taker.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  type="submit" 
                  disabled={loading || !password}
                  className="w-full py-6 bg-orange-600 text-white rounded-[32px] font-black uppercase text-xs tracking-[0.3em] shadow-xl shadow-orange-600/20 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
                >
                  {loading ? 'VERIFYING...' : 'UNLOCK ACCESS'}
                </button>
                <div className="flex items-center gap-3 py-2">
                  <div className="h-px flex-1 bg-white/5"></div>
                  <span className="text-[8px] font-black text-gray-700 uppercase tracking-widest">Ya Phir</span>
                  <div className="h-px flex-1 bg-white/5"></div>
                </div>
                <button 
                  type="button" 
                  onClick={onEnterCustomerMode}
                  className="w-full py-5 bg-white/5 text-emerald-500 rounded-[32px] font-black uppercase text-[10px] tracking-[0.2em] border border-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {ICONS.Utensils} Customer Mode
                </button>
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="w-full py-4 text-gray-600 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
           </form>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
