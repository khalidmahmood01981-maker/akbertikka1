import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Order, AppSettings, StaffMember, OrderStatus } from '../types';
import { ICONS } from '../constants';

interface CashierViewProps {
  orders: Order[];
  onUpdateOrder: (order: Order) => void;
  settings: AppSettings;
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
  triggerConfirm: (config: { title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' }) => void;
  isAdmin?: boolean;
  activeStaff?: StaffMember | null;
}

const CashierView: React.FC<CashierViewProps> = ({ 
  orders, onUpdateOrder, settings, notify, triggerConfirm, isAdmin, activeStaff 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [receivedAmount, setReceivedAmount] = useState<string>('');

  // Filter orders that are active but not yet collected/paid
  const pendingOrders = useMemo(() => {
    return orders.filter(o => {
      // Only show orders from today/active session if possible, 
      // but for simplicity we show all that aren't collected/cancelled
      const isActive = o.status !== 'collected' && o.status !== 'cancelled' && o.status !== 'delivered';
      const isNotPaid = o.paymentStatus !== 'paid';
      
      if (!isActive || !isNotPaid) return false;

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          o.customerName.toLowerCase().includes(search) ||
          o.orderNumber?.toString().includes(search) ||
          o.tableNumber?.toLowerCase().includes(search)
        );
      }
      return true;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [orders, searchTerm]);

  const totalPendingAmount = pendingOrders.reduce((sum, o) => sum + o.total, 0);

  const handleShareWhatsApp = (order: Order) => {
    try {
      const rawPhone = order.customerPhone?.trim();
      if (!rawPhone || rawPhone.length < 5) {
        notify("Mobile number lazmi hai!", "error");
        return;
      }

      let cleanPhone = rawPhone.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = (settings?.whatsappCountryCode || '92') + cleanPhone.substring(1);
      } else if (!cleanPhone.startsWith(settings?.whatsappCountryCode || '92')) {
        cleanPhone = (settings?.whatsappCountryCode || '92') + cleanPhone;
      }

      const headerName = settings.businessName;
      const dateStr = new Date(order.timestamp).toLocaleDateString();
      const tableStr = order.tableNumber ? `Table: ${order.tableNumber}\n` : '';
      const itemsList = order.items.map(item => `• ${item.name} (${item.unit === 'rs' ? 'Rs.' : 'x'}${item.quantity}): Rs.${(item.price * item.quantity).toFixed(0)}`).join('\n');

      const deliveryStr = order.deliveryFee && order.deliveryFee > 0 ? `Delivery Fee: Rs. ${order.deliveryFee.toFixed(0)}\n` : '';
      const message = `*${headerName} - INVOICE*\n--------------------------\nOrder ID: ${order.id.slice(-6).toUpperCase()}\nOrder No: #${order.orderNumber}\nDate: ${dateStr}\n${tableStr}Customer: ${order.customerName}\nPayment Status: PAID\n--------------------------\n${itemsList}\n--------------------------\nSubtotal: Rs. ${order.subtotal.toFixed(0)}\n${deliveryStr}*Grand Total: Rs. ${order.total.toFixed(0)}*\n--------------------------\nShukriya! Phir zaroor aaiye ga.`;
      
      const encodedMsg = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
      window.open(whatsappUrl, '_blank');
      notify("Opening WhatsApp...", "success");
    } catch (e) {
      notify("WhatsApp Error: " + (e as Error).message, "error");
    }
  };

  const handleCompletePayment = () => {
    if (!selectedOrder) return;
    
    const received = parseFloat(receivedAmount) || 0;
    if (received === 0) return notify("Pehly raqm enter karein!", "error");

    if (received < selectedOrder.total) {
      const shortage = selectedOrder.total - received;
      triggerConfirm({
        title: "Short Payment?",
        message: `Customer ne Rs.${shortage} kum diye hain. Kya aap Rs.${shortage} ko DISCOUNT mein daal kar bill settle karna chahte hain?`,
        onConfirm: () => finalizePayment(received)
      });
    } else {
      finalizePayment(received);
    }
  };

  const finalizePayment = (received: number) => {
    if (!selectedOrder) return;

    const shortage = selectedOrder.total - received;
    const extraDiscount = shortage > 0 ? shortage : 0;
    const finalTotal = shortage > 0 ? received : selectedOrder.total;
    
    const updatedOrder: Order = {
      ...selectedOrder,
      status: 'collected', 
      receivedAmount: received,
      balance: 0,
      discount: (selectedOrder.discount || 0) + extraDiscount,
      total: finalTotal,
      cashierId: activeStaff?.id || 'admin',
      cashierName: activeStaff?.name || 'Admin',
      paymentStatus: 'paid',
      statusTimestamps: {
        ...(selectedOrder.statusTimestamps || {}),
        collected: Date.now()
      }
    };

    onUpdateOrder(updatedOrder);
    if (extraDiscount > 0) {
      notify(`Order settled with Rs.${extraDiscount} extra discount.`, "success");
    } else {
      notify(`Payment for Order #${selectedOrder.orderNumber} completed!`, "success");
    }
    setSelectedOrder(null);
    setReceivedAmount('');
  };

  return (
    <div className="space-y-4 pb-20 px-1">
      {/* Header & Search */}
      <div className="bg-[var(--bg-card)] p-6 rounded-[32px] border border-white/5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-600/20">
              {ICONS.Zap}
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">
                Cashier <span className="text-emerald-500">Desk</span>
              </h2>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">Collect payments & settle bills</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="bg-black/40 px-4 py-2 rounded-2xl border border-white/5 text-right">
              <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Discount</p>
              <p className="text-xl font-black text-orange-500 italic leading-none">Rs. {orders.reduce((sum, o) => {
                // Simplified "today" check
                const isToday = new Date(o.timestamp).toDateString() === new Date().toDateString();
                return sum + (isToday ? (o.discount || 0) : 0);
              }, 0).toFixed(0)}</p>
            </div>
            <div className="bg-black/40 px-4 py-2 rounded-2xl border border-white/5 text-right">
              <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Pending</p>
              <p className="text-xl font-black text-emerald-500 italic leading-none">Rs. {totalPendingAmount.toFixed(0)}</p>
            </div>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center text-[var(--text-muted)] group-focus-within:text-emerald-500 transition-colors">
            {ICONS.Search}
          </div>
          <input 
            type="text"
            placeholder="SEARCH BY ORDER #, NAME OR TABLE..."
            className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-[10px] font-black text-white uppercase tracking-widest focus:border-emerald-500 outline-none transition-all shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="grid gap-3">
        <AnimatePresence mode="popLayout">
          {pendingOrders.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-black/20 p-12 rounded-[32px] border border-dashed border-white/5 text-center"
            >
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">No Pending Payments Found</p>
            </motion.div>
          ) : (
            pendingOrders.map((order, idx) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[var(--bg-card)] p-4 rounded-[24px] border border-white/5 flex items-center justify-between shadow-xl group hover:border-emerald-500/30 transition-all active:scale-[0.98] cursor-pointer"
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-emerald-600/10 rounded-2xl border-2 border-emerald-600/30 flex flex-col items-center justify-center text-emerald-500 shadow-lg">
                    <span className="text-[9px] font-black leading-none">ORDER</span>
                    <span className="text-2xl font-black leading-none">#{order.orderNumber}</span>
                  </div>
                  <div>
                    <h3 className="font-black text-white uppercase italic tracking-tight">{order.customerName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                        {order.tableNumber ? `Table: ${order.tableNumber}` : 'Takeaway'}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-white/20"></span>
                      <span className="text-[9px] font-black text-blue-500 uppercase">
                        {order.status || 'Received'}
                      </span>
                      {order.discount > 0 && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-white/20"></span>
                          <span className="text-[9px] font-black text-orange-500 uppercase">
                            Disc: -Rs.{order.discount.toFixed(0)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-none">Net Payable</p>
                    <p className="text-xl font-black text-emerald-500 tracking-tighter mt-1 italic leading-none">Rs. {order.total.toFixed(0)}</p>
                    {order.discount > 0 && (
                      <p className="text-[7px] font-black text-orange-600 uppercase mt-1">Saved: Rs.{order.discount.toFixed(0)}</p>
                    )}
                  </div>
                  <div className="p-3 bg-emerald-600 rounded-xl text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg shadow-emerald-600/20">
                    {ICONS.CheckCircle}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Payment Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[600] flex flex-col items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[40px] w-full max-w-sm border border-white/5 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in max-h-[95vh] overflow-y-auto no-scrollbar">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Settle <span className="text-emerald-500">Bill</span></h3>
                <p className="text-2xl font-black text-orange-600 uppercase italic tracking-tighter">ORDER #{selectedOrder.orderNumber}</p>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white"
              >
                {ICONS.X}
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-black/40 p-4 rounded-[24px] border border-white/5 space-y-3 shadow-inner">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] border-b border-white/5 pb-2">
                  <span>Subtotal:</span>
                  <span className="text-white">Rs. {selectedOrder.subtotal.toFixed(0)}</span>
                </div>
                {selectedOrder.tax > 0 && (
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] border-b border-white/5 pb-2">
                    <span>Tax:</span>
                    <span className="text-white">Rs. {selectedOrder.tax.toFixed(0)}</span>
                  </div>
                )}
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-orange-500 border-b border-white/5 pb-2">
                    <span>Discount:</span>
                    <span>-Rs. {selectedOrder.discount.toFixed(0)}</span>
                  </div>
                )}
                <div className="text-center pt-2">
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Total Payable</p>
                  <p className="text-5xl font-black text-white tracking-tighter italic">Rs. {selectedOrder.total.toFixed(0)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Received Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-black text-xl italic">Rs.</span>
                  <input 
                    type="number"
                    autoFocus
                    placeholder="ENTER AMOUNT..."
                    className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-6 pl-14 pr-4 text-3xl font-black text-white tracking-tighter outline-none focus:border-emerald-600 transition-all"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                  />
                </div>
              </div>

              {receivedAmount && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`border p-4 rounded-2xl text-center shadow-lg ${parseFloat(receivedAmount) < selectedOrder.total ? 'bg-rose-600/10 border-rose-600/30' : 'bg-emerald-600/10 border-emerald-600/30'}`}
                >
                  <p className={`text-[10px] font-black uppercase tracking-widest ${parseFloat(receivedAmount) < selectedOrder.total ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {parseFloat(receivedAmount) < selectedOrder.total ? 'Baqi - CASH' : 'Wapsi (Change)'}
                  </p>
                  <p className={`text-3xl font-black tracking-tighter italic mt-1 ${parseFloat(receivedAmount) < selectedOrder.total ? 'text-rose-600' : 'text-emerald-500'}`}>
                    {parseFloat(receivedAmount) < selectedOrder.total ? '-' : ''}Rs. {Math.abs(parseFloat(receivedAmount) - selectedOrder.total).toFixed(0)}
                  </p>
                  {parseFloat(receivedAmount) < selectedOrder.total && (
                    <p className="text-[7px] font-black text-rose-500/60 uppercase mt-1 tracking-widest italic">
                      Total Discount: Rs. {((selectedOrder.discount || 0) + (selectedOrder.total - parseFloat(receivedAmount))).toFixed(0)}
                    </p>
                  )}
                </motion.div>
              )}

              <div className="flex gap-2">
                {[500, 1000, 5000].map(amt => (
                  <button 
                    key={amt}
                    onClick={() => setReceivedAmount(amt.toString())}
                    className="flex-1 py-2 bg-white/5 rounded-xl text-[10px] font-black text-[var(--text-muted)] border border-white/5 hover:border-white/20 transition-all uppercase"
                  >
                    +{amt}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 pt-0 space-y-2">
              <button 
                onClick={handleCompletePayment}
                disabled={!receivedAmount}
                className="w-full py-6 bg-emerald-600 text-white rounded-[24px] text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100"
              >
                {ICONS.CheckCircle}
                Finalize & Collect
              </button>
              <button 
                onClick={() => handleShareWhatsApp(selectedOrder)}
                className="w-full py-4 bg-[#25D366] text-white rounded-[20px] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg"
              >
                📱 Send WhatsApp Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashierView;
