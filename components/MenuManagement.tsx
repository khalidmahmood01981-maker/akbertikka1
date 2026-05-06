
import React, { useState } from 'react';
import { MenuItem, UnitType } from '../types';
import { CATEGORIES, ICONS } from '../constants';
import { compressImage } from '../utils/imageCompression';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { api } from '../utils/api';

interface MenuProps {
  items: MenuItem[];
  setItems: (items: MenuItem[]) => void;
  isAdmin: boolean;
  isMasterAdmin: boolean;
  onClose: () => void;
  setIsNavHidden?: (hidden: boolean) => void;
}

const MenuManagement: React.FC<MenuProps> = ({ items, setItems, isAdmin, isMasterAdmin, onClose, setIsNavHidden }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<MenuItem>>({ category: 'BBQ', unit: 'pcs' });
  const [isCompressing, setIsCompressing] = useState(false);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      try {
        // Adjusted to 200px as per user request
        const compressedBase64 = await compressImage(file, 200, 0.8);
        setNewItem(prev => ({ ...prev, image: compressedBase64 }));
      } catch (err) {
        console.error("Image compression failed", err);
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const save = async () => {
    if (!newItem.name || (!newItem.price && newItem.unit !== 'rs')) return alert("Name and Rate required!");
    
    const itemPrice = newItem.unit === 'rs' ? 1 : Number(newItem.price);
    const itemId = editingId || Math.random().toString(36).substr(2, 9);
    
    let finalImageUrl = newItem.image || '';

    // If there's a new Base64 image, upload it to the local server
    if (newItem.image && newItem.image.startsWith('data:image')) {
      try {
        const uploadRes = await api.uploadImage(itemId, newItem.image);
        if (uploadRes && uploadRes.url) {
          finalImageUrl = uploadRes.url; // Use the server-hosted URL (e.g., /items/id.png)
        }
      } catch (e) {
        console.error("Server upload failed, keeping base64 as fallback", e);
      }
    }

    const itemData = {
      id: itemId,
      name: newItem.name!.toUpperCase(),
      price: itemPrice,
      category: newItem.category!,
      unit: newItem.unit as UnitType,
      image: finalImageUrl
    };

    if (editingId) {
        // Update local state immediately for instant feedback
        const updatedList = items.map(i => i.id === editingId ? itemData : i);
        setItems(updatedList);
        
        // Write to Firestore — listener in App.tsx updates all other devices
        await setDoc(doc(db, "items", editingId), itemData);
        // Also update local server immediately for LAN-only operation
        api.saveItems(updatedList).catch(() => {});
        alert("Dish Updated!");
    } else {
        const updatedList = [...items, itemData];
        setItems(updatedList);
        
        await setDoc(doc(db, "items", itemId), itemData);
        // Also update local server immediately for LAN-only operation
        api.saveItems(updatedList).catch(() => {});
        alert("Dish Added!");
    }
    
    setEditingId(null);
    setNewItem({ category: 'BBQ', unit: 'pcs', image: '' });
  };

  const openEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setNewItem(item);
  };

  const openAdd = () => {
    setEditingId(null);
    setNewItem({ category: 'BBQ', unit: 'pcs' });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] text-[var(--text-muted)] active:scale-90 transition-all">{ICONS.X}</button>
            <h2 className="text-3xl font-black tracking-tighter uppercase italic">Menu <span className="text-orange-600">Master</span></h2>
        </div>
      </div>

      {/* Inline Add Form */}
      {isAdmin && (
        <div className="bg-[var(--bg-card)] p-4 rounded-[32px] border border-orange-600/10 space-y-3 shadow-lg mx-1">
          <h4 className="text-[11px] font-black uppercase text-orange-600 tracking-[0.2em] px-2 italic">
            {editingId ? 'Edit' : 'Add New'} <span className="text-white">Dish</span>
          </h4>
          
          <div className="space-y-3 bg-black/20 p-5 rounded-[32px] border border-white/5">
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="DISH NAME" 
                className="w-full p-4 bg-[var(--bg-main)] rounded-2xl border border-[var(--border)] font-black text-xs outline-none focus:border-orange-600 uppercase" 
                value={newItem.name || ''} 
                onChange={e => setNewItem({...newItem, name: e.target.value})} 
              />
              
              <div className="grid grid-cols-2 gap-3">
                <select 
                  className="w-full p-4 bg-[var(--bg-main)] border border-[var(--border)] rounded-2xl font-black uppercase text-orange-600 outline-none text-xs appearance-none text-center" 
                  value={newItem.category} 
                  onChange={e => setNewItem({...newItem, category: e.target.value})}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                </select>
                
                <select 
                  className="w-full p-4 bg-[var(--bg-main)] border border-[var(--border)] rounded-2xl font-black uppercase text-orange-600 outline-none text-xs appearance-none text-center" 
                  value={newItem.unit} 
                  onChange={e => setNewItem({...newItem, unit: e.target.value as UnitType})}
                >
                  <option value="pcs">PCS</option>
                  <option value="kg">KG</option>
                  <option value="rs">Rs.</option>
                </select>
              </div>

              {newItem.unit !== 'rs' && (
                <input 
                  type="number" 
                  placeholder="RATE (RS)" 
                  className="w-full p-4 bg-[var(--bg-main)] rounded-2xl border border-[var(--border)] font-black text-xs outline-none focus:border-orange-600 text-center" 
                  value={newItem.price || ''} 
                  onChange={e => setNewItem({...newItem, price: Number(e.target.value)})} 
                />
              )}

              <div className="flex items-center gap-4 bg-black/20 p-3 rounded-2xl border border-white/5">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
                  {newItem.image ? <img src={api.getImageUrl(newItem.image)} className="w-full h-full object-cover" /> : ICONS.Package}
                </div>
                <div className="flex-1">
                  <input type="file" id="menu-img-inline" accept="image/*" onChange={handleImage} className="hidden" />
                  <label htmlFor="menu-img-inline" className="block text-center p-3 bg-white/5 text-white rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer active:scale-95 transition-all border border-white/5">
                    {isCompressing ? 'Compressing...' : (newItem.image ? 'Change Photo' : 'Upload Photo')}
                  </label>
                </div>
              </div>
            </div>

            <button 
              onClick={save}
              disabled={isCompressing}
              className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-orange-600/20 active:scale-95 transition-all"
            >
              {editingId ? 'Update Dish' : 'Add Dish to Menu'}
            </button>
            
            {editingId && (
              <button 
                onClick={() => { setEditingId(null); setNewItem({ category: 'BBQ', unit: 'pcs' }); }}
                className="w-full py-2 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest"
              >
                Cancel Editing
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dishes List */}
      <div className="space-y-3 px-1">
        <p className="text-[9px] font-black uppercase text-[var(--text-muted)] ml-4 tracking-widest italic">Active Dishes ({items.length})</p>
        
        {items.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-[var(--border)] rounded-[40px] text-[var(--text-muted)] font-black uppercase text-[10px] tracking-widest mx-1">
            No Dishes Found
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {items.map(item => (
              <div key={item.id} className="bg-[var(--bg-card)] p-5 rounded-[32px] border border-[var(--border)] flex flex-col shadow-md group gap-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--bg-main)] shrink-0 overflow-hidden border border-[var(--border)]">
                      <img src={api.getImageUrl(item.image)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-sm uppercase text-[var(--text-main)] truncate italic tracking-tight">{item.name}</p>
                        <span className="px-2 py-0.5 rounded-full bg-orange-600/10 text-orange-600 text-[7px] font-black uppercase tracking-widest border border-orange-600/20">{item.category}</span>
                      </div>
                      <p className="text-[9px] text-[var(--text-muted)] font-black uppercase mt-0.5">
                        {item.unit === 'rs' ? 'Price Based' : `Rate: Rs.${item.price} / ${item.unit.toUpperCase()}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {isAdmin && (
                      <button 
                        onClick={() => openEdit(item)}
                        className="p-3 bg-white/5 text-blue-500 rounded-xl active:scale-90 transition-all border border-white/5"
                      >
                        {ICONS.Settings}
                      </button>
                    )}
                    {isMasterAdmin && (
                      <button 
                        onClick={async () => { 
                          if(confirm(`Delete ${item.name}?`)) {
                            await deleteDoc(doc(db, "items", item.id));
                            // Also update local server
                            api.saveItems(items.filter(i => i.id !== item.id)).catch(() => {});
                          }
                        }}
                        className="p-3 bg-red-500/10 text-red-500 rounded-xl active:scale-90 transition-all"
                      >
                        {ICONS.Trash2}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal (Optional, but kept for consistency if needed, though inline edit is also possible) */}
      {/* For now, I've implemented inline edit by populating the top form when 'Settings' is clicked */}
    </div>
  );
};

export default MenuManagement;
