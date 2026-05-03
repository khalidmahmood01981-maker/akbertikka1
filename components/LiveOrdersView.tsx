import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Order, OrderStatus, StaffMember, AppSettings } from '../types';
import { ICONS, PRINT_TRANSLATIONS } from '../constants';
import TimeElapsed from './TimeElapsed';

interface LiveOrdersViewProps {
  orders: Order[];
  onUpdateStatus: (order: Order, status: OrderStatus) => void;
  onEditOrder: (order: Order) => void;
  activeStaff: StaffMember | null;
  settings: AppSettings;
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
  triggerConfirm: (config: { title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' }) => void;
  isAdmin?: boolean;
  onUpdateOrder: (order: Order) => void;
  handlePrintKitchen: (order: Order) => void;
}

const LiveOrdersView: React.FC<LiveOrdersViewProps> = ({ 
  orders, onUpdateStatus, onEditOrder, activeStaff, settings, notify, triggerConfirm, isAdmin, onUpdateOrder, handlePrintKitchen 
}) => {
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
  const [showSummary, setShowSummary] = useState(false);

  const handlePrintOrder = (order: Order) => {
    handlePrintKitchen(order);
    
    // Update status if it was 'received'
    if (order.status === 'received') {
      onUpdateStatus(order, 'preparing');
    } else {
      onUpdateOrder({ ...order, isPrinted: true });
    }
  };

  const activeOrders = orders
    .filter(o => {
      const kitchenStatuses = ['received', 'preparing', 'ready'];
      const takerStatuses = ['received', 'preparing', 'ready'];
      const allowedStatuses = activeStaff?.role === 'kitchen' ? kitchenStatuses : takerStatuses;

      // Filter by status
      const statusMatch = filterStatus === 'all' 
        ? (o.status && allowedStatuses.includes(o.status))
        : o.status === filterStatus;

      if (!statusMatch) return false;

      // If staff is a taker, only show their own orders
      if (activeStaff?.role === 'taker') {
        return o.orderTakerId === activeStaff.id;
      }

      return true;
    })
    .sort((a, b) => {
      const priority = { 'preparing': 1, 'received': 2, 'ready': 3 };
      const pA = priority[a.status as keyof typeof priority] || 99;
      const pB = priority[b.status as keyof typeof priority] || 99;
      
      if (pA !== pB) return pA - pB;
      return a.timestamp - b.timestamp;
    });

  const aggregatedItems = activeOrders
    .filter(o => o.status !== 'ready')
    .reduce((acc: Record<string, { name: string, quantity: number, unit: string }>, order) => {
      order.items.forEach(item => {
        if (!acc[item.id]) {
          acc[item.id] = { name: item.name, quantity: 0, unit: item.unit };
        }
        acc[item.id].quantity += item.quantity;
      });
      return acc;
    }, {});

  const summaryList = Object.values(aggregatedItems).sort((a: any, b: any) => b.quantity - a.quantity);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'received': return 'bg-blue-500';
      case 'preparing': return 'bg-amber-500';
      case 'ready': return 'bg-emerald-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: OrderStatus) => {
    switch (status) {
      case 'received': return 'New Order';
      case 'preparing': return 'Preparing';
      case 'ready': return 'Ready';
      default: return status;
    }
  };

  const getStatusProgress = (status: OrderStatus) => {
    switch (status) {
      case 'received': return 33;
      case 'preparing': return 66;
      case 'ready': return 100;
      default: return 0;
    }
  };

  const isKitchen = activeStaff?.role === 'kitchen';

  const stats = {
    new: orders.filter(o => o.status === 'received').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready: orders.filter(o => o.status === 'ready').length,
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Kitchen Header & Stats */}
      <div className="bg-[var(--bg-card)] p-4 sm:p-8 rounded-[32px] sm:rounded-[48px] border border-white/5 shadow-2xl space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-lg ${isKitchen ? 'bg-orange-600 text-white shadow-orange-600/20' : 'bg-blue-600 text-white shadow-blue-600/20'}`}>
              {isKitchen ? ICONS.ChefHat : ICONS.History}
            </div>
            <div>
              <h2 className="text-xl sm:text-3xl font-black uppercase italic tracking-tighter text-white leading-none">
                {isKitchen ? 'Kitchen' : 'Order'} <span className={isKitchen ? 'text-orange-600' : 'text-blue-600'}>Monitor</span>
              </h2>
              <p className="text-[7px] sm:text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">
                {isKitchen ? 'Real-time production dashboard' : 'Track your active orders'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {isKitchen && (
              <div className="flex gap-2">

                <button 
                  onClick={() => setShowSummary(!showSummary)}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 whitespace-nowrap ${
                    showSummary ? 'bg-orange-600 text-white border-orange-600 shadow-lg' : 'bg-white/5 text-orange-600 border-orange-600/20 hover:bg-white/10'
                  }`}
                >
                  {ICONS.Settings}
                  <span className="hidden xs:inline">{showSummary ? 'Hide Summary' : 'Show Summary'}</span>
                  <span className="xs:hidden">{showSummary ? 'Hide' : 'Summary'}</span>
                </button>
              </div>
            )}
            <div className="bg-black/40 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border border-white/5 text-center min-w-[60px] sm:min-w-[80px]">
              <p className="text-[6px] sm:text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Active</p>
              <p className="text-sm sm:text-lg font-black text-white">{activeOrders.length}</p>
            </div>
          </div>
        </div>

        {isKitchen && showSummary && summaryList.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/60 p-6 rounded-[32px] border border-orange-600/20 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
                <h4 className="text-[12px] font-black uppercase tracking-widest text-orange-600">Production Summary</h4>
              </div>
              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">{summaryList.length} Items Total</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {summaryList.map((item: any, idx) => (
                <div key={idx} className="bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-white/5 hover:border-orange-600/30 transition-all">
                  <span className="text-[12px] font-black text-white/90 uppercase truncate pr-2">{item.name}</span>
                  <span className="bg-orange-600 text-white px-3 py-1.5 rounded-xl text-[12px] font-black min-w-[32px] text-center shadow-lg shadow-orange-600/20">
                    {item.unit === 'rs' ? 'Any' : item.quantity}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {isKitchen && !showSummary && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-600/10 border border-blue-600/20 p-4 rounded-[24px] text-center group hover:bg-blue-600/20 transition-all">
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">New</p>
              <p className="text-3xl font-black text-white group-hover:scale-110 transition-transform">{stats.new}</p>
            </div>
            <div className="bg-amber-600/10 border border-amber-600/20 p-4 rounded-[24px] text-center group hover:bg-amber-600/20 transition-all">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Cooking</p>
              <p className="text-3xl font-black text-white group-hover:scale-110 transition-transform">{stats.preparing}</p>
            </div>
            <div className="bg-emerald-600/10 border border-emerald-600/20 p-4 rounded-[24px] text-center group hover:bg-emerald-600/20 transition-all">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Ready</p>
              <p className="text-3xl font-black text-white group-hover:scale-110 transition-transform">{stats.ready}</p>
            </div>
          </div>
        )}
      </div>


          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">
            {(['all', 'received', 'preparing', 'ready'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${
                  filterStatus === s 
                    ? 'bg-orange-600 text-white border-orange-600 shadow-xl scale-105' 
                    : 'bg-white/5 text-[var(--text-muted)] border-white/5 hover:bg-white/10'
                }`}
              >
                {s === 'all' ? 'All Active' : getStatusLabel(s)}
              </button>
            ))}
          </div>

