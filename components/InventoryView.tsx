
import React, { useState, useMemo, useRef } from 'react';
import { Purchase, UnitType, StockCategory, StockItem, StockLog, KhataTransaction, Supplier, SupplierCategory, AppSettings } from '../types';
import { ICONS } from '../constants';

interface InventoryProps {
  purchases: Purchase[];
  onAddPurchase: (p: Purchase) => void;
  stockCategories: StockCategory[];
  setStockCategories: (s: StockCategory[]) => void;
  stockLogs: StockLog[];
  setStockLogs: (l: StockLog[]) => void;
  khataTransactions: KhataTransaction[];
  setKhataTransactions: (k: KhataTransaction[]) => void;
  suppliers: Supplier[];
  setSuppliers: (s: Supplier[]) => void;
  supplierCategories: SupplierCategory[];
  setSupplierCategories: (s: SupplierCategory[]) => void;
  settings: AppSettings;
  isAdmin: boolean;
  triggerConfirm: (config: { title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' }) => void;
  setIsNavHidden?: (hidden: boolean) => void;
}

const InventoryView: React.FC<InventoryProps> = ({ 
  purchases, onAddPurchase, stockCategories, setStockCategories, stockLogs, setStockLogs, khataTransactions, setKhataTransactions, suppliers, setSuppliers, supplierCategories, setSupplierCategories, settings, isAdmin, triggerConfirm,
  setIsNavHidden
}) => {
  const [activeTab, setActiveTab] = useState<'intake' | 'status' | 'khata' | 'purchases'>('intake');
  const [selectedCatId, setSelectedCatId] = useState<string | null>(stockCategories[0]?.id || null);
  const [selectedSupCatId, setSelectedSupCatId] = useState<string>('All');
  const [khataSearch, setKhataSearch] = useState('');

  // Purchase Filters
  const [purchaseFilter, setPurchaseFilter] = useState({
    category: 'All',
    subCategory: 'All',
    supplier: 'All',
    search: ''
  });
  const [purchaseDateRange, setPurchaseDateRange] = useState({ start: '', end: '' });
  
  // Modals Visibility
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showEditCategory, setShowEditCategory] = useState<StockCategory | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{id: string, type: 'stock' | 'supplier_cat' | 'supplier'} | null>(null);
  const [showAddSupCategory, setShowAddSupCategory] = useState(false);
  const [showEditSupCategory, setShowEditSupCategory] = useState<SupplierCategory | null>(null);
  
  const [showAddItem, setShowAddItem] = useState<{catId: string} | null>(null);
  const [showConfirmIntake, setShowConfirmIntake] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [viewSupplierLedger, setViewSupplierLedger] = useState<string | null>(null);

  // Ledger Filters
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');

  React.useEffect(() => {
    const isAnyModalOpen = !!showAddCategory || !!showEditCategory || !!showDeleteConfirm || !!showAddSupCategory || !!showEditSupCategory || !!showAddItem || !!showConfirmIntake || !!showAddPayment || !!viewSupplierLedger;
    setIsNavHidden?.(isAnyModalOpen);
  }, [showAddCategory, showEditCategory, showDeleteConfirm, showAddSupCategory, showEditSupCategory, showAddItem, showConfirmIntake, showAddPayment, viewSupplierLedger, setIsNavHidden]);

  // Form States
  const [dailyIntake, setDailyIntake] = useState<Record<string, { weight: string, rate: string }>>({});
  const [registerSupplier, setRegisterSupplier] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState<UnitType>('kg');
  const [newItemMinStock, setNewItemMinStock] = useState('5');
  const [newCatName, setNewCatName] = useState('');
  const [editCatName, setEditCatName] = useState('');

  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentSupplier, setPaymentSupplier] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentType, setPaymentType] = useState<'payment' | 'return' | 'discount' | 'adjustment'>('payment');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const logDateRef = useRef<HTMLInputElement>(null);

  const openDatePicker = () => {
    const input = logDateRef.current;
    if (input) {
        if (typeof (input as any).showPicker === 'function') {
          (input as any).showPicker();
        } else {
          input.focus();
        }
    }
  };

  // --- CRUD Stock Categories ---
  const handleAddCategory = () => {
    if (!newCatName.trim()) return alert("Group ka naam likhen!");
    const newCat: StockCategory = { id: Math.random().toString(36).substr(2, 9), name: newCatName.toUpperCase(), items: [] };
    setStockCategories([...stockCategories, newCat]);
    if (!selectedCatId || stockCategories.length === 0) setSelectedCatId(newCat.id);
    setNewCatName(''); setShowAddCategory(false);
  };

  const handleUpdateCategory = () => {
    if (!showEditCategory || !editCatName.trim()) return;
    setStockCategories(stockCategories.map(cat => cat.id === showEditCategory.id ? { ...cat, name: editCatName.toUpperCase() } : cat));
    setShowEditCategory(null); setEditCatName('');
  };

  // --- CRUD Supplier Categories ---
  const handleAddSupCategory = () => {
    if (!newCatName.trim()) return alert("Supplier group ka naam likhen!");
    const newCat = { id: Math.random().toString(36).substr(2, 9), name: newCatName.toUpperCase() };
    setSupplierCategories([...supplierCategories, newCat]);
    setNewCatName(''); setShowAddSupCategory(false);
  };

  const handleUpdateSupCategory = () => {
    if (!showEditSupCategory || !editCatName.trim()) return;
    setSupplierCategories(supplierCategories.map(cat => cat.id === showEditSupCategory.id ? { ...cat, name: editCatName.toUpperCase() } : cat));
    setShowEditSupCategory(null); setEditCatName('');
  };

  const handleDeleteConfirmed = () => {
    if (!showDeleteConfirm) return;
    const { id, type } = showDeleteConfirm;
    if (type === 'stock') {
      const updated = stockCategories.filter(cat => cat.id !== id);
      setStockCategories(updated);
      if (selectedCatId === id) setSelectedCatId(updated[0]?.id || null);
    } else if (type === 'supplier_cat') {
      setSupplierCategories(supplierCategories.filter(cat => cat.id !== id));
    }
    setShowDeleteConfirm(null);
  };

  const handleAddItem = () => {
    if (!showAddItem || !newItemName.trim()) return alert("Item ka naam likhen!");
    const newItem: StockItem = { id: Math.random().toString(36).substr(2, 9), name: newItemName.toUpperCase(), currentQuantity: 0, minStock: parseFloat(newItemMinStock) || 0, unit: newItemUnit, price: 0 };
    setStockCategories(stockCategories.map(cat => cat.id === showAddItem.catId ? { ...cat, items: [...cat.items, newItem] } : cat));
    setNewItemName(''); setShowAddItem(null);
  };

  const finalizeIntake = () => {
    if (!selectedCatId || !registerSupplier.trim()) return alert("Supplier ka naam likhen!");
    const activeCategory = stockCategories.find(c => c.id === selectedCatId);
    if (!activeCategory) return;
    
    const newLogs: StockLog[] = [];
    const newPurchases: Purchase[] = [];
    const newKhataEntries: KhataTransaction[] = [];
    const sName = registerSupplier.toUpperCase().trim();

    const updatedCategories = stockCategories.map(cat => {
      if (cat.id === selectedCatId) {
        return {
          ...cat,
          items: cat.items.map(item => {
            const entry = dailyIntake[item.id];
            const weight = parseFloat(entry?.weight || '0');
            const rate = parseFloat(entry?.rate || '0');
            if (weight > 0) {
              const timestamp = new Date(logDate).getTime() + (12 * 60 * 60 * 1000);
              newLogs.push({ id: Math.random().toString(36).substr(2, 9), itemId: item.id, itemName: item.name, categoryName: activeCategory.name, weight, rate, date: logDate, timestamp });
              newPurchases.push({ 
                id: Math.random().toString(36).substr(2, 9), 
                timestamp, 
                itemName: item.name, 
                category: activeCategory.name, 
                subCategory: undefined,
                quantity: weight, 
                unit: item.unit, 
                unitCost: rate,
                cost: weight * rate, 
                supplier: sName,
                paidAmount: 0,
                remainingAmount: weight * rate
              });
              newKhataEntries.push({ id: Math.random().toString(36).substr(2, 9), supplier: sName, amount: weight * rate, type: 'purchase', note: `${item.name} (${weight} ${item.unit})`, timestamp });
              return { ...item, currentQuantity: item.currentQuantity + weight, price: rate || item.price };
            }
            return item;
          })
        };
      }
      return cat;
    });

    if (newLogs.length === 0) return alert("Kisi item ka wazan likhen!");
    
    if (!suppliers.find(s => s.name.toUpperCase() === sName)) {
      setSuppliers([...suppliers, { id: Math.random().toString(36).substr(2, 9), name: sName, categoryId: '1' }]);
    }

    setStockCategories(updatedCategories);
    setStockLogs([...newLogs, ...stockLogs]);
    setKhataTransactions([...newKhataEntries, ...khataTransactions]);
    newPurchases.forEach(p => onAddPurchase(p));
    setDailyIntake({}); setRegisterSupplier(''); setShowConfirmIntake(false);
    alert("Record Save Ho Gaya!");
  };

  const handleQuickPay = (supplierName: string, balance: number) => {
    setPaymentSupplier(supplierName);
    setPaymentAmount(Math.max(0, balance).toString());
    setPaymentNote('Bill Payment');
    setShowAddPayment(true);
  };

  const handleAddPayment = () => {
    if (!paymentAmount || !paymentSupplier) return alert("Amount aur Supplier lazmi hain!");
    const newPayment: KhataTransaction = { 
      id: Math.random().toString(36).substr(2, 9), 
      supplier: paymentSupplier.toUpperCase().trim(), 
      amount: parseFloat(paymentAmount), 
      type: paymentType, 
      note: paymentNote, 
      paymentMethod: paymentType === 'payment' ? paymentMethod : undefined,
      timestamp: Date.now() 
    };
    setKhataTransactions([newPayment, ...khataTransactions]);
    setPaymentAmount(''); setPaymentSupplier(''); setPaymentNote(''); setPaymentType('payment'); setShowAddPayment(false);
    alert("Transaction Record Ho Gayi!");
  };

  const handleExportKhata = (supplierName: string, transactions: KhataTransaction[]) => {
    const headers = ["Date", "Description", "Type", "Amount (Rs)"];
    const rows = transactions.map(t => [
      new Date(t.timestamp).toLocaleDateString(),
      t.note || 'Entry',
      t.type === 'purchase' ? 'MAAL LIYA' : 'PAYMENT',
      t.amount.toString()
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const fileName = `${settings.businessName.replace(/\s+/g, '_')}_${supplierName.replace(/\s+/g, '_')}_Khata_${dateStr}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- DERIVED DATA ---
  const supplierBalances = useMemo(() => {
    const balances: Record<string, { purchase: number, payment: number }> = {};
    khataTransactions.forEach(t => {
      const sName = t.supplier.toUpperCase();
      if (!balances[sName]) balances[sName] = { purchase: 0, payment: 0 };
      
      if (t.type === 'purchase') {
        balances[sName].purchase += t.amount;
      } else if (t.type === 'payment' || t.type === 'return' || t.type === 'discount') {
        balances[sName].payment += t.amount;
      } else if (t.type === 'adjustment') {
        if (t.amount > 0) balances[sName].purchase += t.amount;
        else balances[sName].payment += Math.abs(t.amount);
      }
    });

    return Object.entries(balances).map(([name, bal]) => {
      const supData = suppliers.find(s => s.name.toUpperCase() === name);
      return {
        name,
        categoryId: supData?.categoryId || 'unassigned',
        totalPurchase: bal.purchase,
        totalPayment: bal.payment,
        balance: bal.purchase - bal.payment
      };
    }).filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(khataSearch.toLowerCase());
      if (selectedSupCatId === 'All') return matchesSearch;
      return s.categoryId === selectedSupCatId && matchesSearch;
    }).sort((a, b) => b.balance - a.balance);
  }, [khataTransactions, suppliers, selectedSupCatId, khataSearch]);

  const ledgerTransactions = useMemo(() => {
    if (!viewSupplierLedger) return [];
    let filtered = khataTransactions.filter(t => t.supplier.toUpperCase() === viewSupplierLedger.toUpperCase());
    
    if (ledgerStartDate) {
      const start = new Date(ledgerStartDate).getTime();
      filtered = filtered.filter(t => t.timestamp >= start);
    }
    if (ledgerEndDate) {
      const end = new Date(ledgerEndDate).getTime() + (23 * 59 * 59 * 1000);
      filtered = filtered.filter(t => t.timestamp <= end);
    }
    
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [khataTransactions, viewSupplierLedger, ledgerStartDate, ledgerEndDate]);

  const intakeTotal = useMemo(() => {
    return Object.values(dailyIntake).reduce((acc: number, entry: { weight: string, rate: string }) => {
      return acc + (parseFloat(entry.weight || '0') * parseFloat(entry.rate || '0'));
    }, 0);
  }, [dailyIntake]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const matchSearch = p.itemName.toLowerCase().includes(purchaseFilter.search.toLowerCase());
      const matchCat = purchaseFilter.category === 'All' || p.category === purchaseFilter.category;
      const matchSubCat = purchaseFilter.subCategory === 'All' || p.subCategory === purchaseFilter.subCategory;
      const matchSupplier = purchaseFilter.supplier === 'All' || p.supplier === purchaseFilter.supplier;
      
      const pDate = new Date(p.timestamp).toISOString().split('T')[0];
      const matchDate = (!purchaseDateRange.start || pDate >= purchaseDateRange.start) && 
                        (!purchaseDateRange.end || pDate <= purchaseDateRange.end);
      
      return matchSearch && matchCat && matchSubCat && matchSupplier && matchDate;
    });
  }, [purchases, purchaseFilter, purchaseDateRange]);

  const activeCategory = stockCategories.find(c => c.id === selectedCatId);

  return (
    <div className="space-y-6 pb-20 overflow-hidden">
      <div className="space-y-4 animate-in slide-in-from-top duration-700">
        <div className="flex items-center justify-between px-2">
            <h2 className="text-3xl font-black tracking-tighter uppercase italic">Inventory <span className="text-orange-600">Pro</span></h2>
            <div className="bg-orange-600/10 p-4 rounded-2xl text-orange-600 shadow-lg">{ICONS.Inventory}</div>
        </div>
        <div className="flex p-1.5 bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-xl overflow-hidden">
          <button onClick={() => setActiveTab('intake')} className={`flex-1 py-3.5 text-[9px] font-black rounded-xl transition-all ${activeTab === 'intake' ? 'bg-orange-600 text-white shadow-lg' : 'text-[var(--text-muted)]'}`}>NEW PURCHASE</button>
          <button onClick={() => setActiveTab('status')} className={`flex-1 py-3.5 text-[9px] font-black rounded-xl transition-all ${activeTab === 'status' ? 'bg-orange-600 text-white shadow-lg' : 'text-[var(--text-muted)]'}`}>STOCK STATUS</button>
          <button onClick={() => setActiveTab('purchases')} className={`flex-1 py-3.5 text-[9px] font-black rounded-xl transition-all ${activeTab === 'purchases' ? 'bg-orange-600 text-white shadow-lg' : 'text-[var(--text-muted)]'}`}>HISTORY</button>
          <button onClick={() => setActiveTab('khata')} className={`flex-1 py-3.5 text-[9px] font-black rounded-xl transition-all ${activeTab === 'khata' ? 'bg-orange-600 text-white shadow-lg' : 'text-[var(--text-muted)]'}`}>SUPPLIERS</button>
        </div>
      </div>

      {activeTab === 'intake' && (
        <div className="space-y-5">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-1">
            <button onClick={() => setShowAddCategory(true)} className="px-6 py-4 bg-orange-600 text-white rounded-2xl text-[10px] font-black uppercase shrink-0 shadow-lg flex items-center gap-2 active:scale-95 transition-all">
              {ICONS.Plus} NEW GROUP
            </button>
            {stockCategories.map((cat) => (
              <button key={cat.id} onClick={() => setSelectedCatId(cat.id)} className={`px-6 py-4 rounded-2xl text-xs font-black uppercase whitespace-nowrap transition-all ${selectedCatId === cat.id ? 'bg-orange-600 text-white shadow-md' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)]'}`}>
                {cat.name}
              </button>
            ))}
          </div>

          {activeCategory ? (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="bg-[var(--bg-card)] p-6 rounded-[32px] shadow-2xl border border-[var(--border)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                <div className="relative flex justify-between items-center">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-2xl uppercase tracking-tighter text-white italic">{activeCategory.name}</h3>
                      <button onClick={() => { setEditCatName(activeCategory.name); setShowEditCategory(activeCategory); }} className="p-1.5 text-[var(--text-muted)] hover:text-orange-600 transition-all">{ICONS.Settings}</button>
                    </div>
                    <div onClick={openDatePicker} className="inline-flex items-center gap-2 bg-black/20 border border-white/5 px-4 py-2 rounded-xl active:scale-95 transition-all cursor-pointer">
                      <span className="text-orange-600 scale-75">{ICONS.History}</span>
                      <span className="text-[9px] font-black uppercase text-white/70">{logDate}</span>
                      <input ref={logDateRef} type="date" className="absolute opacity-0 pointer-events-none" value={logDate} onChange={e => setLogDate(e.target.value)} />
                    </div>
                  </div>
                  <button onClick={() => setShowAddItem({catId: selectedCatId!})} className="w-12 h-12 bg-orange-600 text-white rounded-2xl shadow-lg shadow-orange-600/20 flex items-center justify-center active:scale-90 transition-all">
                    {ICONS.Plus}
                  </button>
                </div>
              </div>

              {activeCategory.items.length === 0 ? (
                <div onClick={() => setShowAddItem({catId: selectedCatId!})} className="bg-[var(--bg-card)] p-20 rounded-[40px] text-center border-2 border-dashed border-[var(--border)] text-[var(--text-muted)] font-black uppercase text-[10px] cursor-pointer hover:border-orange-600/50 transition-all space-y-4">
                  <div className="text-4xl opacity-10">{ICONS.Package}</div>
                  <p>No items in this group.<br/><span className="text-orange-600 mt-2 block">Click to add first item</span></p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    {activeCategory.items.map((item) => {
                      const weight = parseFloat(dailyIntake[item.id]?.weight || '0');
                      const rate = parseFloat(dailyIntake[item.id]?.rate || '0');
                      const rowTotal = weight * rate;
                      
                      return (
                        <div key={item.id} className="bg-[var(--bg-card)] rounded-[28px] border border-[var(--border)] p-5 shadow-xl group hover:border-orange-600/30 transition-all">
                          <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all">
                                {ICONS.Package}
                              </div>
                              <p className="font-black text-xs uppercase text-white italic">{item.name}</p>
                            </div>
                            {rowTotal > 0 && (
                              <div className="bg-emerald-600/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                                <p className="text-[10px] font-black text-emerald-500">Rs.{rowTotal.toLocaleString()}</p>
                              </div>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <p className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">Quantity ({item.unit})</p>
                              <input 
                                type="number" 
                                placeholder="0.00" 
                                className="w-full p-4 bg-black/20 border border-white/5 rounded-2xl text-center font-black text-orange-600 outline-none text-sm focus:border-orange-600 transition-all" 
                                value={dailyIntake[item.id]?.weight || ''} 
                                onChange={e => setDailyIntake({...dailyIntake, [item.id]: { ...dailyIntake[item.id], weight: e.target.value }})} 
                              />
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">Rate (Per {item.unit})</p>
                              <input 
                                type="number" 
                                placeholder="0" 
                                className="w-full p-4 bg-black/20 border border-white/5 rounded-2xl text-center font-black text-blue-500 outline-none text-sm focus:border-blue-600 transition-all" 
                                value={dailyIntake[item.id]?.rate || ''} 
                                onChange={e => setDailyIntake({...dailyIntake, [item.id]: { ...dailyIntake[item.id], rate: e.target.value }})} 
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary & Save */}
                  <div className="bg-[var(--bg-card)] p-8 rounded-[40px] border border-[var(--border)] shadow-2xl space-y-6 sticky bottom-4 z-10">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-[0.2em]">Total Purchase Value</p>
                        <p className="text-4xl font-black text-white italic tracking-tighter">Rs.{intakeTotal.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black uppercase text-orange-600 tracking-widest">Items Count</p>
                        <p className="text-xl font-black text-white">{Object.values(dailyIntake).filter((v: any) => parseFloat(v.weight) > 0).length}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowConfirmIntake(true)} 
                      disabled={intakeTotal === 0}
                      className="w-full py-6 bg-orange-600 text-white rounded-[28px] font-black uppercase text-lg tracking-widest shadow-2xl shadow-orange-600/30 flex items-center justify-center gap-4 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                    >
                      CONFIRM PURCHASE {ICONS.Send}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div onClick={() => setShowAddCategory(true)} className="p-20 text-center border-2 border-dashed border-[var(--border)] rounded-[40px] text-[var(--text-muted)] font-black uppercase text-[10px] cursor-pointer hover:border-orange-600/50 transition-all">
              Shuru karne ke liye group banayein.<br/><span className="text-orange-600 mt-2 block">Group Banane Ke Liye Click Karein</span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'status' && (
        <div className="space-y-4">
          {stockCategories.map(cat => (
            <div key={cat.id} className="bg-[var(--bg-card)] rounded-[32px] border border-[var(--border)] overflow-hidden shadow-xl">
              <div className="bg-white/5 p-6 border-b border-white/5 flex justify-between items-center">
                 <h4 className="font-black uppercase text-orange-600 text-lg tracking-tight">{cat.name}</h4>
                 <span className="text-[10px] font-black text-[var(--text-muted)] uppercase">{cat.items.length} Items</span>
              </div>
              <div className="p-6 space-y-4">
                {cat.items.length === 0 ? (
                  <p className="text-[10px] text-center font-black uppercase text-[var(--text-muted)] py-4">No items in this group</p>
                ) : cat.items.map(item => {
                  const isLow = item.currentQuantity <= item.minStock;
                  return (
                    <div key={item.id} className="flex justify-between items-center bg-black/20 p-4 rounded-2xl border border-white/5">
                       <div>
                          <p className="font-black text-sm uppercase text-white">{item.name}</p>
                          <p className={`text-[9px] font-black mt-1 uppercase ${isLow ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>{isLow ? 'LOW STOCK' : 'IN STOCK'}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-xl font-black text-white">{item.currentQuantity}<span className="text-[10px] ml-1 text-[var(--text-muted)]">{item.unit}</span></p>
                          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase">Alert: {item.minStock}</p>
                       </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'purchases' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Stats Overview Bento */}
          <div className="grid grid-cols-2 gap-3 px-1">
            <div className="bg-[var(--bg-card)] p-5 rounded-[32px] border border-[var(--border)] shadow-xl space-y-2 bg-emerald-600/5 border-emerald-500/10">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase text-emerald-500 tracking-widest opacity-60">Total Spent</p>
                <div className="text-emerald-500">{ICONS.PieChart}</div>
              </div>
              <p className="text-2xl font-black text-emerald-500 italic tracking-tighter">
                Rs.{filteredPurchases.reduce((acc, p) => acc + (p.cost * p.quantity), 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-[var(--bg-card)] p-5 rounded-[32px] border border-[var(--border)] shadow-xl space-y-2 bg-rose-600/5 border-rose-500/10">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase text-rose-500 tracking-widest opacity-60">Pending</p>
                <div className="text-rose-500">{ICONS.History}</div>
              </div>
              <p className="text-2xl font-black text-rose-500 italic tracking-tighter">
                Rs.{filteredPurchases.reduce((acc, p) => acc + (p.remainingAmount || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Modern Filter Bar */}
          <div className="bg-[var(--bg-card)] rounded-[32px] border border-[var(--border)] shadow-2xl overflow-hidden">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-white italic tracking-tight">Search & Filters</h4>
                <button 
                  onClick={() => {
                    setPurchaseFilter({ category: 'All', subCategory: 'All', supplier: 'All', search: '' });
                    setPurchaseDateRange({ start: '', end: '' });
                  }}
                  className="px-3 py-1.5 bg-rose-500/10 text-rose-500 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-all"
                >
                  Reset Filters
                </button>
              </div>

              <div className="space-y-4">
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-600 group-focus-within:scale-110 transition-transform">{ICONS.Search}</div>
                  <input 
                    type="text" 
                    placeholder="SEARCH BY ITEM NAME..." 
                    className="w-full bg-black/40 border-2 border-white/5 rounded-[20px] py-4 pl-12 pr-4 font-black uppercase text-[10px] text-white outline-none focus:border-orange-600 transition-all placeholder:text-white/20"
                    value={purchaseFilter.search}
                    onChange={e => setPurchaseFilter({...purchaseFilter, search: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">Category</p>
                    <select 
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[9px] font-black text-white uppercase outline-none focus:border-orange-600 appearance-none cursor-pointer"
                      value={purchaseFilter.category}
                      onChange={e => setPurchaseFilter({...purchaseFilter, category: e.target.value, subCategory: 'All'})}
                    >
                      <option value="All">All Categories</option>
                      {settings.purchaseCategories?.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">Supplier</p>
                    <select 
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[9px] font-black text-white uppercase outline-none focus:border-orange-600 appearance-none cursor-pointer"
                      value={purchaseFilter.supplier}
                      onChange={e => setPurchaseFilter({...purchaseFilter, supplier: e.target.value})}
                    >
                      <option value="All">All Suppliers</option>
                      {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">From Date</p>
                    <input 
                      type="date" 
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[9px] font-black text-white uppercase outline-none focus:border-orange-600"
                      value={purchaseDateRange.start}
                      onChange={e => setPurchaseDateRange({...purchaseDateRange, start: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">To Date</p>
                    <input 
                      type="date" 
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[9px] font-black text-white uppercase outline-none focus:border-orange-600"
                      value={purchaseDateRange.end}
                      onChange={e => setPurchaseDateRange({...purchaseDateRange, end: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Purchases List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-600 animate-pulse"></div>
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">{filteredPurchases.length} Purchase Records</p>
              </div>
            </div>

            {filteredPurchases.length === 0 ? (
              <div className="bg-[var(--bg-card)] p-20 rounded-[40px] text-center border-2 border-dashed border-[var(--border)] text-[var(--text-muted)] font-black uppercase text-[10px] space-y-4">
                <div className="text-4xl opacity-20">{ICONS.Package}</div>
                <p>No purchases match your criteria</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPurchases.map((p) => (
                  <div key={p.id} className="bg-[var(--bg-card)] rounded-[32px] border border-[var(--border)] shadow-xl overflow-hidden group hover:border-orange-600/40 transition-all duration-500">
                    <div className="p-6 flex items-start justify-between gap-4">
                      <div className="flex gap-4 min-w-0">
                        <div className="w-14 h-14 bg-orange-600/10 rounded-2xl flex items-center justify-center text-orange-600 shrink-0 group-hover:scale-110 transition-transform">
                          {ICONS.Package}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <h4 className="font-black text-lg uppercase text-white truncate italic tracking-tight leading-none">{p.itemName}</h4>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-white/5 rounded-md text-[7px] font-black text-orange-600 uppercase tracking-widest">{p.category}</span>
                            <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">• {p.supplier || 'General Vendor'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[8px] font-black text-[var(--text-muted)] uppercase">
                            <span>{ICONS.History}</span>
                            <span>{new Date(p.timestamp).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-black text-white italic tracking-tighter leading-none">Rs.{(p.cost * p.quantity).toLocaleString()}</p>
                        <p className="text-[9px] font-black text-orange-600 uppercase mt-1.5">{p.quantity} {p.unit} @ {p.unitCost || p.cost}</p>
                      </div>
                    </div>
                    
                    <div className="px-6 py-3 bg-black/20 border-t border-white/5 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${p.remainingAmount && p.remainingAmount > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                        <p className={`text-[8px] font-black uppercase tracking-widest ${p.remainingAmount && p.remainingAmount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {p.remainingAmount && p.remainingAmount > 0 ? `Baqi: Rs. ${p.remainingAmount.toLocaleString()}` : 'Fully Paid'}
                        </p>
                      </div>
                      <button 
                        onClick={() => {
                          if (p.remainingAmount && p.remainingAmount > 0) {
                            handleQuickPay(p.supplier, p.remainingAmount);
                          }
                        }}
                        className="text-[8px] font-black uppercase text-orange-600 hover:text-white transition-colors"
                      >
                        {p.remainingAmount && p.remainingAmount > 0 ? 'Pay Now →' : 'View Details'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {activeTab === 'khata' && (
        <div className="space-y-6 animate-in fade-in duration-500">
           {/* Header & Quick Action */}
           <div className="flex justify-between items-center px-2">
              <div className="space-y-1">
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Suppliers <span className="text-orange-600">Khata</span></h3>
                 <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Manage Balances & Payments</p>
              </div>
              <button onClick={() => setShowAddSupCategory(true)} className="w-12 h-12 bg-orange-600/10 text-orange-600 rounded-2xl border border-orange-600/20 flex items-center justify-center active:scale-90 transition-all shadow-lg">
                 {ICONS.Plus}
              </button>
           </div>

           {/* Search & Stats Bento */}
           <div className="space-y-4">
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-600 group-focus-within:scale-110 transition-transform">{ICONS.Search}</div>
                <input 
                  type="text" 
                  placeholder="SEARCH SUPPLIER NAME..." 
                  className="w-full bg-[var(--bg-card)] border-2 border-white/5 rounded-[24px] py-4 pl-12 pr-4 font-black uppercase text-[10px] text-white focus:border-orange-600 outline-none transition-all shadow-2xl placeholder:text-white/20"
                  value={khataSearch}
                  onChange={e => setKhataSearch(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div className="bg-[var(--bg-card)] p-5 rounded-[32px] border border-[var(--border)] shadow-xl space-y-1 bg-rose-600/5 border-rose-500/10">
                    <p className="text-[8px] font-black uppercase text-rose-500 tracking-widest opacity-60">Total Payable</p>
                    <p className="text-xl font-black text-rose-500 italic tracking-tighter">Rs.{supplierBalances.reduce((a,b) => a + b.balance, 0).toLocaleString()}</p>
                 </div>
                 <div className="bg-[var(--bg-card)] p-5 rounded-[32px] border border-[var(--border)] shadow-xl space-y-1 bg-emerald-600/5 border-emerald-500/10">
                    <p className="text-[8px] font-black uppercase text-emerald-500 tracking-widest opacity-60">Total Paid</p>
                    <p className="text-xl font-black text-emerald-500 italic tracking-tighter">Rs.{supplierBalances.reduce((a,b) => a + b.totalPayment, 0).toLocaleString()}</p>
                 </div>
              </div>
           </div>

           {/* Category Tabs */}
           <div className="flex gap-2.5 overflow-x-auto pb-3 scrollbar-hide px-1">
             <button onClick={() => setSelectedSupCatId('All')} className={`px-6 py-3.5 rounded-2xl text-[9px] font-black whitespace-nowrap transition-all shadow-xl border ${selectedSupCatId === 'All' ? 'bg-orange-600 border-orange-600 text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)]'}`}>ALL PARTIES</button>
             {supplierCategories.map(cat => (
               <div key={cat.id} className="flex gap-1 shrink-0">
                  <button onClick={() => setSelectedSupCatId(cat.id)} className={`px-6 py-3.5 rounded-2xl text-[9px] font-black whitespace-nowrap transition-all shadow-xl border ${selectedSupCatId === cat.id ? 'bg-orange-600 border-orange-600 text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)]'}`}>{cat.name}</button>
                  {selectedSupCatId === cat.id && (
                    <button onClick={() => { setEditCatName(cat.name); setShowEditSupCategory(cat); }} className="p-2 text-orange-600/50 hover:text-orange-600 transition-colors">{ICONS.Settings}</button>
                  )}
               </div>
             ))}
           </div>

           {/* Supplier Cards */}
           <div className="space-y-4">
              {supplierBalances.length === 0 ? (
                <div className="p-20 text-center border-2 border-dashed border-[var(--border)] rounded-[40px] text-[var(--text-muted)] font-black uppercase text-[10px] space-y-4">
                  <div className="text-4xl opacity-10">{ICONS.User}</div>
                  <p>No suppliers found</p>
                </div>
              ) : supplierBalances.map((sup, idx) => (
                <div key={idx} className="bg-[var(--bg-card)] rounded-[32px] border border-[var(--border)] shadow-xl overflow-hidden group hover:border-orange-600/30 transition-all duration-500">
                   <div className="p-6 flex justify-between items-center">
                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => { setViewSupplierLedger(sup.name); setLedgerStartDate(''); setLedgerEndDate(''); }}>
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all">
                               {ICONS.User}
                            </div>
                            <p className="font-black text-sm uppercase text-white truncate italic tracking-tight">{sup.name}</p>
                         </div>
                         <div className="flex items-center gap-3 mt-2 ml-1">
                            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Paid: Rs.{sup.totalPayment.toLocaleString()}</p>
                            <span className="w-1 h-1 rounded-full bg-white/10"></span>
                            <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Purchased: Rs.{sup.totalPurchase.toLocaleString()}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-5">
                         <div className="text-right">
                           <p className={`text-lg font-black italic tracking-tighter leading-none ${sup.balance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>Rs.{sup.balance.toLocaleString()}</p>
                           <p className={`text-[7px] font-black uppercase tracking-[0.2em] mt-1.5 ${sup.balance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{sup.balance > 0 ? 'PAYABLE' : 'CLEAR'}</p>
                         </div>
                         <button onClick={() => handleQuickPay(sup.name, sup.balance)} className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20 active:scale-90 transition-all">
                            {ICONS.Plus}
                         </button>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* MODALS SECTION */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[1000] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 w-full max-w-xs p-10 space-y-8 animate-in zoom-in shadow-2xl">
             <div className="text-center space-y-2"><h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">New <span className="text-orange-600">Stock Group</span></h3></div>
             <input type="text" autoFocus placeholder="MEAT / VEG / DRINKS" className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-white font-black text-center outline-none focus:border-orange-600 uppercase text-xs tracking-widest transition-all" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
             <div className="flex gap-4">
                <button onClick={() => setShowAddCategory(false)} className="flex-1 font-black text-[var(--text-muted)] uppercase text-[10px]">Cancel</button>
                <button onClick={handleAddCategory} className="flex-[2] py-4 bg-orange-600 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-xl">CREATE GROUP</button>
             </div>
          </div>
        </div>
      )}

      {showAddSupCategory && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[1000] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 w-full max-w-xs p-10 space-y-8 animate-in zoom-in shadow-2xl">
             <div className="text-center space-y-2"><h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">New <span className="text-orange-600">Supplier Group</span></h3></div>
             <input type="text" autoFocus placeholder="POULTRY / PACKAGING / DAIRY" className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-white font-black text-center outline-none focus:border-orange-600 uppercase text-xs tracking-widest transition-all" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
             <div className="flex gap-4">
                <button onClick={() => setShowAddSupCategory(false)} className="flex-1 font-black text-[var(--text-muted)] uppercase text-[10px]">Cancel</button>
                <button onClick={handleAddSupCategory} className="flex-[2] py-4 bg-orange-600 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-xl">CREATE GROUP</button>
             </div>
          </div>
        </div>
      )}

      {showEditCategory && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[1000] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 w-full max-w-xs p-10 space-y-8 animate-in zoom-in shadow-2xl">
             <div className="text-center space-y-2"><h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">Rename <span className="text-orange-600">Group</span></h3></div>
             <input type="text" autoFocus className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-white font-black text-center outline-none focus:border-orange-600 uppercase text-xs tracking-widest transition-all" value={editCatName} onChange={e => setEditCatName(e.target.value)} />
             <div className="flex gap-4">
                <button onClick={() => setShowEditCategory(null)} className="flex-1 font-black text-[var(--text-muted)] uppercase text-[10px]">Cancel</button>
                <button onClick={handleUpdateCategory} className="flex-[2] py-4 bg-orange-600 text-white rounded-[24px] font-black uppercase text-[10px] shadow-xl">Update</button>
             </div>
          </div>
        </div>
      )}

      {showEditSupCategory && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[1000] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 w-full max-w-xs p-10 space-y-8 animate-in zoom-in shadow-2xl">
             <div className="text-center space-y-2"><h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">Edit <span className="text-orange-600">Khata Group</span></h3></div>
             <input type="text" autoFocus className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-white font-black text-center outline-none focus:border-orange-600 uppercase text-xs tracking-widest transition-all" value={editCatName} onChange={e => setEditCatName(e.target.value)} />
             <div className="flex gap-4">
                <button onClick={() => setShowEditSupCategory(null)} className="flex-1 font-black text-[var(--text-muted)] uppercase text-[10px]">Cancel</button>
                <button onClick={() => { handleUpdateSupCategory(); }} className="flex-[2] py-4 bg-orange-600 text-white rounded-[24px] font-black uppercase text-[10px] shadow-xl">Update</button>
                <button onClick={() => { setShowDeleteConfirm({id: showEditSupCategory.id, type: 'supplier_cat'}); setShowEditSupCategory(null); }} className="p-4 bg-red-600/10 text-red-500 rounded-2xl">{ICONS.Trash2}</button>
             </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[1000] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 w-full max-w-xs p-10 space-y-8 animate-in zoom-in shadow-2xl text-center">
             <div className="w-20 h-20 bg-red-600/10 text-red-600 rounded-3xl mx-auto flex items-center justify-center mb-4">{ICONS.Trash2}</div>
             <div className="space-y-3">
                <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white leading-none">Kya Aap Isse <span className="text-red-600">Delete</span> Karna Chahte Hain?</h3>
                <p className="text-[11px] font-black text-red-500 uppercase leading-relaxed tracking-wide bg-red-600/10 p-4 rounded-2xl">Is group ko delete karne se iske andar ka tamam data khatam ho jayega.</p>
             </div>
             <div className="flex gap-4 pt-4">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-5 bg-white/5 rounded-[28px] font-black uppercase text-[10px] text-white">Nahi, Back</button>
                <button onClick={handleDeleteConfirmed} className="flex-1 py-5 bg-red-600 text-white rounded-[28px] font-black uppercase text-[10px] shadow-xl">Haan, Delete</button>
             </div>
          </div>
        </div>
      )}

      {showAddItem && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[1000] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 w-full max-w-sm p-10 space-y-8 animate-in zoom-in shadow-2xl">
             <div className="text-center"><h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">Naya <span className="text-orange-600">Item</span></h3></div>
             <div className="space-y-4">
                <input type="text" autoFocus placeholder="ITEM NAME (E.G. CHICKEN)" className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-white font-black outline-none focus:border-orange-600 uppercase text-center text-xs" value={newItemName} onChange={e => setNewItemName(e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                   <select className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-orange-600 font-black text-xs uppercase outline-none text-center appearance-none" value={newItemUnit} onChange={e => setNewItemUnit(e.target.value as UnitType)}>
                      <option value="kg">Kilo (KG)</option><option value="pcs">Pieces (PCS)</option>
                   </select>
                   <input type="number" placeholder="MIN STOCK" className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-white font-black text-center outline-none focus:border-orange-600 text-xs" value={newItemMinStock} onChange={e => setNewItemMinStock(e.target.value)} />
                </div>
             </div>
             <div className="flex gap-4">
                <button onClick={() => setShowAddItem(null)} className="flex-1 font-black text-[var(--text-muted)] uppercase text-[10px]">Cancel</button>
                <button onClick={handleAddItem} className="flex-[2] py-4 bg-orange-600 text-white rounded-[24px] font-black uppercase text-[10px] shadow-xl">ADD ITEM</button>
             </div>
          </div>
        </div>
      )}

      {showAddPayment && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[1000] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 w-full max-w-sm p-10 space-y-6 animate-in zoom-in shadow-2xl overflow-y-auto max-h-[90vh]">
             <div className="text-center"><h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">Khata <span className="text-emerald-500">Entry</span></h3></div>
             
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                   {['payment', 'return', 'discount', 'adjustment'].map((t) => (
                     <button 
                       key={t} 
                       onClick={() => setPaymentType(t as any)}
                       className={`py-3 rounded-xl text-[9px] font-black uppercase border transition-all ${paymentType === t ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white/5 border-white/10 text-[var(--text-muted)]'}`}
                     >
                       {t}
                     </button>
                   ))}
                </div>

                 <div className="space-y-1">
                   <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4">Select Supplier</label>
                   <select 
                     className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-white font-black outline-none focus:border-orange-600 appearance-none text-center text-xs uppercase"
                     value={paymentSupplier} onChange={e => setPaymentSupplier(e.target.value)}
                   >
                     <option value="">Select Supplier</option>
                     {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                   </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4">Amount (Rs)</label>
                  <input type="number" placeholder="0" className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-emerald-500 font-black outline-none focus:border-emerald-600 text-center text-xl" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                </div>

                {paymentType === 'payment' && (
                  <div className="grid grid-cols-3 gap-2">
                    {['cash', 'bank', 'jazzcash'].map(m => (
                      <button 
                        key={m} 
                        onClick={() => setPaymentMethod(m)}
                        className={`py-3 rounded-xl text-[9px] font-black uppercase border transition-all ${paymentMethod === m ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/5 border-white/10 text-[var(--text-muted)]'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}

                <input type="text" placeholder="DETAILED NOTE (E.G. BILL # 123)" className="w-full p-4 bg-black border border-white/5 rounded-xl text-[var(--text-muted)] font-black outline-none focus:border-orange-600 text-center text-[10px] uppercase" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} />
             </div>
             <div className="flex gap-4">
                <button onClick={() => setShowAddPayment(false)} className="flex-1 font-black text-[var(--text-muted)] uppercase text-[10px]">Cancel</button>
                <button onClick={handleAddPayment} className="flex-[2] py-4 bg-emerald-600 text-white rounded-[24px] font-black uppercase text-[10px] shadow-xl">SAVE ENTRY</button>
             </div>
          </div>
        </div>
      )}

      {viewSupplierLedger && (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl z-[3000] flex flex-col animate-in slide-in-from-bottom duration-400">
           <header className="p-8 border-b border-white/5 flex justify-between items-center bg-[var(--bg-nav)]">
              <div>
                <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">{viewSupplierLedger}</h3>
                <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Lein-Den Full History</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => handleExportKhata(viewSupplierLedger, ledgerTransactions)} 
                  className="p-3 rounded-2xl bg-white/5 text-orange-600 border border-white/5 active:scale-90 transition-all"
                >
                  {ICONS.Download}
                </button>
                <button onClick={() => setViewSupplierLedger(null)} className="p-3 rounded-2xl bg-white/5 text-white active:scale-90 transition-all">{ICONS.X}</button>
              </div>
           </header>

           <div className="p-4 bg-black/40 border-b border-white/5 space-y-3">
              <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] ml-2">Filter By Date Range</p>
              <div className="flex gap-2 items-center">
                 <input 
                   type="date" 
                   className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-[10px] font-black text-white outline-none focus:border-orange-600"
                   value={ledgerStartDate}
                   onChange={e => setLedgerStartDate(e.target.value)}
                 />
                 <span className="text-[var(--text-muted)] text-[8px] font-black">TO</span>
                 <input 
                   type="date" 
                   className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-[10px] font-black text-white outline-none focus:border-orange-600"
                   value={ledgerEndDate}
                   onChange={e => setLedgerEndDate(e.target.value)}
                 />
                 <button onClick={() => { setLedgerStartDate(''); setLedgerEndDate(''); }} className="p-3 bg-white/5 rounded-xl text-red-500">{ICONS.X}</button>
              </div>
           </div>

           <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide pb-24">
              {ledgerTransactions.length === 0 ? (
                <div className="p-20 text-center border-2 border-dashed border-white/5 rounded-[40px] text-[var(--text-muted)] font-black uppercase text-[10px]">No entries found in this range</div>
              ) : ledgerTransactions.map(t => {
                 const isCredit = t.type === 'payment' || t.type === 'return' || t.type === 'discount' || (t.type === 'adjustment' && t.amount < 0);
                 const typeLabels: Record<string, string> = {
                   purchase: 'MAAL LIYA (-)',
                   payment: 'PAISA DIYA (+)',
                   return: 'MAAL WAPIS (+)',
                   discount: 'DISCOUNT (+)',
                   adjustment: t.amount > 0 ? 'ADJ (-)' : 'ADJ (+)'
                 };
                 
                 return (
                  <div key={t.id} className={`p-5 rounded-[28px] border border-white/5 flex justify-between items-center ${!isCredit ? 'bg-rose-500/5' : 'bg-emerald-500/5'}`}>
                     <div className="min-w-0 flex-1 mr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`text-[8px] font-black uppercase tracking-widest ${!isCredit ? 'text-rose-500' : 'text-emerald-500'}`}>{typeLabels[t.type]}</p>
                          {t.paymentMethod && (
                            <span className="px-2 py-0.5 bg-blue-600/10 text-blue-500 text-[7px] font-black rounded-full uppercase tracking-tighter">{t.paymentMethod}</span>
                          )}
                        </div>
                        <p className="font-black text-sm uppercase text-white truncate">{t.note || 'Entry'}</p>
                        <p className="text-[8px] font-black text-[var(--text-muted)] mt-1">{new Date(t.timestamp).toLocaleDateString()} at {new Date(t.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                     </div>
                     <p className={`font-black text-base shrink-0 ${!isCredit ? 'text-rose-500' : 'text-emerald-500'}`}>{!isCredit ? '-' : '+'}Rs.{Math.abs(t.amount).toLocaleString()}</p>
                  </div>
                 );
              })}
           </div>

           <div className="p-8 border-t border-white/5 bg-[var(--bg-nav)] fixed bottom-0 left-0 right-0 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
              <div className="flex justify-between items-center">
                 <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Balance Pending</span>
                    <p className="text-3xl font-black text-white italic tracking-tighter">Rs.{supplierBalances.find(s => s.name.toUpperCase() === viewSupplierLedger.toUpperCase())?.balance.toLocaleString()}</p>
                 </div>
                 <button onClick={() => { const bal = supplierBalances.find(s => s.name.toUpperCase() === viewSupplierLedger.toUpperCase())?.balance || 0; handleQuickPay(viewSupplierLedger, bal); }} className="bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] shadow-xl">PAY NOW</button>
              </div>
           </div>
        </div>
      )}

      {showConfirmIntake && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[1000] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 w-full max-sm p-10 space-y-8 animate-in zoom-in shadow-2xl">
             <div className="text-center space-y-2"><h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">Confirm <span className="text-orange-600">Bill</span></h3><p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Total: Rs.{intakeTotal.toLocaleString()}</p></div>
             <div className="space-y-4">
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4">Select Supplier</label>
                   <select 
                     className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-white font-black outline-none focus:border-orange-600 appearance-none text-center text-xs uppercase"
                     value={registerSupplier} onChange={e => setRegisterSupplier(e.target.value)}
                   >
                     <option value="">Select Supplier</option>
                     {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                   </select>
                </div>
             </div>
             <div className="flex gap-4 pt-4">
                <button onClick={() => setShowConfirmIntake(false)} className="flex-1 font-black text-[var(--text-muted)] uppercase text-[10px]">Back</button>
                <button onClick={finalizeIntake} className="flex-[2] py-5 bg-orange-600 text-white rounded-[28px] font-black uppercase text-[11px] shadow-xl">SAVE RECORD</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
