import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MenuItem, Order, OrderItem } from '../types';
import { ICONS, CATEGORIES } from '../constants';

interface CustomerMenuProps {
  items: MenuItem[];
  businessName: string;
  customerName: string;
  customerPhone: string;
  customerOrders: Order[];
  onSendOrder: (order: Order) => void;
  onUpdateOrder: (order: Order) => void;
  onLogout: () => void;
  tableNumber?: string;
}

const CustomerMenu: React.FC<CustomerMenuProps> = ({ items, businessName, customerName, customerPhone, customerOrders, onSendOrder, onUpdateOrder, onLogout, tableNumber }) => {
  const [dismissBill, setDismissBill] = useState(false);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedQty, setSelectedQty] = useState(1);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [localTableNumber, setLocalTableNumber] = useState(tableNumber || '');

  const activeOrders = customerOrders.filter(o => o.status && ['pending_customer', 'received', 'preparing', 'ready', 'accepted'].includes(o.status));
  const servedOrders = customerOrders.filter(o => 
    (o.status === 'served' || o.status === 'delivered' || o.status === 'collected') &&
    new Date(o.timestamp).toDateString() === new Date().toDateString()
  );

  const sortedAllOrders = [...customerOrders].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const latestServedOrder = [...servedOrders].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];

  const isBillSeen = latestServedOrder ? localStorage.getItem(`bill_seen_${latestServedOrder.id}`) === 'true' : false;
  const isServed = servedOrders.length > 0 && activeOrders.length === 0 && !dismissBill && !isBillSeen;

  const getOrderSequenceNumber = (orderId: string) => {
    const index = sortedAllOrders.findIndex(o => o.id === orderId);
    return index !== -1 ? index + 1 : null;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending_customer': return 'Waiter ka Intezar Hai';
      case 'received': return 'Order Mil Gaya';
      case 'preparing': return 'Kitchen Mein Ban Raha Hai';
      case 'ready': return 'Tayyar Hai / Ready!';
      default: return status;
    }
  };

  const filteredItems = activeCategory === 'ALL' 
    ? items 
    : items.filter(i => i.category === activeCategory);

  const handleAddToCart = () => {
    if (!selectedItem) return;
    setCart(prev => {
      const existing = prev.find(i => i.id === selectedItem.id);
      if (existing) {
        return prev.map(i => i.id === selectedItem.id ? { ...i, quantity: i.quantity + selectedQty } : i);
      }
      return [...prev, { ...selectedItem, quantity: selectedQty }];
    });
    setSelectedItem(null);
    setSelectedQty(1);
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);


  const handleSendOrder = async () => {
    if (cart.length === 0) return;

    const orderId = `CUST-ORD-${Date.now()}`;
    const order: Order = {
      id: orderId,
      orderNumber: Math.floor(Math.random() * 9000) + 1000,
      timestamp: Date.now(),
      items: cart,
      subtotal: total,
      tax: 0,
      discount: 0,
      total: total,
      customerName,
      customerPhone,
      status: 'pending_customer',
      paymentMethod: 'cash',
      statusTimestamps: { 'pending_customer': Date.now() },
      tableNumber: localTableNumber
    };

    onSendOrder(order);
    setCart([]);
    setShowCart(false);
  };

  const submitFeedback = () => {
    if (!latestServedOrder) return;
    const updatedOrder: Order = {
      ...latestServedOrder,
      feedback: {
        rating: feedbackRating,
        comment: feedbackComment,
        timestamp: Date.now()
      }
    };
    onUpdateOrder(updatedOrder);
    setFeedbackSubmitted(true);
  };

  const handleDismissBill = () => {
    if (latestServedOrder) {
      localStorage.setItem(`bill_seen_${latestServedOrder.id}`, 'true');
    }
    setDismissBill(true);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-32">
      {/* Served Overlay with Bill & Feedback */}
      <AnimatePresence>
        {isServed && latestServedOrder && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl overflow-y-auto"
          >
            <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-md bg-[var(--bg-card)] rounded-[48px] border border-white/5 p-8 text-center space-y-8 shadow-2xl"
              >
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-[32px] mx-auto flex items-center justify-center text-3xl border border-emerald-500/20">
                  {ICONS.CheckCircle}
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Order Served!</h2>
                  <p className="text-orange-600 font-black uppercase tracking-[0.2em] text-[10px]">Shukriya! Aapka Bill Neeche Hai</p>
                </div>

                {/* Digital Bill */}
                <div className="bg-black/40 rounded-3xl p-6 border border-white/5 space-y-4 text-left">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Order Number</p>
                    <div className="flex gap-4">
                      {latestServedOrder.tableNumber && (
                        <p className="text-xl font-black text-emerald-500 uppercase">T-{latestServedOrder.tableNumber}</p>
                      )}
                      <p className="text-xl font-black text-orange-600 uppercase">#{getOrderSequenceNumber(latestServedOrder.id) || latestServedOrder.id.slice(-6)}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {latestServedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs font-black uppercase italic">
                        <span className="text-[var(--text-muted)]">{item.quantity}x {item.name}</span>
                        <span className="text-white">Rs.{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                    <p className="text-sm font-black text-white uppercase italic">Total Amount</p>
                    <p className="text-xl font-black text-emerald-500 tracking-tighter italic">Rs.{latestServedOrder.total}</p>
                  </div>
                </div>

                {/* Customer Feedback */}
                {!feedbackSubmitted ? (
                  <div className="space-y-6 pt-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Aapko hamara khana kaisa laga?</p>
                      <div className="flex justify-center gap-3">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            onClick={() => setFeedbackRating(star)}
                            className={`text-3xl transition-all ${feedbackRating >= star ? 'text-yellow-500 scale-110' : 'text-white/10'}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <textarea
                      placeholder="Kuch mazeed batana chahen gey? (Optional)"
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs font-black uppercase placeholder:opacity-30 focus:border-orange-600 outline-none h-24 resize-none transition-all"
                    />

                    <button 
                      onClick={submitFeedback}
                      disabled={feedbackRating === 0}
                      className={`w-full py-5 rounded-[24px] font-black uppercase tracking-widest transition-all ${feedbackRating > 0 ? 'bg-orange-600 text-white shadow-xl shadow-orange-600/20 active:scale-95' : 'bg-white/5 text-white/20'}`}
                    >
                      Submit Feedback
                    </button>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl"
                  >
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Shukriya! Aapka feedback humein mil gaya hai.</p>
                  </motion.div>
                )}

                <div className="pt-4 flex flex-col gap-3">
                  <button 
                    onClick={handleDismissBill}
                    className="w-full py-5 bg-orange-600 text-white rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-orange-600/20 active:scale-95 transition-all"
                  >
                    Order Again 🍕
                  </button>
                  <button 
                    onClick={() => {
                      handleDismissBill();
                      onLogout();
                    }}
                    className="w-full py-4 bg-white/5 text-[var(--text-muted)] rounded-[20px] font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all"
                  >
                    Logout / Exit
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[var(--bg-main)]/80 backdrop-blur-xl border-b border-[var(--border)] p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onLogout}
            className="p-2 text-red-500 bg-red-500/10 rounded-lg active:scale-90 transition-all"
          >
            {ICONS.X}
          </button>
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter text-white">{businessName}</h1>
            <p className="text-[8px] font-black text-orange-600 uppercase tracking-widest">Welcome, {customerName} {localTableNumber ? `• Table ${localTableNumber}` : ''}</p>
          </div>
        </div>
        <button 
          onClick={() => setShowCart(true)}
          className="relative p-3 bg-orange-600/10 text-orange-600 rounded-2xl border border-orange-600/20 active:scale-90 transition-all"
        >
          {ICONS.ShoppingBag}
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[var(--bg-main)]">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* Categories */}
      <div className="flex gap-3 overflow-x-auto p-6 no-scrollbar sticky top-[73px] z-40 bg-[var(--bg-main)]/80 backdrop-blur-xl">
        <button 
          onClick={() => setActiveCategory('ALL')}
          className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeCategory === 'ALL' ? 'bg-orange-600 text-white shadow-lg' : 'bg-white/5 text-[var(--text-muted)]'}`}
        >
          ALL
        </button>
        {CATEGORIES.map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-orange-600 text-white shadow-lg' : 'bg-white/5 text-[var(--text-muted)]'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Active Orders Status */}
      <AnimatePresence>
        {activeOrders.length > 0 && (
          <div className="px-6 space-y-3 mb-6">
            <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-2">Active Orders</p>
            {activeOrders.map(order => (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={order.id}
                className="bg-orange-600/10 border border-orange-600/20 p-4 rounded-3xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full animate-pulse ${order.status === 'ready' ? 'bg-emerald-500' : 'bg-orange-600'}`} />
                  <div>
                    <p className="text-[10px] font-black text-white uppercase italic tracking-tight">{getStatusLabel(order.status!)}</p>
                    <p className="text-[8px] font-black text-orange-600/60 uppercase">Order #{getOrderSequenceNumber(order.id) || order.id.slice(-4)}</p>
                  </div>
                </div>
                {order.status === 'ready' && (
                  <div className="bg-emerald-600 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                    Pick Up!
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Item Grid */}
      <div className="grid grid-cols-2 gap-3 px-4">
        <AnimatePresence mode="popLayout">
          {filteredItems.map(item => {
            const cartItem = cart.find(i => i.id === item.id);
            const quantity = cartItem ? cartItem.quantity : 0;
            
            return (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={item.id} 
                onClick={() => setSelectedItem(item)}
                className="bg-[var(--bg-card)] rounded-[24px] border border-[var(--border)] overflow-hidden shadow-lg flex flex-col group active:scale-95 transition-all relative"
              >
                {quantity > 0 && (
                  <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                    <div className="bg-orange-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg border border-white/10">
                      {quantity}x
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromCart(item.id);
                      }}
                      className="bg-red-500/20 backdrop-blur-md text-red-500 p-1.5 rounded-lg shadow-lg border border-red-500/20 active:scale-75 transition-all"
                    >
                      {ICONS.Trash2}
                    </button>
                  </div>
                )}
                <div className="h-32 bg-black/20 relative overflow-hidden">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                    <p className="text-white font-black text-xs italic">Rs.{item.price}</p>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-[7px] font-black text-orange-600 uppercase tracking-widest mb-0.5">{item.category}</p>
                  <h3 className="text-xs font-black uppercase text-white leading-tight italic truncate">{item.name}</h3>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Quantity Popup */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-xs bg-[var(--bg-card)] rounded-[40px] border border-[var(--border)] p-8 shadow-2xl text-center space-y-6"
            >
              <div className="space-y-2">
                <img src={selectedItem.image} className="w-24 h-24 rounded-3xl mx-auto object-cover border-2 border-orange-600/20" alt="" />
                <h3 className="text-xl font-black text-white uppercase italic">{selectedItem.name}</h3>
                <p className="text-orange-600 font-black">Rs.{selectedItem.price}</p>
              </div>

              <div className="flex items-center justify-center gap-6">
                <button 
                  onClick={() => setSelectedQty(prev => Math.max(1, prev - 1))}
                  className="w-12 h-12 rounded-2xl bg-white/5 text-white flex items-center justify-center text-xl active:scale-90 transition-all"
                >
                  {ICONS.Minus}
                </button>
                <span className="text-3xl font-black text-white w-12">{selectedQty}</span>
                <button 
                  onClick={() => setSelectedQty(prev => prev + 1)}
                  className="w-12 h-12 rounded-2xl bg-white/5 text-white flex items-center justify-center text-xl active:scale-90 transition-all"
                >
                  {ICONS.Plus}
                </button>
              </div>

              <button 
                onClick={handleAddToCart}
                className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
              >
                Add to Selection
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cart Modal */}
      <AnimatePresence>
        {showCart && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-[var(--bg-card)] rounded-t-[40px] sm:rounded-[40px] border border-[var(--border)] p-8 shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">Your Selection</h2>
                <button onClick={() => setShowCart(false)} className="p-2 text-[var(--text-muted)]">{ICONS.X}</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pr-2">
                {cart.length === 0 ? (
                  <div className="py-10 text-center space-y-4">
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Your cart is empty</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/5">
                      <img src={item.image} className="w-16 h-16 rounded-2xl object-cover" alt="" />
                      <div className="flex-1">
                        <h4 className="text-sm font-black text-white uppercase italic">{item.name}</h4>
                        <p className="text-[10px] font-black text-orange-600">Rs.{item.price}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white">{ICONS.Minus}</button>
                        <span className="text-sm font-black text-white">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white">{ICONS.Plus}</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Total Amount</p>
                    <p className="text-2xl font-black text-white italic tracking-tighter">Rs.{total}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={handleSendOrder}
                      className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 border-b-4 border-orange-800"
                    >
                      {ICONS.Send} SEND ORDER TO WAITER
                    </button>
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 flex justify-between items-center">
                       <span className="text-[10px] font-black text-white/40 uppercase">Table Number</span>
                       <input 
                         type="text" 
                         value={localTableNumber} 
                         onChange={(e) => setLocalTableNumber(e.target.value)}
                         placeholder="e.g. 5"
                         className="bg-transparent text-right font-black text-orange-600 outline-none w-20"
                       />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {cart.length > 0 && !showCart && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-md"
        >
          <button 
            onClick={() => setShowCart(true)}
            className="w-full bg-orange-600 text-white p-5 rounded-3xl font-black uppercase tracking-widest shadow-2xl shadow-orange-600/40 flex items-center justify-center gap-6 border-b-8 border-orange-800"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">{ICONS.ShoppingBag}</div>
              <span>{cart.length} Items Selected</span>
            </div>
            <span className="text-lg italic tracking-tighter">Rs.{total}</span>
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default CustomerMenu;
