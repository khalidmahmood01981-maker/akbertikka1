import React, { useState, useMemo, useRef } from 'react';
import { Order, Purchase, AppSettings, OrderStatus, StaffMember } from '../types';
import { ICONS, PRINT_TRANSLATIONS } from '../constants';
import { getBusinessDate } from '../utils/dateUtils';

interface HistoryProps {
  orders: Order[];
  purchases: Purchase[];
  settings: AppSettings;
  activeStaff?: StaffMember;
  onUpdateOrder: (order: Order) => void;
  onUpdatePurchase: (purchase: Purchase) => void;
  onDeleteOrder: (id: string) => void;
  onDeletePurchase: (id: string) => void;
  onResetHistory: () => void;
  onEditOrder: (order: Order) => void;
  isAdmin: boolean;
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
  triggerConfirm: (config: { title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' }) => void;
  isTotalsUnlocked?: boolean;
  staffMembers?: StaffMember[];
}

const HistoryView: React.FC<HistoryProps> = ({ 
  orders, 
  purchases, 
  settings, 
  activeStaff,
  onUpdateOrder, 
  onUpdatePurchase,
  onDeleteOrder,
  onDeletePurchase,
  onResetHistory,
  onEditOrder,
  isAdmin,
  notify,
  triggerConfirm,
  isTotalsUnlocked = false,
  staffMembers = []
}) => {
  const [tab, setTab] = useState<'sales' | 'purchases' | 'items'>('sales');
  
  // Helper: mask amounts if locked
  // Helper: mask amounts if locked
  const amt = (val: number | string, suffix = '') => {
    if (!isTotalsUnlocked) return '****';
    let displayVal = val;
    if (typeof val === 'number' && settings.statsAdjustmentPercentage && settings.statsAdjustmentPercentage !== 100) {
      displayVal = val * (settings.statsAdjustmentPercentage / 100);
    }
    return typeof displayVal === 'number' ? `Rs.${displayVal.toFixed(0)}${suffix}` : `${displayVal}${suffix}`;
  };
  
  const [focusDate, setFocusDate] = useState<string>(getBusinessDate(Date.now(), settings.businessDayStartTime));
  const [selectedInvoice, setSelectedInvoice] = useState<Order | null>(null);
  const [selectedOrderTaker, setSelectedOrderTaker] = useState<string>(activeStaff ? activeStaff.id : 'all');
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  
  const dateInputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (dateInputRef.current) {
      if (typeof (dateInputRef.current as any).showPicker === 'function') {
        (dateInputRef.current as any).showPicker();
      } else {
        dateInputRef.current.focus();
      }
    }
  };

  const shiftDate = (days: number) => {
    const current = new Date(focusDate); // focusDate is YYYY-MM-DD
    current.setDate(current.getDate() + days);
    setFocusDate(current.toISOString().split('T')[0]);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const orderDateStr = getBusinessDate(order.timestamp, settings.businessDayStartTime); 
      const dateMatch = orderDateStr === focusDate;
      const takerMatch = activeStaff 
        ? order.orderTakerId === activeStaff.id 
        : (selectedOrderTaker === 'all' || order.orderTakerId === selectedOrderTaker);
      return dateMatch && takerMatch;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [orders, focusDate, selectedOrderTaker, activeStaff, settings.businessDayStartTime]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(purchase => {
      const pDateStr = getBusinessDate(purchase.timestamp || purchase.date || Date.now(), settings.businessDayStartTime);
      return pDateStr === focusDate;
    });
  }, [purchases, focusDate, settings.businessDayStartTime]);