          <div className={`grid gap-3 sm:gap-4 px-1 ${isKitchen ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            <AnimatePresence mode="popLayout">
              {activeOrders.map(order => {
                const timeDiff = Date.now() - order.timestamp;
                const isUrgent = timeDiff > 15 * 60 * 1000 && order.status !== 'ready';

            return (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={order.id}
                className={`bg-[var(--bg-card)] rounded-[24px] sm:rounded-[32px] border p-4 sm:p-5 space-y-3 sm:space-y-4 shadow-2xl relative overflow-hidden flex flex-col h-full transition-all duration-500 ${
                  isUrgent ? 'border-red-600/50 ring-2 ring-red-600/20 bg-red-600/5' : 'border-[var(--border)]'
                } ${
                  order.status === 'received' ? 'ring-2 ring-blue-500 ring-offset-4 ring-offset-black' : ''
                } ${
                  order.status === 'ready' ? 'border-emerald-500/50 bg-emerald-500/5' : ''
                } ${order.isPrinted ? 'bg-emerald-600/5 border-emerald-600/30' : ''}`}
              >
                {/* Progress Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${getStatusProgress(order.status!)}%` }}
                    className={`h-full transition-all duration-1000 ${getStatusColor(order.status!)}`}
                  />
                </div>

                {/* Status Header */}
                <div className="flex justify-between items-start pt-1">
                  <div className="space-y-1.5 flex-1 mr-2">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="text-base sm:text-2xl font-black text-orange-600 uppercase tracking-widest bg-orange-600/10 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg border border-orange-600/20">#{order.orderNumber || '??'}</span>
                      <span className={`px-2 py-0.5 rounded-lg text-[7px] sm:text-[9px] font-black text-white uppercase tracking-widest shadow-lg ${getStatusColor(order.status!)}`}>
                        {getStatusLabel(order.status!)}
                      </span>
                      {order.tableNumber ? (
                        <span className="bg-orange-600/10 text-orange-600 px-2 py-0.5 rounded-lg text-[7px] sm:text-[9px] font-black uppercase tracking-widest border border-orange-600/20">
                          T-{order.tableNumber}
                        </span>
                      ) : (
                        <span className="bg-blue-600/10 text-blue-600 px-2 py-0.5 rounded-lg text-[7px] sm:text-[9px] font-black uppercase tracking-widest border border-blue-600/20">
                          Takeaway
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg sm:text-2xl font-black text-white uppercase italic tracking-tighter leading-tight mt-1">
                      {order.customerName}
                    </h3>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[8px] sm:text-[10px] font-black text-[var(--text-muted)] uppercase">
                      {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <TimeElapsed 
                      timestamp={order.timestamp} 
                      statusTimestamps={order.statusTimestamps}
                      currentStatus={order.status}
                      className={`text-[8px] sm:text-[10px] font-black uppercase block mt-1 ${isUrgent ? 'text-red-500 animate-pulse' : 'text-orange-600'}`}
                    />
                  </div>
                </div>

                {/* Items List / Kitchen Tickets */}
                <div className="flex-1 space-y-3 bg-black/40 p-3 sm:p-5 rounded-[28px] border border-white/5 shadow-inner overflow-y-auto">
                  {order.kitchenTickets && order.kitchenTickets.length > 0 ? (
                    <div className="space-y-4">
                      {order.kitchenTickets.slice(-1).map(ticket => (
                        <div key={ticket.id} className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/10 relative">
                          {order.kitchenTickets!.length > 1 && (
                            <div className="absolute -top-3 left-4 bg-orange-600 font-black text-[9px] uppercase tracking-widest px-3 py-1 rounded-xl text-white shadow-lg border border-orange-500/50">
                              Ticket {ticket.round}
                            </div>
                          )}
                          <div className={order.kitchenTickets!.length > 1 ? "pt-2 space-y-2" : "space-y-2"}>
                            {ticket.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center border-b border-white/5 last:border-0 pb-2.5 last:pb-0 pt-2.5 first:pt-0">
                                <div className="flex items-center gap-4">
                                  <span className="w-9 h-9 bg-orange-600 text-white rounded-2xl flex items-center justify-center text-base font-black shadow-xl ring-4 ring-orange-600/10">
                                    {item.quantity > 0 && order.kitchenTickets!.length > 1 ? `+${item.quantity}` : item.quantity}
                                  </span>
                                  <span className="text-sm sm:text-lg font-black text-white/90 uppercase tracking-tight italic leading-tight">{item.name}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center border-b border-white/5 last:border-0 pb-2.5 last:pb-0 pt-2.5 first:pt-0">
                          <div className="flex items-center gap-4">
                            <span className="w-9 h-9 bg-orange-600 text-white rounded-2xl flex items-center justify-center text-base font-black shadow-xl ring-4 ring-orange-600/10">
                              {item.quantity}
                            </span>
                             <span className="text-sm sm:text-lg font-black text-white/90 uppercase tracking-tight italic leading-tight">{item.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {order.kitchenNotes && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-amber-500 scale-75">{ICONS.Settings}</span>
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Special Instructions</p>
                      </div>
                      <p className="text-sm text-white/80 italic leading-snug bg-amber-500/5 p-3 rounded-2xl border border-amber-500/10">
                        {order.kitchenNotes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                  <div className="flex gap-2 pt-1">
                    {(isAdmin || isKitchen) && (
                      <button 
                        onClick={() => triggerConfirm({
                          title: "Cancel Order?",
                          message: "Kya aap waqai is order ko cancel karna chahte hain?",
                          onConfirm: () => onUpdateStatus(order, 'cancelled')
                        })}
                        className="p-3 sm:p-4 bg-red-600/10 text-red-500 rounded-xl sm:rounded-2xl active:scale-95 transition-all hover:bg-red-600/20"
                        title="Cancel Order"
                      >
                        {ICONS.Trash2}
                      </button>
                    )}

                    <button 
                      onClick={() => handlePrintOrder(order)}
                      className="p-3 sm:p-4 bg-blue-600/10 text-blue-500 rounded-xl sm:rounded-2xl active:scale-95 transition-all hover:bg-blue-600/20"
                      title="Print KOT"
                    >
                      {ICONS.Printer}
                    </button>

                    {order.status === 'received' && (
                    <button 
                      onClick={() => {
                        onUpdateStatus(order, 'preparing');
                      }}
                      className="flex-1 py-3 sm:py-5 bg-indigo-600 text-white rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-[12px] tracking-widest active:scale-95 transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2"
                    >
                      {ICONS.CheckCircle}
                      <span>Receive</span>
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button 
                      onClick={() => onUpdateStatus(order, 'ready')}
                      className="flex-1 py-4 sm:py-5 bg-emerald-600 text-white rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-[12px] tracking-widest active:scale-95 transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2"
                    >
                      {ICONS.Utensils}
                      <span>Ready</span>
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <div className="flex-1 py-4 sm:py-5 bg-emerald-600/20 text-emerald-500 rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-[12px] tracking-widest flex items-center justify-center gap-2 border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/10 animate-pulse">
                      <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
                      <span>DONE</span>
                    </div>
                  )}

                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LiveOrdersView;