  const itemSummary = useMemo(() => {
    const summary: Record<string, { name: string; qty: number; total: number; category: string }> = {};
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (!summary[item.id]) {
          summary[item.id] = { name: item.name, qty: 0, total: 0, category: item.category };
        }
        summary[item.id].qty += item.quantity;
        summary[item.id].total += (item.price * item.quantity);
      });
    });
    return Object.values(summary).sort((a, b) => b.qty - a.qty);
  }, [filteredOrders]);

  const handleShareWhatsApp = (order: Order) => {
    const rawPhone = order.customerPhone.trim();
    if (!rawPhone || rawPhone.length < 5) {
      notify("Customer ka mobile number hona lazmi hai WhatsApp bhejne ke liye.", "error");
      return;
    }
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) { 
      cleanPhone = (settings?.whatsappCountryCode || '92') + cleanPhone.substring(1); 
    } 
    else if (!cleanPhone.startsWith(settings?.whatsappCountryCode || '92')) { 
      cleanPhone = (settings?.whatsappCountryCode || '92') + cleanPhone; 
    }

    const headerName = settings?.businessName || 'SHOP';
    const dateStr = new Date(order.timestamp).toLocaleDateString();
    
    // Explicit mapping for full bill detail
    const itemsList = order.items.map(item => {
      const unitLabel = item.unit === 'rs' ? 'Rs.' : 'x';
      return `• ${item.name} (${unitLabel}${item.quantity}): Rs.${(item.price * item.quantity).toFixed(0)}`;
    }).join('\n');

    const message = `*${headerName} - INVOICE*\n` +
                    `--------------------------\n` +
                    `Order No: #${order.orderNumber || '??'}\n` +
                    `Bill No: #${order.id.slice(-6).toUpperCase()}\n` +
                    `Date: ${dateStr}\n` +
                    `Customer: ${order.customerName}\n` +
                    `--------------------------\n` +
                    `${itemsList}\n` +
                    `--------------------------\n` +
                    `Subtotal: Rs. ${order.subtotal.toFixed(0)}\n` +
                    (order.discount > 0 ? `Discount: -Rs. ${order.discount.toFixed(0)}\n` : '') +
                    (order.deliveryFee && order.deliveryFee > 0 ? `Delivery Fee: Rs. ${order.deliveryFee.toFixed(0)}\n` : '') +
                    `*Grand Total: Rs. ${order.total.toFixed(0)}*\n` +
                    `--------------------------\n` +
                    `Thank you for your business!`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const updateOrderStatus = (order: Order, status: OrderStatus) => {
    const now = Date.now();
    const updatedOrder = { 
      ...order, 
      status, 
      statusTimestamps: { 
        ...(order.statusTimestamps || {}), 
        [status]: now 
      } 
    };
    onUpdateOrder(updatedOrder);
    setSelectedInvoice(updatedOrder);
  };

  const getDuration = (start?: number, end?: number) => {
    if (!start || !end) return null;
    const diff = Math.floor((end - start) / 1000); // seconds
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}m ${secs}s`;
  };

  const handlePrint = (order: Order) => {
    try {
      const language = settings.language || 'english';
      const t = PRINT_TRANSLATIONS[language];
      const headerName = settings.businessName;
      const itemsHtml = order.items.map(item => `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #ccc; padding: 6px 0; font-size: 12px; font-family: 'Courier New', Courier, monospace;">
          <div style="flex: 1; text-align: left; padding-right: 10px;">
            <div style="font-weight: bold;">${item.name.toUpperCase()}</div>
            <div style="font-size: 10px; color: #333;">
              ${item.unit === 'rs' ? `Rs. ${item.quantity}` : `${item.quantity} x Rs. ${item.price}`}
            </div>
          </div>
          <div style="width: 70px; text-align: right; font-weight: bold; align-self: center;">
            Rs.${(item.price * item.quantity).toFixed(0)}
          </div>
        </div>
      `).join('');

      const printHtml = `
        <html>
          <head>
            <title>Print</title>
            <style>
              @page {
                size: 58mm auto;
                margin: 0;
              }
              @media print {
                body, body * {
                  visibility: visible;
                }
                body {
                  -webkit-print-color-adjust: exact;
                  color-adjust: exact;
                }
              }
              body {
                font-family: 'Courier New', Courier, monospace;
                color: black;
                background: white;
                width: 58mm;
                margin: 0;
                padding: 0;
              }
            </style>
          </head>
          <body onload="window.print()">
            <div style="font-family: 'Courier New', Courier, monospace; color: black; background: white; width: 100%; box-sizing: border-box; padding: 0;">
              <div style="text-align: center; margin-bottom: 15px;">
                <h1 style="margin: 0; font-size: 22px; text-transform: uppercase; font-weight: 900;">${headerName}</h1>
                <p style="margin: 2px 0; font-size: 10px; letter-spacing: 3px; font-weight: bold;">*** ${t.invoice} ***</p>
              </div>

              <div style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 8px 0; margin-bottom: 10px; font-size: 11px; line-height: 1.5;">
                <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; background: #eee; padding: 4px; margin-bottom: 5px;">
                  <span>${t.orderNo}: #${order.orderNumber || '??'}</span>
                  <span>${t.billNo}: #${order.id.slice(-6).toUpperCase()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                  <span><b>${t.date}:</b> ${new Date(order.timestamp).toLocaleDateString()}</span>
                  <span></span>
                </div>
                <div style="margin-top: 4px;">
                  <b>${t.customer}:</b> ${order.customerName.toUpperCase()}
                </div>
                ${order.customerPhone ? `<div><b>${t.phone}:</b> ${order.customerPhone}</div>` : ''}
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                  ${order.tableNumber ? `<span><b>${t.table}:</b> ${order.tableNumber.toUpperCase()}</span>` : '<span></span>'}
                  ${order.paymentMethod ? `<span><b>${t.pay}:</b> ${order.paymentMethod.toUpperCase()}</span>` : ''}
                </div>
                ${order.orderTakerName ? `<div style="margin-top: 4px;"><b>WAITER:</b> ${order.orderTakerName.toUpperCase()}</div>` : ''}
              </div>

              <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 10px; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 4px;">
                  <span>${t.itemDescription}</span>
                  <span>${t.amount}</span>
                </div>
                ${itemsHtml}
              </div>

                ${order.kitchenNotes ? `
                  <div style="margin-top: 10px; padding: 5px; border: 1px dashed #000; font-size: 10px; font-style: italic;">
                    <b>${t.notes}:</b> ${order.kitchenNotes.toUpperCase()}
                  </div>
                ` : ''}
              </div>

              <div style="border-top: 1px solid #000; padding-top: 8px; space-y: 4px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                  <span>${t.subtotal}:</span>
                  <span>Rs.${order.subtotal.toFixed(0)}</span>
                </div>
                ${order.tax && order.tax > 0 ? `
                  <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span>${t.tax}:</span>
                    <span>Rs.${order.tax.toFixed(0)}</span>
                  </div>
                ` : ''}
                ${order.discount && order.discount > 0 ? `
                  <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span>${t.discount}:</span>
                    <span>-Rs.${order.discount.toFixed(0)}</span>
                  </div>
                ` : ''}
                ${order.deliveryFee && order.deliveryFee > 0 ? `
                  <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span>DELIVERY FEE:</span>
                    <span>Rs.${order.deliveryFee.toFixed(0)}</span>
                  </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 20px; margin-top: 10px; border: 2px solid #000; padding: 8px; text-align: center;">
                  <span style="flex: 1;">${t.total}:</span>
                  <span style="flex: 1; text-align: right;">Rs.${order.total.toFixed(0)}</span>
                </div>
              </div>

              <div style="text-align: center; margin-top: 25px; border-top: 1px dashed #000; padding-top: 15px;">
                <p style="margin: 0; font-size: 12px; font-weight: bold;">${t.thankYou}</p>
                <p style="margin: 5px 0 0 0; font-size: 9px; color: #666;">${t.softwareBy}</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(printHtml);
      printWindow.document.close();

        // Automatically close the view after printing
          setSelectedInvoice(null);
    } catch (e) {
      console.error("Print failed:", e);
    }
  };

  const startEditing = () => {
    if (!selectedInvoice) return;
    setEditName(selectedInvoice.customerName);
    setEditPhone(selectedInvoice.customerPhone);
    setIsEditingInfo(true);
  };

  const saveEditedInfo = () => {
    if (!selectedInvoice) return;
    const updatedOrder = {
      ...selectedInvoice,
      customerName: editName.toUpperCase() || 'WALK-IN',
      customerPhone: editPhone
    };
    onUpdateOrder(updatedOrder);
    setSelectedInvoice(updatedOrder);
    setIsEditingInfo(false);
  };

  const isToday = focusDate === getBusinessDate(Date.now(), settings.businessDayStartTime);
  const displayDate = new Date(focusDate).toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });

  const borderColors = ['border-l-orange-500', 'border-l-blue-500', 'border-l-emerald-500', 'border-l-purple-500'];
  const textColors = ['text-orange-500', 'text-blue-500', 'text-emerald-500', 'text-purple-500'];

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-10">
      <div className="bg-[var(--bg-card)] p-3 rounded-[24px] border border-[var(--border)] shadow-2xl space-y-3">
        <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-black uppercase text-orange-600 tracking-[0.2em]">History For Date</span>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button 
                  onClick={() => triggerConfirm({
                    title: "Clear History?",
                    message: "Kya aap waqai poori history clear karna chahte hain? Yeh amal wapas nahi ho sakta.",
                    onConfirm: onResetHistory,
                    type: 'danger'
                  })}
                  className="px-3 py-1 bg-red-600/10 text-red-500 text-[8px] font-black uppercase rounded-full border border-red-600/20 active:scale-95 transition-all"
                >
                  Clear All
                </button>
              )}
              {isToday && <span className="px-3 py-1 bg-orange-600 text-white text-[8px] font-black uppercase rounded-full glow-accent">TODAY</span>}
            </div>
        </div>

        <div className="px-1">
          {!activeStaff && (
            <select
              value={selectedOrderTaker}
              onChange={(e) => setSelectedOrderTaker(e.target.value)}
              className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 outline-none font-black uppercase text-[10px] tracking-widest focus:border-orange-600 transition-colors"
            >
              <option value="all">ALL STAFF HISTORY</option>
              {staffMembers?.map(member => (
                <option key={member.id} value={member.id}>
                  {member.name.toUpperCase()} ({member.role.toUpperCase()})
                </option>
              ))}
            </select>
          )}
          {activeStaff && (
            <div className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 font-black uppercase text-[10px] tracking-widest text-center">
              HISTORY: {activeStaff.name}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => shiftDate(-1)} className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-orange-600 active:scale-90 transition-all border border-white/5 shadow-lg">
             <div className="rotate-180">{ICONS.Send}</div>
          </button>
          
          <div onClick={openPicker} className="flex-1 bg-black/40 border-2 border-orange-600/30 rounded-[18px] p-2 flex flex-col items-center justify-center relative active:scale-95 transition-all cursor-pointer shadow-inner group">
             <p className="text-[14px] font-black text-white uppercase tracking-tight group-hover:text-orange-600 transition-colors">{displayDate}</p>
             <input 
                ref={dateInputRef}
                type="date" 
                className="absolute opacity-0 pointer-events-none w-full h-full"
                value={focusDate} 
                onChange={e => setFocusDate(e.target.value)} 
             />
          </div>

          <button onClick={() => shiftDate(1)} className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-orange-600 active:scale-90 transition-all border border-white/5 shadow-lg">
             {ICONS.Send}
          </button>
        </div>
      </div>

      <div className="px-2">
        <div className="flex p-1 bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-xl overflow-hidden">
          <button onClick={() => setTab('sales')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black transition-all ${tab === 'sales' ? 'bg-orange-600 text-white shadow-lg' : 'text-[var(--text-muted)]'}`}>SALES ({filteredOrders.length})</button>
          <button onClick={() => setTab('items')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black transition-all ${tab === 'items' ? 'bg-orange-600 text-white shadow-lg' : 'text-[var(--text-muted)]'}`}>ITEMS SOLD</button>
          <button onClick={() => setTab('purchases')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black transition-all ${tab === 'purchases' ? 'bg-orange-600 text-white shadow-lg' : 'text-[var(--text-muted)]'}`}>EXPENSES</button>
        </div>
      </div>

      <div className="space-y-3 pb-12 px-1">
        {tab === 'sales' && (
          filteredOrders.length === 0 ? (
            <div className="bg-[var(--bg-card)] p-10 rounded-[24px] text-center text-[var(--text-muted)] border border-dashed border-[var(--border)] uppercase text-[10px] font-black">No Sales on {displayDate}</div>
          ) : (
            <>
              <div className="bg-gradient-to-br from-orange-600 to-orange-800 p-3 rounded-[20px] flex justify-between items-center mb-3 shadow-2xl glow-accent">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-white/60 uppercase tracking-widest leading-none">Day Sales Total</span>
                    <span className="text-3xl font-black text-white tracking-tighter italic mt-1">{amt(filteredOrders.reduce((a, b) => a + b.total, 0))}</span>
                </div>
                <div className="bg-white/20 p-3 rounded-2xl text-white">{ICONS.ShoppingBag}</div>
              </div>
              {filteredOrders.map((order, idx) => (
                <div key={order.id} onClick={() => { setSelectedInvoice(order); setIsEditingInfo(false); }} className={`bg-[var(--bg-card)] p-3 rounded-[18px] border border-[var(--border)] border-l-4 ${borderColors[idx % 4]} flex justify-between items-center active:scale-[0.98] transition-all cursor-pointer shadow-lg`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black uppercase text-sm truncate leading-none text-white">{order.customerName}</h3>
                    </div>
                    <p className={`text-[11px] font-black mt-2 ${textColors[idx % 4]}`}>{amt(order.total)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-[var(--text-muted)] uppercase">{new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    <div className="flex flex-col items-end gap-0.5 mt-0.5">
                      {order.tableNumber && <p className="text-[8px] font-black text-emerald-500 uppercase">Table: {order.tableNumber}</p>}
                      {order.orderTakerName && <p className="text-[7px] font-black text-blue-500 uppercase">WAITER: {order.orderTakerName}</p>}
                      {order.cashierName && <p className="text-[7px] font-black text-purple-500 uppercase">CASHIER: {order.cashierName}</p>}
                      {order.discount > 0 && <p className="text-[7px] font-black text-orange-500 uppercase font-italic">DISCOUNT: -Rs.{order.discount}</p>}
                    </div>
                    <p className="text-2xl font-black text-orange-600 uppercase tracking-widest bg-orange-600/10 px-3 py-1 rounded-lg border border-orange-600/20 mt-1">NO: #{order.orderNumber || '??'}</p>
                    <p className="text-[7px] font-black text-orange-600 uppercase mt-0.5">ID: {order.id.slice(-4)}</p>
                  </div>
                </div>
              ))}
            </>
          )
        )}

        {tab === 'items' && (
          itemSummary.length === 0 ? (
            <div className="bg-[var(--bg-card)] p-10 rounded-[24px] text-center text-[var(--text-muted)] border border-dashed border-[var(--border)] uppercase text-[10px] font-black">No Data for {displayDate}</div>
          ) : (
            <div className="space-y-2">
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-3 tracking-widest">Item Sales Report</p>
              {itemSummary.map((item, idx) => (
                <div key={idx} className={`bg-[var(--bg-card)] p-3 rounded-[20px] border border-[var(--border)] border-l-4 ${borderColors[idx % 4]} shadow-md`}>
                  <div className="flex justify-between items-start">
                    <h4 className="font-black uppercase text-base tracking-tight text-white">{item.name}</h4>
                    <span className={`text-xl font-black ${textColors[idx % 4]}`}>x{item.qty}</span>
                  </div>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">{item.category}</span>
                    <span className="text-xs font-black text-white">{amt(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'purchases' && (
          filteredPurchases.length === 0 ? (
            <div className="bg-[var(--bg-card)] p-10 rounded-[24px] text-center text-[var(--text-muted)] border border-dashed border-[var(--border)] uppercase text-[10px] font-black">No Expenses on {displayDate}</div>
          ) : (
            <div className="space-y-3">
              <div className="bg-gradient-to-br from-rose-600 to-rose-800 p-3 rounded-[20px] flex justify-between items-center mb-3 shadow-2xl">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-white/60 uppercase tracking-widest leading-none">Total Expense</span>
                    <span className="text-3xl font-black text-white tracking-tighter italic mt-1">{amt(filteredPurchases.reduce((a, b) => a + (b.cost * b.quantity), 0))}</span>
                </div>
                <div className="bg-white/20 p-3 rounded-2xl text-white">{ICONS.Inventory}</div>
              </div>
              {filteredPurchases.map((purchase, idx) => (
                <div key={purchase.id} className={`bg-[var(--bg-card)] p-3 rounded-[18px] border border-[var(--border)] border-l-4 ${borderColors[idx % 4]} flex justify-between items-center shadow-md`}>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black uppercase text-sm truncate leading-none text-white">{purchase.itemName}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">Rate: Rs.{purchase.cost}</span>
                      <span className="text-[9px] font-black text-[var(--text-muted)]">×</span>
                      <span className="text-[9px] font-black text-white uppercase">{purchase.quantity} {purchase.unit}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[12px] font-black ${textColors[idx % 4]}`}>{amt(purchase.cost * purchase.quantity)}</p>
                    <div className="flex flex-col items-end gap-1 mt-1">
                      <p className="text-[8px] font-black text-[var(--text-muted)] uppercase">{purchase.category}</p>
                      <div className="flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-white/20"></span>
                        <p className="text-[7px] font-black text-white/40 uppercase tracking-tighter">{purchase.paymentMethod || 'cash'}</p>
                      </div>
                      <p className="text-[8px] font-black text-[var(--text-muted)] uppercase">{purchase.supplier || 'Expense'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[500] flex flex-col items-center justify-center p-5 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] w-full max-w-sm border border-white/5 shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in no-print">
            <div className="p-8 text-center border-b border-[var(--border)] relative">
                <button onClick={() => setSelectedInvoice(null)} className="absolute top-6 right-6 p-2.5 bg-white/5 rounded-xl text-white">{ICONS.X}</button>
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-orange-600">{settings.businessName}</h3>
                <p className="text-[9px] font-black uppercase text-[var(--text-muted)] mt-1 tracking-widest">Official Receipt</p>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
                <div className="flex justify-between items-start">
                    <div className="flex-1 mr-2">
                        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Customer Details</p>
                        {isEditingInfo ? (
                          <div className="mt-2 space-y-2">
                            <input 
                              type="text" 
                              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm font-black text-white uppercase outline-none focus:border-orange-600"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              placeholder="Customer Name"
                            />
                            <input 
                              type="tel" 
                              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm font-black text-white outline-none focus:border-orange-600"
                              value={editPhone}
                              onChange={e => setEditPhone(e.target.value)}
                              placeholder="Mobile Number"
                            />
                            <button onClick={saveEditedInfo} className="w-full py-2 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Save Changes</button>
                          </div>
                        ) : (
                          <div className="mt-1 group relative">
                            <p className="font-black text-lg uppercase text-white leading-tight">{selectedInvoice.customerName}</p>
                            <div className="flex flex-col gap-1 mt-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-orange-600">{ICONS.Send}</span>
                                <p className="text-[11px] font-black text-white/80">{selectedInvoice.customerPhone || 'No Phone Number'}</p>
                              </div>
                              {selectedInvoice.tableNumber && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-emerald-500">{ICONS.Plus}</span>
                                  <p className="text-[11px] font-black text-emerald-500 uppercase">Table: {selectedInvoice.tableNumber}</p>
                                </div>
                              )}
                            </div>
                            {isAdmin && (
                              <button onClick={startEditing} className="mt-3 text-[8px] font-black uppercase text-orange-600/50 hover:text-orange-600 flex items-center gap-1 transition-colors">
                                {ICONS.Settings} Edit Details
                              </button>
                            )}
                          </div>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Order Info</p>
                        <p className="text-3xl font-black uppercase text-orange-600 bg-orange-600/10 px-4 py-2 rounded-2xl border border-orange-600/20 shadow-lg shadow-orange-600/10">NO: #{selectedInvoice.orderNumber || '??'}</p>
                        <p className="text-[10px] font-black uppercase text-white">ID: {selectedInvoice.id.slice(-8)}</p>
                        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mt-1">{new Date(selectedInvoice.timestamp).toLocaleTimeString()}</p>
                        <div className="mt-3 space-y-2">
                          {selectedInvoice.orderTakerName && (
                            <div className="bg-white/5 px-2 py-1 rounded-lg border border-white/5 inline-block">
                              <p className="text-[7px] font-black text-orange-600 uppercase tracking-widest">Taker</p>
                              <p className="text-[9px] font-black text-white uppercase italic">{selectedInvoice.orderTakerName}</p>
                            </div>
                          )}
                          {selectedInvoice.paymentMethod && (
                            <div className="block">
                              <p className="text-[7px] font-black text-blue-500 uppercase tracking-widest">Payment</p>
                              <p className="text-[9px] font-black text-white uppercase">{selectedInvoice.paymentMethod}</p>
                            </div>
                          )}
                        </div>
                    </div>
                </div>
                <div className="border-t border-dashed border-[var(--border)] pt-6">
                    <table className="w-full text-xs">
                        <tbody className="divide-y divide-white/5">
                            {selectedInvoice.items.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="py-3 font-black uppercase text-white">
                                      {item.name} 
                                      <span className="text-orange-600 ml-1">
                                        {item.unit === 'rs' ? `(Rs.${item.quantity})` : `x${item.quantity}`}
                                      </span>
                                    </td>
                                    <td className="py-3 text-right font-black text-white">Rs.${(item.price * item.quantity).toFixed(0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="border-t border-dashed border-[var(--border)] pt-4 space-y-2">
                    {selectedInvoice.deliveryFee && selectedInvoice.deliveryFee > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-widest">Delivery Fee</span>
                        <span className="text-xs font-black text-white">Rs.{selectedInvoice.deliveryFee.toFixed(0)}</span>
                      </div>
                    )}
                    {selectedInvoice.discount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest">Discount</span>
                        <span className="text-xs font-black text-orange-500">-Rs.{selectedInvoice.discount.toFixed(0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-widest">Total Amount</span>
                        <span className="text-3xl font-black uppercase tracking-tighter text-orange-600 italic">{amt(selectedInvoice.total)}</span>
                    </div>
                    {selectedInvoice.receivedAmount !== undefined && (
                      <div className="flex justify-between items-center border-t border-white/5 pt-2">
                        <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Received</span>
                        <span className="text-xs font-black text-emerald-500">{amt(selectedInvoice.receivedAmount)}</span>
                      </div>
                    )}
                    {selectedInvoice.balance !== undefined && selectedInvoice.balance > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Baqii (Balance)</span>
                        <span className="text-xs font-black text-rose-500">{amt(selectedInvoice.balance)}</span>
                      </div>
                    )}
                </div>
            </div>
            <div className="p-8 bg-white/5 space-y-3">
              {isAdmin && (
                <button onClick={() => { onEditOrder(selectedInvoice); setSelectedInvoice(null); }} className="w-full py-4 bg-orange-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg border-b-4 border-orange-800 active:scale-95 transition-all">
                  {ICONS.Plus} Edit / Add Items
                </button>
              )}
              <div className="flex gap-3">
                {isAdmin && (
                  <button 
                    onClick={() => triggerConfirm({
                      title: "Delete Order?",
                      message: "Kya aap waqai is order ko history se delete karna chahte hain?",
                      onConfirm: () => {
                        onDeleteOrder(selectedInvoice.id);
                        setSelectedInvoice(null);
                      },
                      type: 'danger'
                    })} 
                    className="flex-1 py-4 bg-red-500/10 text-red-500 rounded-2xl text-[9px] font-black uppercase tracking-widest"
                  >
                    Delete
                  </button>
                )}
                <button onClick={() => handlePrint(selectedInvoice)} className="flex-1 py-4 bg-white/10 text-white rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 border border-white/5">Print Receipt</button>
              </div>
              <button onClick={() => handleShareWhatsApp(selectedInvoice)} className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg">{ICONS.Send} Share via WhatsApp</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
    </div>
  );
};

export default HistoryView;