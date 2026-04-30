import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Order, Purchase, MenuItem, AppSettings, ShopAccount, AppTheme, Customer, FontSize, FontFamily, StaffMember, Supplier, PurchaseItem, StockCategory, StockLog, KhataTransaction, CustomerPayment } from '../types';
import { ICONS } from '../constants';
import { compressImage } from '../utils/imageCompression';
import { getBusinessDate } from '../utils/dateUtils';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';

interface AdminProps {
  orders: Order[];
  purchases: Purchase[];
  customers: Customer[];
  setCustomers: (c: Customer[]) => void;
  customerPayments: CustomerPayment[];
  setCustomerPayments: (p: CustomerPayment[]) => void;
  suppliers: Supplier[];
  setSuppliers: (s: Supplier[]) => void;
  settings: AppSettings;
  isAdmin: boolean;
  activeShop: ShopAccount | null;
  onUpdateShop: (shop: ShopAccount) => void;
  setSettings: (s: AppSettings) => void;
  onLogout: () => void;
  onNavigateToMenu: () => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
  onResetData: () => void;
  onAddPurchase: (p: Purchase) => void;
  onUpdatePurchase: (p: Purchase) => void;
  onDeletePurchase: (id: string) => void;
  stockCategories: StockCategory[];
  setStockCategories: (c: StockCategory[]) => void;
  stockLogs: StockLog[];
  setStockLogs: (l: StockLog[]) => void;
  khataTransactions: KhataTransaction[];
  setKhataTransactions: (t: KhataTransaction[]) => void;
  triggerConfirm: (config: { title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' }) => void;
  onResetHistory: () => void;
  isTotalsUnlocked?: boolean;
  onUnlockRequest: () => void;
  setIsNavHidden?: (hidden: boolean) => void;
  staffMembers: StaffMember[];
  setStaffMembers: (s: StaffMember[]) => void;
  menuItems: MenuItem[];
  setMenuItems: (items: MenuItem[]) => void;
  isSyncing: boolean;
  setIsSyncing: (syncing: boolean) => void;
  menuRequests?: any[];
  onUpdateMenuRequest?: (id: string, status: 'approved' | 'denied') => void;
  isInstallable?: boolean;
  onInstall?: () => void;
  showSecretSlider: boolean;
  setShowSecretSlider: (val: boolean) => void;
  isCashier?: boolean;
  isPrinterDevice?: boolean;
  setIsPrinterDevice?: (val: boolean) => void;
}

const AdminDashboard: React.FC<AdminProps> = ({
  orders = [], purchases = [], customers = [], setCustomers, customerPayments = [], setCustomerPayments, suppliers = [], setSuppliers, settings, setSettings, onLogout, isAdmin, activeShop, onUpdateShop, onNavigateToMenu, onExportData, onImportData, onResetData, onAddPurchase, onUpdatePurchase, onDeletePurchase,
  stockCategories, setStockCategories, stockLogs, setStockLogs, khataTransactions, setKhataTransactions, onUpdateOrder, triggerConfirm, onResetHistory, isTotalsUnlocked = false, onUnlockRequest,
  setIsNavHidden, staffMembers = [], setStaffMembers, menuItems = [], setMenuItems, isSyncing, setIsSyncing, menuRequests = [], onUpdateMenuRequest,
  isInstallable, onInstall, showSecretSlider, setShowSecretSlider, isCashier,
  isPrinterDevice, setIsPrinterDevice
}) => {
  // Tab protection helper
  const handleTabChange = (tab: typeof adminTab) => {
    setAdminTab(tab);
    localStorage.setItem('admin_active_tab', tab);
  };
  // Helper: mask amounts if locked
  // Helper: mask amounts if locked
  const amt = (val: number | string, suffix = '', forceShow = false) => {
    if (!isTotalsUnlocked && !forceShow) return '****';
    let displayVal = val;
    if (typeof val === 'number' && settings.statsAdjustmentPercentage && settings.statsAdjustmentPercentage !== 100) {
      displayVal = val * (settings.statsAdjustmentPercentage / 100);
    }
    return typeof displayVal === 'number' ? `Rs.${displayVal.toFixed(0)}${suffix}` : `${displayVal}${suffix}`;
  };
  const [adminTab, setAdminTab] = useState<'monitor' | 'crm' | 'identity' | 'registry' | 'takers' | 'config' | 'suppliers' | 'purchases' | 'settlement'>(() => {
    if (isCashier) return 'crm';
    const saved = localStorage.getItem('admin_active_tab');
    if (saved) return saved as any;
    return isAdmin ? 'registry' : 'monitor';
  });
  const [crmSort, setCrmSort] = useState<'balance' | 'spending' | 'visit'>('balance');
  const [showCustomerPayModal, setShowCustomerPayModal] = useState<Customer | null>(null);
  const [showCustomerHistoryModal, setShowCustomerHistoryModal] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState('');


  // Settlement State
  const [settlementOrder, setSettlementOrder] = useState<Order | null>(null);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [viewOrder, setViewOrder] = useState<Order | null>(null);

  const [ownerClickCount, setOwnerClickCount] = useState(0);

  const handleOwnerClick = () => {
    const newCount = ownerClickCount + 1;
    setOwnerClickCount(newCount);
    
    if (!showSecretSlider && newCount >= 7) {
      setShowSecretSlider(true);
      setOwnerClickCount(0);
      alert("Sales Adjustment Slider Unlocked!");
    } else if (showSecretSlider && newCount >= 3) {
      setShowSecretSlider(false);
      setOwnerClickCount(0);
      alert("Sales Adjustment Slider Hidden!");
    }
  };


  const handlePrintReceipt = (order: Order) => {
    // Attempt to open a new window for printing. If blocked, fall back to using a hidden iframe.
    const itemHtml = order.items.map(item => `
      <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:12px;">
        <span>${item.quantity}x ${item.name}</span>
        <span>Rs.${(item.price * item.quantity).toLocaleString()}</span>
      </div>
    `).join('');
    const printContent = `
      <html>
        <head>
          <title>Receipt #${order.orderNumber}</title>
          <style>
            body { font-family: monospace; width: 80mm; padding: 10px; margin: 0; background: white; color: black; }
            h2 { text-align: center; margin: 0; font-size: 1.5em; }
            p { margin: 5px 0; font-size: 12px; }
            .hr { border-bottom: 1px dashed black; margin: 10px 0; }
            .total { font-weight: bold; font-size: 1.3em; margin-top: 10px; text-align: right; }
          </style>
        </head>
        <body>
          <h2>${settings.businessName}</h2>
          <p style="text-align:center;">Order #${order.orderNumber}</p>
          <p>Date: ${new Date(order.timestamp).toLocaleString()}</p>
          <p>Customer: ${order.customerName}</p>
          <div class="hr"></div>
          ${itemHtml}
          <div class="hr"></div>
          <div class="total">Total: Rs.${order.total.toLocaleString()}</div>
          <p style="text-align:center; margin-top:30px; font-weight:bold;">${settings.receiptFooterText || 'Shukria!'}</p>
        </body>
      </html>
    `;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) { 
      doc.open(); 
      doc.write(printContent); 
      doc.close(); 
    }
    setTimeout(() => { 
      iframe.contentWindow?.focus(); 
      iframe.contentWindow?.print(); 
      document.body.removeChild(iframe); 
    }, 500);
  };


  // Purchase State
  const [pItemName, setPItemName] = useState('');
  const [pCategory, setPCategory] = useState('General');
  const [pQty, setPQty] = useState('');
  const [pCost, setPCost] = useState('');
  const [pPaidAmount, setPPaidAmount] = useState('');
  const [pSupplier, setPSupplier] = useState('');
  const [showAddPurchaseModal, setShowAddPurchaseModal] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

  // Quick Items State
  const [quickItems, setQuickItems] = useState<string[]>(["Chicken", "Oil", "Vegetables", "Flour", "Gas", "Meat", "Rice", "Spices", "Packaging", "Milk", "Sugar"]);
  const [isManagingQuickItems, setIsManagingQuickItems] = useState(false);
  const [newQuickItem, setNewQuickItem] = useState("");

  const handleQuickAdd = (item: string) => {
    if (isManagingQuickItems) return;
    setPItemName(item);
    setPCategory('General');
    setPQty('');
    setPCost('');
    setPPaidAmount('');
    setPSupplier('');
    setEditingPurchaseId(null);
    setShowAddPurchaseModal(true);
  };

  const handleAddQuickItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newQuickItem.trim() && !quickItems.includes(newQuickItem.trim())) {
      setQuickItems([...quickItems, newQuickItem.trim()]);
      setNewQuickItem("");
    }
  };

  const handleRemoveQuickItem = (item: string) => {
    triggerConfirm({
      title: "Remove Quick Item?",
      message: `Kya aap waqai "${item}" ko quick items se nikalna chahte hain?`,
      onConfirm: () => setQuickItems(quickItems.filter(i => i !== item))
    });
  };

  const handleEditPurchase = (p: Purchase) => {
    setEditingPurchaseId(p.id);
    setPItemName(p.itemName);
    setPCategory(p.category);
    setPQty(p.quantity.toString());
    setPCost(p.unitCost.toString());
    setPPaidAmount(p.paidAmount.toString());
    setPSupplier(p.supplier === 'General' ? '' : p.supplier);
    setShowAddPurchaseModal(true);
  };

  const handleAddPurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pItemName || !pCost || !pQty) return alert("Please fill all required fields");

    const cost = parseFloat(pCost);
    const qty = parseFloat(pQty);
    const paid = pPaidAmount ? parseFloat(pPaidAmount) : 0;

    if (editingPurchaseId) {
      const existing = purchases.find(p => p.id === editingPurchaseId);
      if (existing) {
        const diff = paid - (existing.paidAmount || 0);
        const newHistory = [
          ...(existing.paymentHistory || (existing.paidAmount ? [{ amount: existing.paidAmount, timestamp: existing.timestamp }] : [])),
          ...(diff !== 0 ? [{ amount: diff, timestamp: Date.now() }] : [])
        ];

        const updatedPurchase: Purchase = {
          ...existing,
          itemName: pItemName,
          category: pCategory,
          quantity: qty,
          unitCost: cost,
          cost: cost * qty,
          supplier: pSupplier || 'General',
          paidAmount: paid,
          remainingAmount: (cost * qty) - paid,
          paymentHistory: newHistory
        };
        onUpdatePurchase(updatedPurchase);
        alert("Purchase Updated Successfully!");
      }
    } else {
      const newPurchase: Purchase = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        itemName: pItemName,
        category: pCategory,
        quantity: qty,
        unit: 'pcs',
        unitCost: cost,
        cost: cost * qty,
        supplier: pSupplier || 'General',
        paymentMethod: 'cash',
        paidAmount: paid,
        remainingAmount: (cost * qty) - paid,
        paymentHistory: paid > 0 ? [{ amount: paid, timestamp: Date.now() }] : []
      };
      onAddPurchase(newPurchase);
      alert("Purchase Added Successfully!");
    }

    setShowAddPurchaseModal(false);
    setEditingPurchaseId(null);
    setPItemName('');
    setPQty('');
    setPCost('');
    setPPaidAmount('');
    setPSupplier('');
  };

  // Marketing / Broadcast State
  const [crmView, setCrmView] = useState<'list' | 'broadcast'>('list');
  const [promoMessage, setPromoMessage] = useState('Assalam-o-Alaikum! AJ HAMARI SHOP PER SPECIAL BBQ DEAL HAI. ABHI ORDER KAREIN!');
  const [promoImage, setPromoImage] = useState<string | null>(null);
  const [isCompressingPromo, setIsCompressingPromo] = useState(false);
  const [messagedIds, setMessagedIds] = useState<Set<string>>(new Set());
  const [bulkIndex, setBulkIndex] = useState<number | null>(null);

  const QUICK_TEMPLATES = [
    { label: 'Special Deal', text: 'Assalam-o-Alaikum! AJ HAMARI SHOP PER SPECIAL BBQ DEAL HAI. ABHI ORDER KAREIN!' },
    { label: 'New Dish', text: 'Assalam-o-Alaikum! HAMARE MENU MEIN NAYI DISH SHAMIL HO GAYI HAI. AAJ HI TRY KAREIN!' },
    { label: 'Discount', text: 'KHUSH KHABRI! AAJ TAMAM ITEMS PER 10% DISCOUNT HAI. SIRF AAJ KE LIYE!' },
    { label: 'Greeting', text: 'Assalam-o-Alaikum! UMEED HAI AAP KHAIRIYAT SE HONGE. HAMARI SHOP PER TASHREEF LAYEIN!' },
  ];

  const [showRestoreConfirm, setShowRestoreConfirm] = useState<File | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [confirmOwnerPassword, setConfirmOwnerPassword] = useState('');

  // Shop Registry State
  const [newShopName, setNewShopName] = useState('');
  const [newShopId, setNewShopId] = useState('');
  const [newShopPass, setNewShopPass] = useState('');
  const [editingShop, setEditingShop] = useState<ShopAccount | null>(null);

  // Staff State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffId, setNewStaffId] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'taker' | 'kitchen'>('taker');
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [viewingStaffHistory, setViewingStaffHistory] = useState<StaffMember | null>(null);

  React.useEffect(() => {
    const isAnyModalOpen = !!showCustomerPayModal || !!showCustomerHistoryModal || !!settlementOrder || !!viewOrder || showAddPurchaseModal || isManagingQuickItems || !!showRestoreConfirm || showResetConfirm || !!editingShop || !!editingStaff || !!viewingStaffHistory;
    setIsNavHidden?.(isAnyModalOpen);
  }, [showCustomerPayModal, showCustomerHistoryModal, settlementOrder, viewOrder, showAddPurchaseModal, isManagingQuickItems, showRestoreConfirm, showResetConfirm, editingShop, editingStaff, viewingStaffHistory, setIsNavHidden]);

  // Supplier State
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierCategory, setNewSupplierCategory] = useState('General');

  const handleAddSupplier = () => {
    if (!newSupplierName.trim()) return alert("Supplier name likhein!");
    const newS: Supplier = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      name: newSupplierName,
      categoryId: newSupplierCategory
    };
    setSuppliers([...suppliers, newS]);
    setNewSupplierName('');
    alert("Supplier added successfully!");
  };

  const handleDeleteSupplier = (id: string) => {
    if (confirm("Supplier delete karein?")) {
      setSuppliers(suppliers.filter(s => s.id !== id));
    }
  };

  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      try {
        const base64 = await compressImage(file, 100, 0.4);
        setSettings({ ...settings, businessLogo: base64 });
      } catch (err) {
        console.error("Logo compression failed", err);
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const handleSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) return alert("Sound file size must be less than 1MB!");
      const soundName = prompt("Enter a name for this sound:", file.name.split('.')[0]);
      if (!soundName) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newSound = {
          id: Math.random().toString(36).substr(2, 9),
          name: soundName,
          url: base64
        };
        const updatedSounds = [...(settings.notificationSounds || []), newSound];
        setSettings({
          ...settings,
          notificationSounds: updatedSounds,
          notificationSoundUrl: base64 // Automatically select the newly uploaded sound
        });
        alert("Notification sound added and selected!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddDeliveryZone = () => {
    const name = prompt("Enter delivery zone name (e.g. Gulshan-e-Iqbal):");
    if (!name) return;
    const feeStr = prompt("Enter delivery fee for this zone (Rs):", "100");
    if (feeStr === null) return;
    const fee = parseFloat(feeStr);
    if (isNaN(fee)) return alert("Invalid fee amount!");

    const newZone = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      fee
    };

    setSettings({
      ...settings,
      deliveryZones: [...(settings.deliveryZones || []), newZone]
    });
    alert("Delivery zone added!");
  };

  const handleDeleteDeliveryZone = (id: string) => {
    if (!confirm("Are you sure you want to delete this delivery zone?")) return;
    setSettings({
      ...settings,
      deliveryZones: (settings.deliveryZones || []).filter(z => z.id !== id)
    });
  };

  const handleShareWhatsApp = (order: Order) => {
    const rawPhone = order.customerPhone.trim();
    if (!rawPhone || rawPhone.length < 5) {
      alert("Customer ka mobile number hona lazmi hai WhatsApp bhejne ke liye.");
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

    const itemsList = order.items.map(item => {
      const unitLabel = item.unit === 'rs' ? 'Rs.' : 'x';
      return `• ${item.name} (${unitLabel}${item.quantity}): Rs.${(item.price * item.quantity).toFixed(0)}`;
    }).join('\n');

    const message = `*${headerName} - INVOICE*\n` +
      `--------------------------\n` +
      `Order No: #${order.orderNumber || '??'}\n` +
      `Order ID: ${order.id.slice(-8)}\n` +
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

  const handlePromoImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressingPromo(true);
      try {
        const base64 = await compressImage(file, 100, 0.4);
        setPromoImage(base64);
      } catch (err) {
        console.error("Promo compression failed", err);
      } finally {
        setIsCompressingPromo(false);
      }
    }
  };

  const adjustFontSize = (delta: number) => {
    const current = settings.fontSizeNumber || 16;
    const next = Math.min(32, Math.max(12, current + delta));
    setSettings({ ...settings, fontSizeNumber: next });
  };

  const handleCustomerPayment = () => {
    if (!showCustomerPayModal || !payAmount) return;
    const amount = parseFloat(payAmount);

    // Record Payment
    const newPayment: CustomerPayment = {
      id: Math.random().toString(36).substr(2, 9),
      customerId: showCustomerPayModal.id,
      amount: amount,
      timestamp: Date.now(),
      method: 'cash',
      note: 'Manual Payment'
    };
    setCustomerPayments([...customerPayments, newPayment]);

    setCustomers(customers.map(c =>
      c.id === showCustomerPayModal.id ? { ...c, balance: (c.balance || 0) - amount } : c
    ));
    setShowCustomerPayModal(null);
    setPayAmount('');
    alert("Payment Recieved!");
  };

  const handleAddShop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName || !newShopId || !newShopPass) return alert("All details are required!");
    const shopAccounts = settings.shopAccounts || [];
    if (shopAccounts.find(a => a.id.toLowerCase() === newShopId.toLowerCase())) return alert("ID already exists!");

    const newAccount: ShopAccount = {
      id: newShopId.toUpperCase(),
      password: newShopPass,
      shopName: newShopName,
      subscriptionStatus: 'active',
      expiryDate: Date.now() + (30 * 24 * 60 * 60 * 1000),
      createdAt: Date.now()
    };
    setSettings({ ...settings, shopAccounts: [...shopAccounts, newAccount] });
    setNewShopName(''); setNewShopId(''); setNewShopPass('');
    alert("Shop Registered!");
  };

  const handleUpdateShopCredentials = () => {
    if (!editingShop) return;
    const shopAccounts = settings.shopAccounts || [];
    const updated = shopAccounts.map(a => a.id === editingShop.id ? editingShop : a);
    setSettings({ ...settings, shopAccounts: updated });
    setEditingShop(null);
    alert("Shop Credentials Updated!");
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || !newStaffPassword || !newStaffId) return alert("Name, ID and Password are required!");

    if (staffMembers.some(s => s.id === newStaffId.toUpperCase())) return alert("ID already exists!");

    const newStaff: StaffMember = {
      id: newStaffId.toUpperCase(),
      name: newStaffName.toUpperCase(),
      password: newStaffPassword,
      role: newStaffRole,
      createdAt: Date.now()
    };

    try {
      // Optimistic Update: Local state ko pehly update karein taake user ko fori nazar aaye
      const updatedStaff = [...staffMembers, newStaff];
      setStaffMembers(updatedStaff);
      
      // Write directly to Firestore
      await setDoc(doc(db, "staffMembers", newStaff.id), newStaff);
      
      setNewStaffName('');
      setNewStaffId('');
      setNewStaffPassword('');
      alert("Staff Member Added! Yeh har device par save ho jayega.");
    } catch (err) {
      alert("Error saving staff: " + (err as Error).message);
      // Rollback on error
      setStaffMembers(staffMembers);
    }
  };

  const handleOptimizeMenuImages = async () => {
    if (!confirm("Kya aap waqai tamaam menu images ko optimize karna chahte hain? Is se database ki jagah khali hogi.")) return;
    
    setIsSyncing(true);
    let optimizedCount = 0;
    try {
      for (const item of menuItems) {
        if (item.image && item.image.startsWith('data:image')) {
          try {
            const compressed = await compressImage(item.image, 80, 0.3);
            if (compressed.length < item.image.length) {
              await setDoc(doc(db, "items", item.id), { ...item, image: compressed });
              optimizedCount++;
            }
          } catch (e) {
            console.error(`Failed to optimize ${item.name}`, e);
          }
        }
      }
      alert(`Mubarak ho! ${optimizedCount} images optimize ho chuki hain.`);
    } catch (err) {
      alert("Optimization failed: " + (err as Error).message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;
    try {
      // Optimistic Update
      const updatedStaff = staffMembers.map(s => s.id === editingStaff.id ? editingStaff : s);
      setStaffMembers(updatedStaff);

      await setDoc(doc(db, "staffMembers", editingStaff.id), editingStaff);
      setEditingStaff(null);
      alert("Staff Member Updated! Tabdeeliyan save ho chuki hain.");
    } catch (err) {
      alert("Error updating staff: " + (err as Error).message);
      setStaffMembers(staffMembers);
    }
  };

  const stats = useMemo(() => {
    let totalSales = orders.reduce((acc, o) => acc + o.total, 0);
    const today = getBusinessDate(Date.now(), settings.businessDayStartTime);

    let todayOrders = orders.filter(o => getBusinessDate(o.timestamp, settings.businessDayStartTime) === today);
    let todaySales = todayOrders.reduce((acc, o) => acc + o.total, 0);

    const todayPurchases = purchases.filter(p => getBusinessDate(p.timestamp || p.date || Date.now(), settings.businessDayStartTime) === today);
    const todayExpense = todayPurchases.reduce((sum, p) => sum + p.cost, 0);

    const todayPaid = purchases.reduce((total, p) => {
      const historyPaid = (p.paymentHistory || []).filter(ph => getBusinessDate(ph.timestamp, settings.businessDayStartTime) === today).reduce((sum, ph) => sum + ph.amount, 0);
      const legacyPaid = (!p.paymentHistory && getBusinessDate(p.timestamp || p.date || Date.now(), settings.businessDayStartTime) === today) ? (p.paidAmount || 0) : 0;
      return total + historyPaid + legacyPaid;
    }, 0);

    const totalBaqi = purchases.reduce((sum, p) => sum + (p.remainingAmount || 0), 0);
    
    let totalDiscount = orders.reduce((acc, o) => acc + (o.discount || 0), 0);
    let todayDiscount = todayOrders.reduce((acc, o) => acc + (o.discount || 0), 0);

    // Apply stats adjustment if configured (for display only)
    if (settings.statsAdjustmentPercentage && settings.statsAdjustmentPercentage !== 100) {
      const factor = settings.statsAdjustmentPercentage / 100;
      totalSales *= factor;
      todaySales *= factor;
      totalDiscount *= factor;
      todayDiscount *= factor;
    }

    return {
      sales: totalSales,
      todaySales,
      todayExpense,
      todayPaid,
      todayBaqi: todayExpense - todayPaid,
      totalBaqi,
      totalDiscount,
      todayDiscount
    };
  }, [orders, purchases, settings.businessDayStartTime, settings.statsAdjustmentPercentage]);

  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => {
      if (crmSort === 'spending') return (b.totalSpent || 0) - (a.totalSpent || 0);
      if (crmSort === 'visit') return (b.lastVisit || 0) - (a.lastVisit || 0);
      return (b.balance || 0) - (a.balance || 0);
    });
  }, [customers, crmSort]);

  const handleSendBroadcast = (customer: Customer) => {
    let cleanPhone = customer.phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) { cleanPhone = (settings?.whatsappCountryCode || '92') + cleanPhone.substring(1); }
    else if (!cleanPhone.startsWith(settings?.whatsappCountryCode || '92')) { cleanPhone = (settings?.whatsappCountryCode || '92') + cleanPhone; }

    const personalizedMessage = `*${settings.businessName}*\n\nDear ${customer.name},\n\n${promoMessage}`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(personalizedMessage)}`, '_blank');

    const updatedMessaged = new Set(messagedIds);
    updatedMessaged.add(customer.id);
    setMessagedIds(updatedMessaged);
  };

  const handleBulkSendNext = () => {
    if (bulkIndex === null) return;
    const nextIdx = bulkIndex + 1;
    if (nextIdx < customers.length) {
      setBulkIndex(nextIdx);
      handleSendBroadcast(customers[nextIdx]);
    } else {
      setBulkIndex(null);
      alert("Mubarak ho! Tamam customers ko messages bhej diye gaye hain.");
    }
  };

  const startBulkSend = () => {
    if (customers.length === 0) return alert("Koi customer nahi mila!");
    if (!promoMessage.trim()) return alert("Pehly message type karein!");
    setBulkIndex(0);
    handleSendBroadcast(customers[0]);
  };

  const handleCopyAllNumbers = () => {
    const numbers = customers.map(c => {
      let p = c.phone.replace(/\D/g, '');
      if (p.startsWith('0')) p = (settings?.whatsappCountryCode || '92') + p.substring(1);
      return p;
    }).join(', ');

    navigator.clipboard.writeText(numbers);
    alert("Tamam numbers copy ho gaye hain! Ab WhatsApp mein Broadcast List banayen aur wahan paste karein.");
  };

  const handleShareOffer = (customer: Customer) => {
    let cleanPhone = customer.phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) { cleanPhone = (settings?.whatsappCountryCode || '92') + cleanPhone.substring(1); }
    else if (!cleanPhone.startsWith(settings?.whatsappCountryCode || '92')) { cleanPhone = (settings?.whatsappCountryCode || '92') + cleanPhone; }
    const text = `Hi ${customer.name}! *${settings.businessName}* has a special offer for you. Reply for more details!`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const [serverInfo, setServerInfo] = useState<{ localIP: string; port: number } | null>(null);

  React.useEffect(() => {
    let interval: any;
    if (adminTab === 'config') {
      const fetchInfo = () => {
        import('../utils/api').then(({ api }) => {
          api.getInfo().then(info => {
            if (info) {
              setServerInfo(info);
              if (interval) clearInterval(interval);
            }
          });
        });
      };
      
      fetchInfo();
      interval = setInterval(fetchInfo, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [adminTab]);

  return (
    <div className="space-y-3 animate-in fade-in pb-20">

      {/* PWA Prominent Banner */}
      {isInstallable && (
        <div className="mx-2 mb-2 p-6 bg-gradient-to-r from-orange-600 to-amber-600 rounded-[32px] shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-700 border-b-4 border-orange-800">
           <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center text-[10px]">{ICONS.Download}</div>
                <h3 className="text-white font-black uppercase italic tracking-tighter text-lg">Download App</h3>
              </div>
              <p className="text-white/80 text-[8px] font-black uppercase tracking-widest leading-tight">Install karein behtar speed aur offline kaam ke liye.</p>
           </div>
           <button 
             onClick={onInstall}
             className="px-5 py-3 bg-white text-orange-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2"
           >
             Install Now
           </button>
        </div>
      )}


      <div className="grid grid-cols-4 gap-1.5 px-1">
        {(activeShop || isCashier) && (
          <>
            <button
              onClick={() => handleTabChange('crm')}
              className={`bg-[var(--bg-card)] p-2 rounded-[24px] border border-[var(--border)] flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all gap-2 group ${adminTab === 'crm' ? 'border-blue-600' : ''}`}
            >
              <div className={`p-2 rounded-xl transition-all ${adminTab === 'crm' ? 'bg-blue-600 text-white' : 'bg-blue-600/10 text-blue-500'}`}>
                {ICONS.User}
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-main)]">Khata</span>
            </button>

            <button
              onClick={() => handleTabChange('purchases')}
              className={`bg-[var(--bg-card)] p-2 rounded-[24px] border border-[var(--border)] flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all gap-2 group ${adminTab === 'purchases' ? 'border-emerald-600' : ''}`}
            >
              <div className={`p-2 rounded-xl transition-all ${adminTab === 'purchases' ? 'bg-emerald-600 text-white' : 'bg-emerald-600/10 text-emerald-500'}`}>
                {ICONS.ShoppingBag}
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-main)]">Purchase</span>
            </button>

            {!isCashier && (
              <>
                <button
                  onClick={() => handleTabChange('monitor')}
                  className={`bg-[var(--bg-card)] p-2 rounded-[24px] border border-[var(--border)] flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all gap-2 group ${adminTab === 'monitor' ? 'border-orange-600' : ''}`}
                >
                  <div className={`p-2 rounded-xl transition-all ${adminTab === 'monitor' ? 'bg-orange-600 text-white' : 'bg-orange-600/10 text-orange-600'}`}>
                    {ICONS.Dashboard}
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-main)]">Home</span>
                </button>

                <button
                  onClick={() => handleTabChange('takers')}
                  className={`bg-[var(--bg-card)] p-2 rounded-[24px] border border-[var(--border)] flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all gap-2 group ${adminTab === 'takers' ? 'border-purple-600' : ''}`}
                >
                  <div className={`p-2 rounded-xl transition-all ${adminTab === 'takers' ? 'bg-purple-600 text-white' : 'bg-purple-600/10 text-purple-500'}`}>
                    {ICONS.Users}
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-main)]">Staff</span>
                </button>
              </>
            )}

            <button
              onClick={() => handleTabChange('suppliers')}
              className={`bg-[var(--bg-card)] p-2 rounded-[24px] border border-[var(--border)] flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all gap-2 group ${adminTab === 'suppliers' ? 'border-teal-600' : ''}`}
            >
              <div className={`p-2 rounded-xl transition-all ${adminTab === 'suppliers' ? 'bg-teal-600 text-white' : 'bg-teal-600/10 text-teal-500'}`}>
                {ICONS.Truck}
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-main)]">Vendor</span>
            </button>

            <button
              onClick={() => handleTabChange('config')}
              className={`bg-[var(--bg-card)] p-2 rounded-[24px] border border-[var(--border)] flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all gap-2 group ${adminTab === 'config' ? 'border-orange-600' : ''}`}
            >
              <div className={`p-2 rounded-xl transition-all ${adminTab === 'config' ? 'bg-orange-600 text-white' : 'bg-orange-600/10 text-orange-600'}`}>
                {ICONS.Settings}
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-main)]">Config</span>
            </button>



            <button
              onClick={() => handleTabChange('settlement')}
              className={`bg-[var(--bg-card)] p-2 rounded-[24px] border border-[var(--border)] flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all gap-2 group ${adminTab === 'settlement' ? 'border-amber-500' : ''} ${orders.some(o => o.status === 'served') ? 'animate-pulse' : ''}`}
            >
              <div className={`p-2 rounded-xl transition-all ${adminTab === 'settlement' ? 'bg-amber-600 text-white' : 'bg-amber-600/10 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]'}`}>
                {ICONS.CreditCard}
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-main)]">Payments</span>
            </button>

            {!isCashier && (
              <>
                <button
                  onClick={onNavigateToMenu}
                  className="bg-[var(--bg-card)] p-2 rounded-[24px] border border-[var(--border)] flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all gap-2 group"
                >
                  <div className="p-2 rounded-xl transition-all bg-amber-600/10 text-amber-600 group-hover:bg-amber-600 group-hover:text-white">
                    {ICONS.Utensils}
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-main)]">Menu</span>
                </button>
              </>
            )}
          </>
        )}

        {isAdmin && (
          <>
            <button
              onClick={() => {
                handleTabChange('registry');
                handleOwnerClick();
              }}
              className={`bg-[var(--bg-card)] p-2 rounded-[24px] border border-[var(--border)] flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all gap-2 group ${adminTab === 'registry' ? 'border-pink-600' : ''}`}
            >
              <div className={`p-2 rounded-xl transition-all ${adminTab === 'registry' ? 'bg-pink-600 text-white' : 'bg-pink-600/10 text-pink-500'}`}>
                {ICONS.Shield}
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-main)]">Security</span>
            </button>

            <button
              onClick={() => handleTabChange('config')}
              className={`bg-[var(--bg-card)] p-2 rounded-[24px] border border-[var(--border)] flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all gap-2 group ${adminTab === 'config' ? 'border-cyan-600' : ''}`}
            >
              <div className={`p-2 rounded-xl transition-all ${adminTab === 'config' ? 'bg-cyan-600 text-white' : 'bg-cyan-600/10 text-cyan-500'}`}>
                {ICONS.Settings}
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-main)]">App Config</span>
            </button>
          </>
        )}
      </div>

      {adminTab === 'purchases' && (
        <div className="space-y-3 animate-in slide-in-from-right px-1">
          {/* Daily Stats */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-[var(--bg-card)] p-1.5 rounded-[18px] border border-[var(--border)] shadow-lg">
              <p className="text-[7px] font-black uppercase text-[var(--text-muted)] tracking-widest">Expense</p>
              <p className="text-sm font-black text-white mt-1">
                {amt(purchases.filter(p => new Date(p.timestamp || p.date || Date.now()).toDateString() === new Date().toDateString()).reduce((sum, p) => sum + p.cost, 0))}
              </p>
            </div>
            <div className="bg-[var(--bg-card)] p-2 rounded-[24px] border border-[var(--border)] shadow-lg">
              <p className="text-[7px] font-black uppercase text-[var(--text-muted)] tracking-widest">Paid</p>
              <p className="text-sm font-black text-emerald-500 mt-1">
                {amt(purchases.reduce((total, p) => {
                  const historyPaid = (p.paymentHistory || []).filter(ph => new Date(ph.timestamp).toDateString() === new Date().toDateString()).reduce((sum, ph) => sum + ph.amount, 0);
                  const legacyPaid = (!p.paymentHistory && new Date(p.timestamp || p.date || Date.now()).toDateString() === new Date().toDateString()) ? (p.paidAmount || 0) : 0;
                  return total + historyPaid + legacyPaid;
                }, 0))}
              </p>
            </div>
            <div className="bg-[var(--bg-card)] p-2 rounded-[24px] border border-[var(--border)] shadow-lg">
              <p className="text-[7px] font-black uppercase text-[var(--text-muted)] tracking-widest">Baqi</p>
              <p className="text-sm font-black text-rose-500 mt-1">
                {amt(purchases.filter(p => new Date(p.timestamp || p.date || Date.now()).toDateString() === new Date().toDateString()).reduce((sum, p) => sum + p.cost, 0) - purchases.reduce((total, p) => {
                  const historyPaid = (p.paymentHistory || []).filter(ph => new Date(ph.timestamp).toDateString() === new Date().toDateString()).reduce((sum, ph) => sum + ph.amount, 0);
                  const legacyPaid = (!p.paymentHistory && new Date(p.timestamp || p.date || Date.now()).toDateString() === new Date().toDateString()) ? (p.paidAmount || 0) : 0;
                  return total + historyPaid + legacyPaid;
                }, 0))}
              </p>
            </div>
          </div>

          {/* Quick Add Buttons */}
          <div className="space-y-2">
            <div className="flex justify-between items-center px-2">
              <p className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-widest">Quick Add</p>
              <button
                onClick={() => setIsManagingQuickItems(!isManagingQuickItems)}
                className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all ${isManagingQuickItems ? 'bg-orange-600 text-white' : 'text-orange-600 bg-orange-600/10'}`}
              >
                {isManagingQuickItems ? 'Done' : 'Edit List'}
              </button>
            </div>

            {isManagingQuickItems && (
              <form onSubmit={handleAddQuickItem} className="flex gap-2 px-1 mb-2">
                <input
                  type="text"
                  value={newQuickItem}
                  onChange={(e) => setNewQuickItem(e.target.value)}
                  placeholder="New Item Name..."
                  className="flex-1 bg-black border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-emerald-500 uppercase"
                />
                <button type="submit" className="bg-emerald-600 text-white px-3 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95">Add</button>
              </form>
            )}

            <div className="flex flex-wrap gap-1.5">
              {quickItems.map(item => (
                <div key={item} className="relative group">
                  <button
                    onClick={() => handleQuickAdd(item)}
                    disabled={isManagingQuickItems}
                    className={`px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[9px] font-black uppercase text-white transition-all ${isManagingQuickItems ? 'opacity-50 cursor-default' : 'active:scale-95 hover:bg-white/5 hover:border-emerald-500/30'}`}
                  >
                    + {item}
                  </button>
                  {isManagingQuickItems && (
                    <button
                      onClick={() => handleRemoveQuickItem(item)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 z-10 border-2 border-[var(--bg-card)]"
                    >
                      {ICONS.X}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center px-2 pt-2">
            <h3 className="font-black text-emerald-500 uppercase italic text-xl">History</h3>
            <button
              onClick={() => {
                setEditingPurchaseId(null);
                setPItemName('');
                setPQty('');
                setPCost('');
                setPPaidAmount('');
                setPSupplier('');
                setShowAddPurchaseModal(true);
              }}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
            >
              + Custom
            </button>
          </div>

          <div className="space-y-3">
            {purchases.length === 0 ? (
              <div className="p-20 text-center border-2 border-dashed border-[var(--border)] rounded-[40px] text-[var(--text-muted)] font-black uppercase text-[10px]">No Purchases Recorded</div>
            ) : purchases.map(p => {
              const total = p.cost;
              const remaining = total - (p.paidAmount || 0);

              return (
                <div key={p.id} className="bg-[var(--bg-card)] p-3 rounded-[32px] border border-[var(--border)] flex flex-col shadow-md group active:scale-[0.99] transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-sm uppercase text-white truncate italic tracking-tight">{p.itemName}</p>
                      <p className="text-[10px] font-black text-[var(--text-muted)] mt-0.5">{new Date(p.timestamp).toLocaleDateString()} • {p.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-white">{amt(total)}</p>
                      <p className={`text-[7px] font-black uppercase tracking-widest ${remaining > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {remaining > 0 ? `BAQI: ${amt(remaining)}` : 'PAID'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest">Qty</p>
                        <p className="text-[10px] font-black text-white">{p.quantity}</p>
                      </div>
                      <div>
                        <p className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest">Paid</p>
                        <p className="text-[10px] font-black text-emerald-500">{amt(p.paidAmount || 0)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditPurchase(p)}
                        className="p-2 bg-blue-500/10 text-blue-500 rounded-lg active:scale-90 transition-all"
                      >
                        {ICONS.Settings}
                      </button>
                      <button
                        onClick={() => { if (confirm('Delete this entry?')) onDeletePurchase(p.id); }}
                        className="p-2 bg-red-500/10 text-red-500 rounded-lg active:scale-90 transition-all"
                      >
                        {ICONS.Trash2}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {showAddPurchaseModal && (
            <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[3000] flex items-center justify-center p-6 animate-in zoom-in">
              <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 w-full max-w-sm p-8 space-y-6 shadow-2xl">
                <div className="text-center">
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white leading-none">{editingPurchaseId ? 'Edit' : 'Add'} <span className="text-emerald-500">Purchase</span></h3>
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase mt-2">{editingPurchaseId ? 'Update existing entry' : 'Record new expense'}</p>
                </div>

                <form onSubmit={handleAddPurchaseSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-500 uppercase ml-4">Item Name</label>
                    <input type="text" className="w-full p-4 bg-black border border-white/5 rounded-[24px] text-white font-black outline-none focus:border-emerald-600 uppercase text-xs" value={pItemName} onChange={e => setPItemName(e.target.value)} placeholder="e.g. Chicken, Oil" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-gray-500 uppercase ml-4">Cost (Per Unit)</label>
                      <input type="number" className="w-full p-4 bg-black border border-white/5 rounded-[24px] text-white font-black outline-none focus:border-emerald-600 text-xs" value={pCost} onChange={e => setPCost(e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-gray-500 uppercase ml-4">Quantity</label>
                      <input type="number" className="w-full p-4 bg-black border border-white/5 rounded-[24px] text-white font-black outline-none focus:border-emerald-600 text-xs" value={pQty} onChange={e => setPQty(e.target.value)} placeholder="1" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-500 uppercase ml-4">Paid Amount (Optional)</label>
                    <input type="number" className="w-full p-4 bg-black border border-white/5 rounded-[24px] text-emerald-500 font-black outline-none focus:border-emerald-600 text-xs" value={pPaidAmount} onChange={e => setPPaidAmount(e.target.value)} placeholder="Leave empty if full udhaar" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-500 uppercase ml-4">Supplier (Optional)</label>
                    <select className="w-full p-4 bg-black border border-white/5 rounded-[24px] text-white font-black outline-none focus:border-emerald-600 text-xs appearance-none" value={pSupplier} onChange={e => setPSupplier(e.target.value)}>
                      <option value="">Select Supplier</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowAddPurchaseModal(false)} className="flex-1 py-4 bg-white/5 text-[var(--text-muted)] rounded-[24px] font-black uppercase text-[10px]">Cancel</button>
                    <button type="submit" className="flex-[2] py-4 bg-emerald-600 text-white rounded-[24px] font-black uppercase text-[10px] shadow-xl">{editingPurchaseId ? 'Update' : 'Save'} Entry</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {adminTab === 'monitor' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-2 gap-3 px-1">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-[var(--bg-card)] p-4 rounded-[32px] border border-[var(--border)] shadow-xl space-y-1"
            >
              <p className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-widest">Today Sales</p>
              <p className="text-lg font-black text-emerald-500 tracking-tight">
                {amt(stats.todaySales, '', true)}
              </p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-[var(--bg-card)] p-4 rounded-[32px] border border-[var(--border)] shadow-xl space-y-1"
            >
              <p className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-widest">Total Sales</p>
              <p className="text-lg font-black text-white tracking-tight">
                {amt(stats.sales, '', true)}
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-3 gap-2 px-1">
            <div className="bg-[var(--bg-card)] p-3 rounded-[24px] border border-[var(--border)] shadow-lg text-center">
              <p className="text-[7px] font-black uppercase text-[var(--text-muted)] tracking-widest">Today Exp</p>
              <p className="text-xs font-black text-white mt-1">{amt(stats.todayExpense, '', true)}</p>
            </div>
            <div className="bg-[var(--bg-card)] p-3 rounded-[24px] border border-[var(--border)] shadow-lg text-center">
              <p className="text-[7px] font-black uppercase text-[var(--text-muted)] tracking-widest">Today Discount</p>
              <p className="text-xs font-black text-orange-500 mt-1">{amt(stats.todayDiscount, '', true)}</p>
            </div>
            <div className="bg-[var(--bg-card)] p-3 rounded-[24px] border border-[var(--border)] shadow-lg text-center">
              <p className="text-[7px] font-black uppercase text-[var(--text-muted)] tracking-widest">Total Discount</p>
              <p className="text-xs font-black text-orange-600 mt-1">{amt(stats.totalDiscount, '', true)}</p>
            </div>
          </div>

          <div className="px-1">
            <div className="bg-rose-600/10 border border-rose-600/20 p-4 rounded-[32px] flex justify-between items-center">
              <div>
                <p className="text-[8px] font-black uppercase text-rose-500 tracking-widest">Total Market Udhaar (Purchases)</p>
                <p className="text-xl font-black text-rose-600 tracking-tighter">Rs.{stats.totalBaqi.toLocaleString()}</p>
              </div>
              <button onClick={() => handleTabChange('purchases')} className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg active:scale-90 transition-all">
                {ICONS.ChevronRight}
              </button>
            </div>
          </div>



        </motion.div>
      )}

      {adminTab === 'crm' && (
        <div className="space-y-4 animate-in slide-in-from-right duration-500 px-1">
          {crmView === 'list' ? (
            <>
              <div className="flex justify-between items-center px-2">
                <h3 className="font-black text-orange-600 uppercase italic text-xl">Customer <span className="text-white">Khata</span></h3>
                <button
                  onClick={() => setCrmView('broadcast')}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center gap-2"
                >
                  {ICONS.Send} Bulk Message
                </button>
              </div>

              <div className="flex p-1 bg-black/40 rounded-2xl border border-white/5">
                <button onClick={() => setCrmSort('balance')} className={`flex-1 py-2 text-[8px] font-black rounded-xl transition-all ${crmSort === 'balance' ? 'bg-orange-600 text-white shadow-lg' : 'text-[var(--text-muted)]'}`}>BALANCE</button>
                <button onClick={() => setCrmSort('spending')} className={`flex-1 py-2 text-[8px] font-black rounded-xl transition-all ${crmSort === 'spending' ? 'bg-orange-600 text-white shadow-lg' : 'text-[var(--text-muted)]'}`}>TOP SPENT</button>
                <button onClick={() => setCrmSort('visit')} className={`flex-1 py-2 text-[8px] font-black rounded-xl transition-all ${crmSort === 'visit' ? 'bg-orange-600 text-white shadow-lg' : 'text-[var(--text-muted)]'}`}>RECENT</button>
              </div>

              <div className="space-y-3">
                {sortedCustomers.length === 0 ? (
                  <div className="p-20 text-center border-2 border-dashed border-[var(--border)] rounded-[40px] text-[var(--text-muted)] font-black uppercase text-[10px]">No Customers Yet</div>
                ) : sortedCustomers.map(cust => (
                  <div key={cust.id} className="bg-[var(--bg-card)] p-3 rounded-[32px] border border-[var(--border)] flex flex-col shadow-md group active:scale-[0.99] transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-sm uppercase text-white truncate italic tracking-tight">{cust.name}</p>
                          {cust.tableNumber && (
                            <span className="px-2 py-0.5 bg-orange-600/20 text-orange-500 text-[8px] font-black rounded-lg uppercase tracking-widest italic">T-{cust.tableNumber}</span>
                          )}
                        </div>
                        <p className="text-[10px] font-black text-orange-600/60 mt-0.5">{cust.phone}</p>
                        {cust.whatsappNumber && (
                          <p className="text-[8px] font-black text-emerald-500/60 uppercase tracking-widest">WhatsApp: {cust.whatsappNumber}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-black ${cust.balance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>Rs.{cust.balance || 0}</p>
                        <p className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest">{cust.balance > 0 ? 'LENAY HAIN' : 'ACCOUNT CLEAR'}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <div className="flex gap-4">
                        <div>
                          <p className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest">Total Spent</p>
                          <p className="text-[10px] font-black text-white">Rs.{(cust.totalSpent || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest">Last Visit</p>
                          <p className="text-[10px] font-black text-white">{cust.lastVisit ? new Date(cust.lastVisit).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCustomerHistoryModal(cust)} className="p-3 bg-white/5 text-blue-500 rounded-xl border border-white/5 active:scale-90 transition-all">{ICONS.History}</button>
                        <button onClick={() => handleShareOffer(cust)} className="p-3 bg-white/5 text-orange-600 rounded-xl border border-white/5 active:scale-90 transition-all">{ICONS.Send}</button>
                        {cust.balance > 0 && (
                          <button onClick={() => setShowCustomerPayModal(cust)} className="p-3 bg-emerald-600 text-white rounded-xl active:scale-90 transition-all shadow-lg">{ICONS.Plus}</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4 animate-in slide-in-from-right">
              <div className="flex justify-between items-center px-2">
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-emerald-500">Marketing <span className="text-white">Center</span></h3>
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Send Deals to {customers.length} Customers</p>
                </div>
                <button onClick={() => setCrmView('list')} className="p-3 rounded-2xl bg-white/5 text-white active:scale-90 transition-all text-[10px] font-black uppercase">Back to List</button>
              </div>

              <div className="p-3 bg-black/40 border border-white/5 rounded-[24px] space-y-2">
                <div className="flex justify-between items-center px-2">
                  <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Broadcast Message (Deal Text)</label>
                  <button
                    onClick={() => setPromoMessage('')}
                    className="text-[8px] font-black text-red-500 uppercase tracking-widest"
                  >
                    Clear Text
                  </button>
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  {QUICK_TEMPLATES.map(t => (
                    <button
                      key={t.label}
                      onClick={() => setPromoMessage(t.text)}
                      className="px-4 py-2 bg-emerald-600/10 border border-emerald-600/20 rounded-xl text-[8px] font-black text-emerald-500 uppercase whitespace-nowrap active:scale-95 transition-all"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <textarea
                  className="w-full p-4 bg-black border border-white/10 rounded-[24px] text-white text-xs font-medium outline-none focus:border-emerald-500 h-32 resize-none"
                  placeholder="Type your promotional message here..."
                  value={promoMessage}
                  onChange={e => setPromoMessage(e.target.value)}
                />

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest px-2">Attach Image (Optional)</label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 h-24 bg-black border border-dashed border-white/20 rounded-[24px] flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 transition-all group">
                      <input type="file" accept="image/*" onChange={handlePromoImageUpload} className="hidden" />
                      <div className="p-2 bg-white/5 rounded-full mb-2 group-hover:bg-emerald-500/20 transition-all">{ICONS.Image}</div>
                      <span className="text-[8px] font-black uppercase text-[var(--text-muted)]">Upload Photo</span>
                    </label>
                    {promoImage && (
                      <div className="relative h-24 w-24 rounded-[24px] overflow-hidden border border-white/10 group">
                        <img src={promoImage} alt="Promo" className="h-full w-full object-cover" />
                        <button onClick={() => setPromoImage(null)} className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all">{ICONS.X}</button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-black text-white uppercase">Recipients: <span className="text-emerald-500">{customers.length} Customers</span></p>
                    {bulkIndex !== null && (
                      <p className="text-[10px] font-black text-orange-500 uppercase animate-pulse">Sending... {bulkIndex + 1}/{customers.length}</p>
                    )}
                  </div>

                  <button
                    onClick={bulkIndex !== null ? handleBulkSendNext : startBulkSend}
                    disabled={!promoMessage}
                    className={`w-full py-4 rounded-[24px] font-black uppercase text-[12px] tracking-widest shadow-xl flex items-center justify-center gap-2 ${bulkIndex !== null ? 'bg-orange-600 text-white' : 'bg-emerald-600 text-white active:scale-95 hover:bg-emerald-500'} transition-all disabled:opacity-50 disabled:scale-100`}
                  >
                    {bulkIndex !== null ? (
                      <>{ICONS.Send} Send to Next ({bulkIndex + 2}/{customers.length})</>
                    ) : (
                      <>{ICONS.Send} Start Broadcast</>
                    )}
                  </button>
                  <p className="text-[8px] font-black text-[var(--text-muted)] text-center mt-3 uppercase tracking-widest">
                    Note: This will open WhatsApp for each customer one by one.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}



      {isAdmin && adminTab === 'identity' && (
        <div className="space-y-3 animate-in zoom-in px-1">
          <div className="bg-[var(--bg-card)] p-3 rounded-[24px] border border-[var(--border)] shadow-xl space-y-3">
            <p className="text-[10px] font-black uppercase text-orange-600 tracking-[0.2em] ml-2">Shop Details</p>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--text-muted)] uppercase ml-4">Display Name</label>
              <input
                type="text"
                className="w-full p-4 bg-black/40 border border-[var(--border)] rounded-[24px] text-white font-black uppercase outline-none focus:border-orange-600 transition-all text-sm"
                value={isAdmin ? settings.businessName : activeShop?.shopName || ''}
                onChange={e => {
                  if (isAdmin) {
                    setSettings({ ...settings, businessName: e.target.value });
                  } else if (activeShop) {
                    onUpdateShop({ ...activeShop, shopName: e.target.value });
                  }
                }}
              />
              <p className="text-[7px] font-black text-orange-600/50 uppercase ml-4">This name appears on bills and header.</p>
            </div>
          </div>
        </div>
      )}

      {(isAdmin || activeShop) && adminTab === 'takers' && (
        <div className="space-y-3 animate-in slide-in-from-right px-1">
          <div className="bg-[var(--bg-card)] p-3 rounded-[24px] border border-orange-600/10 space-y-2 shadow-lg">
            <h4 className="text-[11px] font-black uppercase text-orange-600 tracking-[0.2em] px-2 italic">Staff <span className="text-white">Management</span></h4>

            <form onSubmit={handleAddStaff} className="space-y-3 bg-black/20 p-4 rounded-3xl border border-white/5">
              <p className="text-[8px] font-black uppercase text-gray-500 ml-2">Add New Staff Member</p>
              <input type="text" placeholder="FULL NAME" className="w-full p-4 bg-[var(--bg-main)] rounded-xl border border-[var(--border)] font-black text-xs outline-none focus:border-orange-600 uppercase" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="LOGIN ID" className="w-full p-4 bg-[var(--bg-main)] rounded-xl border border-[var(--border)] font-black text-xs outline-none focus:border-orange-600 uppercase" value={newStaffId} onChange={e => setNewStaffId(e.target.value)} />
                <input type="password" placeholder="PASSWORD" className="w-full p-4 bg-[var(--bg-main)] rounded-xl border border-[var(--border)] font-black text-xs outline-none focus:border-orange-600" value={newStaffPassword} onChange={e => setNewStaffPassword(e.target.value)} />
              </div>
              <div className="flex gap-2 p-1 bg-black/20 rounded-xl">
                <button type="button" onClick={() => setNewStaffRole('taker')} className={`flex-1 py-2 text-[8px] font-black rounded-lg transition-all ${newStaffRole === 'taker' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-500'}`}>TAKER</button>
                <button type="button" onClick={() => setNewStaffRole('kitchen')} className={`flex-1 py-2 text-[8px] font-black rounded-lg transition-all ${newStaffRole === 'kitchen' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-500'}`}>KITCHEN</button>
                <button type="button" onClick={() => setNewStaffRole('cashier')} className={`flex-1 py-2 text-[8px] font-black rounded-lg transition-all ${newStaffRole === 'cashier' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-500'}`}>CASHIER</button>
              </div>
              <button type="submit" className="w-full py-4 bg-orange-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">ADD STAFF MEMBER</button>
            </form>
          </div>

          {menuRequests.filter(r => r.status === 'pending').length > 0 && (
            <div className="space-y-3 mb-8">
              <p className="text-[9px] font-black uppercase text-orange-600 ml-4 tracking-widest italic">Pending Menu Requests</p>
              <div className="grid grid-cols-1 gap-3">
                {menuRequests.filter(r => r.status === 'pending').map(req => (
                  <div key={req.id} className="bg-orange-600/5 p-4 rounded-[24px] border border-orange-600/20 flex items-center justify-between">
                    <div>
                      <p className="font-black text-[var(--text-main)] text-sm leading-none italic uppercase">Customer Request</p>
                      <p className="text-[9px] text-[var(--text-muted)] font-bold mt-1 uppercase italic">{new Date(req.timestamp).toLocaleTimeString()}</p>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => onUpdateMenuRequest?.(req.id, 'denied')} className="p-3 bg-red-500/10 text-red-500 rounded-xl active:scale-90">{ICONS.X}</button>
                       <button onClick={() => onUpdateMenuRequest?.(req.id, 'approved')} className="p-3 bg-emerald-500 text-white rounded-xl active:scale-95 shadow-md shadow-emerald-500/20">{ICONS.Check}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-[9px] font-black uppercase text-[var(--text-muted)] ml-4 tracking-widest italic">Active Staff</p>
            {staffMembers.map(staff => {
              const staffOrders = orders.filter(o => o.orderTakerId === staff.id);
              const staffSales = staffOrders.reduce((sum, o) => sum + o.total, 0);

              return (
                <div key={staff.id} className="bg-[var(--bg-card)] p-5 rounded-[24px] border border-[var(--border)] flex flex-col shadow-md group gap-4">
                  <div className="flex justify-between items-center">
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-sm uppercase text-[var(--text-main)] truncate italic">{staff.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[7px] font-black text-white uppercase tracking-widest ${staff.role === 'kitchen' ? 'bg-amber-600' : staff.role === 'cashier' ? 'bg-emerald-600' : 'bg-blue-600'}`}>{staff.role}</span>
                      </div>
                      <p className="text-[9px] text-[var(--text-muted)] font-black uppercase">ID: <span className="text-orange-600">{staff.id}</span> • PASS: <span className="text-white">{staff.password}</span></p>
                    </div>
                     <div className="flex gap-2">
                       <button 
                        onClick={() => setViewingStaffHistory(staff)} 
                        className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl active:scale-90 transition-all border border-emerald-500/20"
                        title="View Sales History"
                      >
                        {ICONS.ShoppingBag}
                      </button>
                      <button onClick={() => setEditingStaff(staff)} className="p-3 bg-white/5 text-blue-500 rounded-xl active:scale-90 transition-all border border-white/5">{ICONS.Settings}</button>
                      <button onClick={async () => { 
                        if (confirm(`Delete ${staff.name}?`)) {
                          try {
                            // Optimistic delete
                            const updatedStaff = staffMembers.filter(s => s.id !== staff.id);
                            setStaffMembers(updatedStaff);
                            await deleteDoc(doc(db, "staffMembers", staff.id));
                            alert("Staff Member Removed!");
                          } catch(e) { 
                            alert("Delete failed: " + (e as Error).message);
                            // Rollback
                            setStaffMembers(staffMembers);
                          }
                        }
                      }} className="p-3 bg-red-500/10 text-red-500 rounded-xl active:scale-90">{ICONS.Trash2}</button>
                    </div>
                  </div>

                  {staff.role === 'taker' && (
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
                      <div className="bg-black/20 p-3 rounded-2xl text-center">
                        <p className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest">Orders</p>
                        <p className="text-sm font-black text-white">{staffOrders.length}</p>
                      </div>
                      <div className="bg-black/20 p-3 rounded-2xl text-center">
                        <p className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest">Total Sales</p>
                        <p className="text-sm font-black text-emerald-500">{amt(staffSales)}</p>
                      </div>
                    </div>
                  )}

                  {staff.role === 'cashier' && (
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
                      <div className="bg-black/20 p-3 rounded-2xl text-center">
                        <p className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest">Settled Bills</p>
                        <p className="text-sm font-black text-white">{orders.filter(o => o.cashierId === staff.id).length}</p>
                      </div>
                      <div className="bg-black/20 p-3 rounded-2xl text-center">
                        <p className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest">Amount Collected</p>
                        <p className="text-sm font-black text-emerald-500">{amt(orders.filter(o => o.cashierId === staff.id).reduce((sum, o) => sum + o.total, 0))}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {editingStaff && (
            <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[3000] flex items-center justify-center p-6 animate-in zoom-in">
              <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 w-full max-w-sm p-10 space-y-8 shadow-2xl">
                <div className="text-center">
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white leading-none">Edit <span className="text-orange-600">Staff</span></h3>
                  <p className="text-[10px] font-black text-orange-600 uppercase mt-2">Managing ID: {editingStaff.id}</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-500 uppercase ml-4">Full Name</label>
                    <input type="text" className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-white font-black text-center outline-none focus:border-orange-600 uppercase text-xs" value={editingStaff.name} onChange={e => setEditingStaff({ ...editingStaff, name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-500 uppercase ml-4">Login Password</label>
                    <input type="text" className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-orange-600 font-black text-center outline-none focus:border-orange-600 text-sm" value={editingStaff.password} onChange={e => setEditingStaff({ ...editingStaff, password: e.target.value })} />
                  </div>
                  <div className="flex gap-2 p-1 bg-black/20 rounded-xl">
                    <button type="button" onClick={() => setEditingStaff({ ...editingStaff, role: 'taker' })} className={`flex-1 py-2 text-[8px] font-black rounded-lg transition-all ${editingStaff.role === 'taker' ? 'bg-orange-600 text-white' : 'text-gray-500'}`}>TAKER</button>
                    <button type="button" onClick={() => setEditingStaff({ ...editingStaff, role: 'kitchen' })} className={`flex-1 py-2 text-[8px] font-black rounded-lg transition-all ${editingStaff.role === 'kitchen' ? 'bg-orange-600 text-white' : 'text-gray-500'}`}>KITCHEN</button>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setEditingStaff(null)} className="flex-1 font-black text-[var(--text-muted)] uppercase text-[10px]">Cancel</button>
                  <button onClick={handleUpdateStaff} className="flex-[2] py-4 bg-orange-600 text-white rounded-[24px] font-black uppercase text-[10px] shadow-xl">SAVE CHANGES</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {adminTab === 'suppliers' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6 px-1"
        >
          <div className="bg-[var(--bg-card)] rounded-[40px] border border-[var(--border)] p-8 space-y-6 shadow-xl">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">Manage <span className="text-orange-600">Suppliers</span></h3>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Add and manage your vendors</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-2">Supplier Name</label>
                <input
                  type="text" placeholder="e.g., Al-Makkah Meat, Sabzi Mandi"
                  className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-white font-black outline-none focus:border-orange-600"
                  value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-2">Category</label>
                <select
                  className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-white font-black outline-none focus:border-orange-600 appearance-none"
                  value={newSupplierCategory} onChange={e => setNewSupplierCategory(e.target.value)}
                >
                  <option value="General">General</option>
                  <option value="Meat">Meat</option>
                  <option value="Vegetables">Vegetables</option>
                  <option value="Dairy">Dairy</option>
                  <option value="Packaging">Packaging</option>
                </select>
              </div>
              <button
                onClick={handleAddSupplier}
                className="w-full py-5 bg-emerald-600 text-white rounded-[28px] font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all"
              >
                Add Supplier
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Supplier List</h4>
            <div className="space-y-3">
              {suppliers.map(s => (
                <div key={s.id} className="bg-[var(--bg-card)] p-5 rounded-[32px] border border-[var(--border)] flex justify-between items-center group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-600/10 text-emerald-600 rounded-2xl flex items-center justify-center">
                      {ICONS.User}
                    </div>
                    <div>
                      <p className="text-sm font-black text-white uppercase italic">{s.name}</p>
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{s.categoryId}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteSupplier(s.id)}
                    className="p-3 bg-rose-600/10 text-rose-500 rounded-xl border border-rose-600/20 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                  >
                    {ICONS.Trash2}
                  </button>
                </div>
              ))}
              {suppliers.length === 0 && (
                <div className="p-10 text-center border-2 border-dashed border-[var(--border)] rounded-[40px] text-[var(--text-muted)] font-black uppercase text-[10px]">No Suppliers Added</div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {isAdmin && adminTab === 'registry' && (
        <div className="space-y-6 animate-in slide-in-from-right px-1">
          <div className="bg-[var(--bg-card)] p-6 rounded-[32px] border border-orange-600/10 space-y-4 shadow-lg">
            <h4 className="text-[11px] font-black uppercase text-orange-600 tracking-[0.2em] px-2 italic">Shop Registry <span className="text-white">Manager</span></h4>

            <form onSubmit={handleAddShop} className="space-y-3 bg-black/20 p-4 rounded-3xl border border-white/5">
              <p className="text-[8px] font-black uppercase text-gray-500 ml-2">Add New Owner Account</p>
              <input type="text" placeholder="SHOP NAME" className="w-full p-4 bg-[var(--bg-main)] rounded-xl border border-[var(--border)] font-black text-xs outline-none focus:border-orange-600 uppercase" value={newShopName} onChange={e => setNewShopName(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="LOGIN ID" className="w-full p-4 bg-[var(--bg-main)] rounded-xl border border-[var(--border)] font-black text-xs outline-none focus:border-orange-600 uppercase" value={newShopId} onChange={e => setNewShopId(e.target.value)} />
                <input type="password" placeholder="PASSWORD" className="w-full p-4 bg-[var(--bg-main)] rounded-xl border border-[var(--border)] font-black text-xs outline-none focus:border-orange-600" value={newShopPass} onChange={e => setNewShopPass(e.target.value)} />
              </div>
              <button type="submit" className="w-full py-4 bg-orange-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">REGISTER ACCOUNT</button>
            </form>
          </div>

          <div className="space-y-3">
            <p className="text-[9px] font-black uppercase text-[var(--text-muted)] ml-4 tracking-widest italic">Existing Accounts</p>
            {(settings.shopAccounts || []).map(acc => (
              <div key={acc.id} className="bg-[var(--bg-card)] p-5 rounded-[24px] border border-[var(--border)] flex justify-between items-center shadow-md group">
                <div className="min-w-0 flex-1 mr-3">
                  <p className="font-black text-sm uppercase text-[var(--text-main)] truncate italic">{acc.shopName}</p>
                  <p className="text-[9px] text-[var(--text-muted)] font-black uppercase">ID: <span className="text-orange-600">{acc.id}</span> • PASS: <span className="text-white">****</span></p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingShop(acc)} className="p-3 bg-white/5 text-blue-500 rounded-xl active:scale-90 transition-all border border-white/5">{ICONS.Settings}</button>
                  <button onClick={() => { if (confirm(`Delete ${acc.shopName}?`)) setSettings({ ...settings, shopAccounts: (settings.shopAccounts || []).filter(a => a.id !== acc.id) }); }} className="p-3 bg-red-500/10 text-red-500 rounded-xl active:scale-90">{ICONS.Trash2}</button>
                  <button onClick={() => { const updated: ShopAccount[] = (settings.shopAccounts || []).map(a => a.id === acc.id ? { ...a, subscriptionStatus: (a.subscriptionStatus === 'active' ? 'expired' : 'active') as 'active' | 'expired' | 'pending' } : a); setSettings({ ...settings, shopAccounts: updated }); }} className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${acc.subscriptionStatus === 'active' ? 'bg-green-600/10 text-green-500' : 'bg-red-600/10 text-red-500'}`}>{acc.subscriptionStatus}</button>
                </div>
              </div>
            ))}
          </div>

          {showSecretSlider && (
            <div className="bg-rose-950/30 p-6 rounded-[40px] border border-rose-600/20 shadow-2xl space-y-4 animate-in slide-in-from-bottom">
              <div className="flex items-center gap-2 ml-2 mb-2">
                <span className="text-rose-500">{ICONS.Trash2}</span>
                <p className="text-[10px] font-black uppercase text-rose-500 tracking-[0.2em]">Danger Zone (Reset & Maintenance)</p>
              </div>

              <button
                onClick={() => triggerConfirm({
                  title: "Reset All Orders?",
                  message: "Kya aap waqai tamam orders ko permanently delete karna chahte hain? Yeh amal wapasi ke qabil nahi hai.",
                  type: 'danger',
                  onConfirm: onResetHistory
                })}
                className="w-full p-5 bg-orange-600/10 text-orange-500 border border-orange-600/20 rounded-[32px] text-[10px] font-black uppercase tracking-[0.2em] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {ICONS.Trash2} RESET ALL ORDERS
              </button>

              <button
                onClick={() => onResetData()}
                className="w-full p-5 bg-rose-600 text-white border border-rose-600/20 rounded-[32px] text-[10px] font-black uppercase tracking-[0.2em] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl shadow-rose-600/20"
              >
                {ICONS.Trash2} FORCE CLOUD RESET (QUOTA FIX)
              </button>

              <p className="text-[8px] font-black text-rose-400 uppercase text-center px-4 tracking-[0.1em] leading-relaxed">
                DHYAN RAKHEIN: Yeh buttons data ko permanently delete kar denge. Backup lena mat bhoolein.
              </p>
            </div>
          )}



          {editingShop && (
            <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[3000] flex items-center justify-center p-6 animate-in zoom-in">
              <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 w-full max-w-sm p-10 space-y-8 shadow-2xl">
                <div className="text-center">
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white leading-none">Edit <span className="text-orange-600">Credentials</span></h3>
                  <p className="text-[10px] font-black text-orange-600 uppercase mt-2">Managing ID: {editingShop.id}</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-500 uppercase ml-4">Shop Label Name</label>
                    <input type="text" className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-white font-black text-center outline-none focus:border-orange-600 uppercase text-xs" value={editingShop.shopName} onChange={e => setEditingShop({ ...editingShop, shopName: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-500 uppercase ml-4">Security Password</label>
                    <input type="text" className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-orange-600 font-black text-center outline-none focus:border-orange-600 text-sm" value={editingShop.password} onChange={e => setEditingShop({ ...editingShop, password: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setEditingShop(null)} className="flex-1 font-black text-[var(--text-muted)] uppercase text-[10px]">Cancel</button>
                  <button onClick={handleUpdateShopCredentials} className="flex-[2] py-4 bg-orange-600 text-white rounded-[24px] font-black uppercase text-[10px] shadow-xl">SAVE CHANGES</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}



      {(isAdmin || activeShop) && adminTab === 'config' && (
        <div className="space-y-6 animate-in slide-in-from-bottom px-1 pb-10">
          
          {/* 1. Business Profile */}
          <div className="bg-[var(--bg-card)] p-6 rounded-[32px] border border-[var(--border)] shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center text-orange-600">
                {ICONS.Dashboard}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-orange-600 tracking-[0.2em]">Business Profile</p>
                <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Logo, Name & Receipt Text</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase text-[var(--text-muted)] ml-2 tracking-widest">Restaurant Name</p>
                  {isAdmin ? (
                    <input
                      type="text"
                      className="w-full p-4 bg-black/50 border border-white/10 rounded-2xl text-white font-black tracking-widest outline-none focus:border-orange-600 text-xs uppercase"
                      value={settings.businessName || ''}
                      onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                    />
                  ) : (
                    <div className="w-full p-4 bg-black/30 border border-white/5 rounded-2xl text-white font-black tracking-widest text-xs uppercase opacity-80">
                      {settings.businessName}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase text-[var(--text-muted)] ml-2 tracking-widest">Custom Receipt Footer</p>
                  <textarea
                    placeholder="e.g. Shukriya! Dobara tashreef layen."
                    rows={2}
                    className="w-full p-4 bg-black/50 border border-white/10 rounded-2xl text-white font-black tracking-widest outline-none focus:border-orange-600 text-xs resize-none"
                    value={settings.receiptFooterText || ''}
                    onChange={(e) => setSettings({ ...settings, receiptFooterText: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-6 bg-black/30 rounded-[32px] border border-dashed border-white/10">
                <p className="text-[9px] font-black uppercase text-[var(--text-muted)] mb-4 tracking-widest">Business Logo</p>
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-24 h-24 rounded-3xl bg-white/5 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden group-hover:border-orange-600/50 transition-all">
                    {settings.businessLogo ? (
                      <img src={settings.businessLogo} className="w-full h-full object-contain" alt="Logo" />
                    ) : (
                      <span className="text-2xl opacity-20">{ICONS.Upload}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    {ICONS.Edit}
                  </div>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase text-[var(--text-muted)] ml-4 tracking-widest flex items-center justify-between">
                <span>Business Start Time (Shift)</span>
                <span className="text-orange-500/50 italic normal-case font-medium">e.g. 06:00 (24h)</span>
              </p>
              <input
                type="time"
                className="w-full p-4 bg-black/50 border border-white/10 rounded-2xl text-white text-center font-black tracking-widest outline-none focus:border-orange-600 text-xs uppercase"
                value={settings.businessDayStartTime || '00:00'}
                onChange={(e) => setSettings({ ...settings, businessDayStartTime: e.target.value })}
              />
            </div>
          </div>

          {/* 2. Printing & Kitchen Workflow */}
          <div className="bg-[var(--bg-card)] p-6 rounded-[32px] border border-blue-600/20 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500">
                {ICONS.Printer}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-blue-500 tracking-[0.2em]">Printing & Kitchen</p>
                <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Hardware & Workflow Control</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-black/30 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🖥️</span>
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase italic">Printer Mode</h4>
                      <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Enable printing on this device</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const newVal = !isPrinterDevice;
                      setIsPrinterDevice?.(newVal);
                      localStorage.setItem('is_printer_device', newVal ? 'true' : 'false');
                    }}
                    className={`w-12 h-7 rounded-full p-1 transition-all duration-300 ${isPrinterDevice ? 'bg-blue-600' : 'bg-white/10'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-lg transform transition-transform duration-300 ${isPrinterDevice ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-black/30 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-indigo-500">{ICONS.ChefHat}</span>
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase italic">Enable Kitchen Prints</h4>
                      <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Global kitchen printing switch</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, enableKitchenPrinting: !settings.enableKitchenPrinting })}
                    className={`w-12 h-7 rounded-full p-1 transition-all duration-300 ${settings.enableKitchenPrinting ? 'bg-indigo-600' : 'bg-white/10'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-lg transform transition-transform duration-300 ${settings.enableKitchenPrinting ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">


                <div className="flex items-center justify-between p-4 bg-black/30 rounded-2xl border border-emerald-600/20">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-500">{ICONS.CheckCircle}</span>
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase italic">Auto Print (Kitchen)</h4>
                      <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Print when kitchen receives order</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, isAutoPrintKitchenEnabled: !settings.isAutoPrintKitchenEnabled })}
                    className={`w-12 h-7 rounded-full p-1 transition-all duration-300 ${settings.isAutoPrintKitchenEnabled ? 'bg-emerald-600' : 'bg-white/10'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-lg transform transition-transform duration-300 ${settings.isAutoPrintKitchenEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-black/30 rounded-2xl border border-cyan-600/20">
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-500">{ICONS.Zap}</span>
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase italic">Silent Printing (Skip Dialog)</h4>
                      <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Skip browser print confirmation</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, isSilentPrintingEnabled: !settings.isSilentPrintingEnabled })}
                    className={`w-12 h-7 rounded-full p-1 transition-all duration-300 ${settings.isSilentPrintingEnabled ? 'bg-cyan-600' : 'bg-white/10'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-lg transform transition-transform duration-300 ${settings.isSilentPrintingEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {settings.isSilentPrintingEnabled && (
                  <div className="bg-cyan-600/10 border border-cyan-600/20 p-4 rounded-2xl">
                    <p className="text-[8px] font-black text-cyan-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                      {ICONS.Info} Configuration Required:
                    </p>
                    <p className="text-[7px] text-white/70 leading-relaxed font-bold uppercase">
                      Silent printing ke liye Chrome shortcut mein <span className="text-cyan-400">--kiosk-printing</span> flag add karein. 
                      Is se browser print dialog nahi dikhayega aur seedha print karega.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-black/30 p-6 rounded-[32px] border border-white/5 space-y-4">
               <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black uppercase text-blue-500 tracking-widest italic">Local Master IP Sync</p>
                  <button 
                    onClick={() => {
                      if (serverInfo) {
                        setSettings({ ...settings, masterIP: serverInfo.localIP });
                        alert("IP Set: " + serverInfo.localIP);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                  >
                    Set My IP
                  </button>
               </div>
               <input
                 type="text"
                 placeholder="Master IP (e.g. 192.168.1.10)"
                 className="w-full p-4 bg-black/50 border border-white/10 rounded-2xl text-white text-xs font-bold outline-none focus:border-blue-500"
                 value={settings.masterIP || ''}
                 onChange={(e) => setSettings({ ...settings, masterIP: e.target.value })}
               />
               <p className="text-[7px] font-bold text-blue-500/40 uppercase text-center tracking-widest leading-relaxed">
                 Connect other devices using the Master IP above.
               </p>
            </div>
          </div>

          {/* 3. Security & Finance */}
          <div className="bg-[var(--bg-card)] p-6 rounded-[32px] border border-red-600/20 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center text-red-500">
                {ICONS.Lock}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-red-500 tracking-[0.2em]">Security & Finance</p>
                <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Passcodes & Tax control</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                   <p className="text-[9px] font-black uppercase text-[var(--text-muted)] ml-2 tracking-widest">Master Password</p>
                   <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="NEW PASSWORD"
                      className="flex-1 p-4 bg-black/50 border border-white/10 rounded-2xl text-white text-center font-black tracking-widest outline-none focus:border-red-600 text-xs"
                      value={newOwnerPassword}
                      onChange={(e) => setNewOwnerPassword(e.target.value)}
                    />
                    <button
                      onClick={() => {
                        if (newOwnerPassword) {
                          setSettings({ ...settings, adminSecretKey: newOwnerPassword });
                          setNewOwnerPassword('');
                          alert("Password Updated!");
                        }
                      }}
                      className="px-6 bg-red-600 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest"
                    >
                      Update
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-black/30 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-orange-600 font-bold">{ICONS.Percent || 'TAX'}</span>
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase italic">Enable Tax</h4>
                      <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Add tax to bills</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, isTaxEnabled: !settings.isTaxEnabled })}
                    className={`w-12 h-7 rounded-full p-1 transition-all duration-300 ${settings.isTaxEnabled ? 'bg-orange-600' : 'bg-white/10'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-lg transform transition-transform duration-300 ${settings.isTaxEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {settings.isTaxEnabled && (
                  <div className="p-4 bg-black/30 rounded-2xl border border-orange-600/10 space-y-2">
                    <p className="text-[9px] font-black uppercase text-orange-600 tracking-widest flex justify-between">
                      <span>Rate</span>
                      <span>{settings.taxRate || 0}%</span>
                    </p>
                    <input
                      type="range" min="0" max="30" step="0.5"
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-600"
                      value={settings.taxRate || 0}
                      onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) })}
                    />
                  </div>
                )}
              </div>
            </div>

            {showSecretSlider && (
              <div className="bg-blue-600/5 p-6 rounded-[32px] border border-blue-600/20 space-y-4">
                <p className="text-[9px] font-black uppercase text-blue-500 tracking-widest flex items-center justify-between">
                  <span>Sales Display Adjustment (%)</span>
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-full">{settings.statsAdjustmentPercentage || 100}%</span>
                </p>
                <input
                  type="range" min="1" max="200" step="1"
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  value={settings.statsAdjustmentPercentage || 100}
                  onChange={(e) => setSettings({ ...settings, statsAdjustmentPercentage: parseInt(e.target.value) })}
                />
              </div>
            )}
          </div>

          {/* 4. Appearance & Look */}
          <div className="bg-[var(--bg-card)] p-6 rounded-[32px] border border-[var(--border)] shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="w-10 h-10 bg-purple-600/10 rounded-xl flex items-center justify-center text-purple-500">
                {ICONS.Utensils}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-purple-500 tracking-[0.2em]">App Customization</p>
                <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Font & Typography</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <p className="text-[9px] font-black uppercase text-[var(--text-muted)] ml-2 tracking-widest">Font Size Control</p>
                <div className="flex items-center justify-between p-4 bg-black/30 rounded-[32px] border border-white/5">
                  <button onClick={() => adjustFontSize(-1)} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-orange-600 text-xl border border-white/10 active:scale-90 transition-all">{ICONS.Minus}</button>
                  <div className="text-center">
                    <p className="text-2xl font-black text-white italic">{settings.fontSizeNumber || 16}px</p>
                  </div>
                  <button onClick={() => adjustFontSize(1)} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-orange-600 text-xl border border-white/10 active:scale-90 transition-all">{ICONS.Plus}</button>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[9px] font-black uppercase text-[var(--text-muted)] ml-2 tracking-widest">App Theme</p>
                <div className="grid grid-cols-3 gap-2 p-1.5 bg-black/20 rounded-2xl border border-[var(--border)]">
                  {(['midnight', 'dark', 'light'] as AppTheme[]).map(t => (
                    <button key={t} onClick={() => setSettings({ ...settings, theme: t })} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${settings.theme === t ? 'bg-orange-600 text-white shadow-lg' : 'text-[var(--text-muted)] hover:bg-white/5'}`}>{t}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {(['inter', 'oswald', 'courier', 'roboto', 'serif'] as FontFamily[]).map(style => (
                <button
                  key={style}
                  onClick={() => setSettings({ ...settings, fontFamily: style })}
                  className={`p-3 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 font-${style} ${settings.fontFamily === style ? 'bg-orange-600 text-white' : 'bg-white/5 text-[var(--text-muted)] hover:bg-white/10'}`}
                >
                  {style}
                </button>
              ))}
            </div>


          </div>

          {/* 5. Notifications & Delivery */}
          <div className="bg-[var(--bg-card)] p-6 rounded-[32px] border border-emerald-600/20 shadow-xl space-y-4">
             <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600/10 rounded-xl flex items-center justify-center text-emerald-500">
                    {ICONS.Bell}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.2em]">Notifications</p>
                  </div>
                </div>
             </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setSettings({ ...settings, isAutoWhatsappEnabled: !settings.isAutoWhatsappEnabled })}
                  className={`w-12 h-7 rounded-full p-1 transition-all duration-300 ${settings.isAutoWhatsappEnabled ? 'bg-emerald-600' : 'bg-white/10'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-lg transform transition-transform duration-300 ${settings.isAutoWhatsappEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-black/30 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <span className="text-orange-600 font-bold">{ICONS.Mic}</span>
                  <div>
                    <h4 className="text-[10px] font-black text-white uppercase italic">Voice Alert</h4>
                    <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Announce order ready</p>
                  </div>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, enableVoiceAnnouncement: !settings.enableVoiceAnnouncement })}
                  className={`w-12 h-7 rounded-full p-1 transition-all duration-300 ${settings.enableVoiceAnnouncement ? 'bg-orange-600' : 'bg-white/10'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-lg transform transition-transform duration-300 ${settings.enableVoiceAnnouncement ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
               <p className="text-[10px] font-black uppercase text-orange-600 tracking-[0.2em] ml-2">Delivery Zones</p>
               <div className="flex flex-wrap gap-2">
                  {(settings.deliveryZones || []).map(zone => (
                    <div key={zone.id} className="flex items-center gap-3 p-3 bg-black/30 rounded-2xl border border-white/5">
                      <div>
                        <p className="text-[10px] font-black uppercase text-white italic">{zone.name}</p>
                        <p className="text-[8px] font-bold text-orange-600">Rs.{zone.fee}</p>
                      </div>
                      <button onClick={() => handleDeleteDeliveryZone(zone.id)} className="text-red-500/50 hover:text-red-500">{ICONS.X}</button>
                    </div>
                  ))}
                  <button onClick={handleAddDeliveryZone} className="px-4 py-3 border-2 border-dashed border-white/10 rounded-2xl text-[10px] font-black text-[var(--text-muted)] uppercase hover:border-orange-600/50 transition-all">+ Add Zone</button>
               </div>
            </div>
          </div>

          {/* 6. Maintenance & Data */}
          <div className="bg-[var(--bg-card)] p-6 rounded-[32px] border border-amber-600/20 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="w-10 h-10 bg-amber-600/10 rounded-xl flex items-center justify-center text-amber-600">
                {ICONS.Settings}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-amber-600 tracking-[0.2em]">Maintenance</p>
                <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Backup & System Tools</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button onClick={onExportData} className="flex flex-col items-center justify-center p-4 bg-emerald-600/10 border border-emerald-600/20 rounded-[28px] group transition-all">
                <div className="text-emerald-500 mb-2 group-hover:scale-110 transition-transform">{ICONS.Download}</div>
                <span className="text-[7px] font-black text-emerald-500 uppercase">Backup</span>
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-4 bg-blue-600/10 border border-blue-600/20 rounded-[28px] group transition-all">
                <div className="text-blue-600 mb-2 group-hover:scale-110 transition-transform">{ICONS.Upload}</div>
                <span className="text-[7px] font-black text-blue-600 uppercase">Restore</span>
              </button>
              <button onClick={handleOptimizeMenuImages} className="flex flex-col items-center justify-center p-4 bg-purple-600/10 border border-purple-600/20 rounded-[28px] group transition-all">
                <div className="text-purple-500 mb-2 group-hover:scale-110 transition-transform">{ICONS.Check}</div>
                <span className="text-[7px] font-black text-purple-500 uppercase">Optimize</span>
              </button>
              <button onClick={() => setShowResetConfirm(true)} className="flex flex-col items-center justify-center p-4 bg-red-600/10 border border-red-600/20 rounded-[28px] group transition-all">
                <div className="text-red-500 mb-2 group-hover:scale-110 transition-transform">{ICONS.Trash2}</div>
                <span className="text-[7px] font-black text-red-500 uppercase">Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {adminTab === 'settlement' && (
        <div className="space-y-6 animate-in slide-in-from-right px-1 pb-10">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-black text-amber-500 uppercase italic text-xl">Bill <span className="text-white">Settlement</span></h3>
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Served Orders</p>
          </div>

          <div className="space-y-3">
            {orders.filter(o => o.status === 'served').length === 0 ? (
              <div className="p-10 text-center border-2 border-dashed border-[var(--border)] rounded-[40px] text-[var(--text-muted)] font-black uppercase text-[10px]">No Served Orders to Settle</div>
            ) : (
              orders.filter(o => o.status === 'served').map(order => (
                <div key={order.id} className="bg-[var(--bg-card)] p-5 rounded-[32px] border border-[var(--border)] shadow-xl flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-600/10 flex items-center justify-center text-amber-600 font-black text-lg border border-amber-600/20">
                        #{order.orderNumber}
                      </div>
                      <div>
                        <p className="font-black text-sm uppercase text-white italic tracking-tight">{order.customerName}</p>
                        <p className="text-[8px] font-black text-amber-500/60 mt-0.5">{order.customerPhone}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-white italic tracking-tighter">Rs.{order.total.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePrintReceipt(order)}
                      className="w-full p-4 bg-white/5 text-[var(--text-muted)] rounded-[24px] flex items-center justify-center border border-white/5 active:scale-95 transition-all"
                    >
                      Print Receipt
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setSettlementOrder(order);
                      setReceivedAmount('');
                    }}
                    className="w-full py-4 bg-amber-600 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {ICONS.CreditCard} Recieve Payment
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="pt-6 border-t border-white/5 space-y-4">
            <div className="flex justify-between items-center px-2">
              <h3 className="font-black text-[var(--text-muted)] uppercase italic text-sm">Recent <span className="text-white/40">Orders</span></h3>
              <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Delivered</p>
            </div>
            <div className="space-y-3 opacity-60">
              {orders.filter(o => o.status === 'delivered').sort((a, b) => b.timestamp - a.timestamp).slice(0, 5).map(order => (
                <div key={order.id} className="bg-[var(--bg-card)]/50 p-4 rounded-[28px] border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-[8px] font-black text-[var(--text-muted)]">#{order.orderNumber}</div>
                    <div>
                      <div className="text-[10px] font-black text-white uppercase italic">{order.customerName}</div>
                      <div className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-emerald-500 italic">Rs.{order.total.toLocaleString()}</div>
                </div>
              ))}
              {orders.filter(o => o.status === 'delivered').length === 0 && (
                <div className="p-8 text-center text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">No Recent Settlements</div>
              )}
            </div>
          </div>
        </div>
      )}

      {settlementOrder && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[3000] flex items-center justify-center p-4 animate-in zoom-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 w-full max-w-sm p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[95vh] no-scrollbar">
            <div className="text-center shrink-0">
              <h3 className="text-2xl font-black uppercase tracking-tighter italic text-amber-500">Collect <span className="text-white">Cash</span></h3>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase mt-2">Order #{settlementOrder.orderNumber} • {settlementOrder.customerName}</p>
            </div>

            <div className="space-y-6">
              <div className="bg-black/40 p-5 rounded-[32px] border border-white/5 space-y-1">
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">Total Bill</p>
                <p className="text-4xl font-black text-white text-center italic tracking-tighter">Rs.{settlementOrder.total.toLocaleString()}</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-4">Cash Received</label>
                <input
                  type="number" autoFocus
                  className="w-full p-6 bg-black border border-white/10 rounded-[28px] text-white text-center font-black text-2xl outline-none focus:border-amber-600"
                  placeholder="0"
                  value={receivedAmount}
                  onChange={e => setReceivedAmount(e.target.value)}
                />
              </div>

              {parseFloat(receivedAmount) > 0 && (
                <div className={`p-5 rounded-[32px] border space-y-2 animate-in slide-in-from-bottom ${parseFloat(receivedAmount) < settlementOrder.total ? 'bg-rose-600/10 border-rose-600/20' : 'bg-emerald-600/10 border-emerald-600/20'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest text-center ${parseFloat(receivedAmount) < settlementOrder.total ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {parseFloat(receivedAmount) < settlementOrder.total ? 'Baqi - CASH' : 'Wapsi (Change)'}
                  </p>
                  <p className={`text-4xl font-black text-center italic tracking-tighter ${parseFloat(receivedAmount) < settlementOrder.total ? 'text-rose-600' : 'text-emerald-500'}`}>
                    {parseFloat(receivedAmount) < settlementOrder.total ? '-' : ''}Rs.{Math.abs(parseFloat(receivedAmount) - settlementOrder.total).toLocaleString()}
                  </p>
                  {parseFloat(receivedAmount) < settlementOrder.total && (
                    <p className="text-[8px] font-black text-rose-500/60 uppercase text-center tracking-widest">
                      Total Discount: Rs. {((settlementOrder.discount || 0) + (settlementOrder.total - parseFloat(receivedAmount))).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handlePrintReceipt(settlementOrder)}
                className="py-4 bg-orange-600/10 text-orange-600 border border-orange-600/20 rounded-[24px] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {ICONS.Printer} Print
              </button>
              <button
                onClick={() => handleShareWhatsApp(settlementOrder)}
                className="py-4 bg-emerald-600/10 text-emerald-500 border border-emerald-600/20 rounded-[24px] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {ICONS.Send} WhatsApp
              </button>
              <button
                onClick={() => {
                  const received = parseFloat(receivedAmount) || 0;
                  if (received === 0) return alert("Pehly cash enter karein!");
                  
                  const shortage = settlementOrder.total - received;
                  const extraDiscount = shortage > 0 ? shortage : 0;
                  const finalTotal = shortage > 0 ? received : settlementOrder.total;

                  if (shortage > 0) {
                    if (!confirm(`Customer ne Rs.${shortage} kum diye hain. Kya aap Rs.${extraDiscount} ko discount mein daal kar bill settle karna chahte hain?`)) return;
                  }
                  
                  const updatedOrder = { 
                    ...settlementOrder, 
                    status: 'delivered' as const,
                    receivedAmount: received,
                    balance: 0,
                    discount: (settlementOrder.discount || 0) + extraDiscount,
                    total: finalTotal,
                    statusTimestamps: {
                      ...settlementOrder.statusTimestamps,
                      delivered: Date.now()
                    }
                  };
                  
                  onUpdateOrder(updatedOrder);
                  setSettlementOrder(null);
                  setReceivedAmount('');
                  alert("Order Settle ho gaya hai!");
                }}
                className="col-span-2 py-5 bg-amber-600 text-white rounded-[28px] font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {ICONS.Check} Confirm Payment
              </button>
              <button 
                onClick={() => setSettlementOrder(null)} 
                className="col-span-2 py-2 font-black text-[var(--text-muted)] uppercase text-[9px] tracking-[0.2em] mt-1 active:scale-95"
              >
                Cancel / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {viewOrder && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[3000] flex items-center justify-center p-6 animate-in zoom-in">
          <div className="bg-[var(--bg-card)] rounded-[40px] border border-white/10 w-full max-w-sm flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 bg-black/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-600/10 flex items-center justify-center text-orange-600 font-black text-lg border-2 border-orange-600/20">
                  #{viewOrder.orderNumber}
                </div>
                <div>
                  <h3 className="text-[12px] font-black text-white uppercase italic leading-none">{viewOrder.customerName}</h3>
                  <p className="text-[8px] font-black text-orange-600 uppercase mt-1 tracking-widest">{viewOrder.customerPhone || 'Walk-in'}</p>
                </div>
              </div>
              <button
                onClick={() => setViewOrder(null)}
                className="p-3 bg-white/5 text-white rounded-2xl active:scale-90 transition-all"
              >
                {ICONS.X}
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto max-h-[50vh] scrollbar-hide space-y-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest text-left">
                    <td className="pb-2">Item</td>
                    <td className="pb-2 text-center">Qty</td>
                    <td className="pb-2 text-right">Price</td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {viewOrder.items.map((item, idx) => (
                    <tr key={idx} className="text-[10px] font-black text-white">
                      <td className="py-2 pr-2">{item.name}</td>
                      <td className="py-2 text-center">x{item.quantity}</td>
                      <td className="py-2 text-right">Rs.{(item.price * item.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-dashed border-white/10 pt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-widest">Subtotal</span>
                  <span className="text-[10px] font-black text-white">Rs.{viewOrder.subtotal.toLocaleString()}</span>
                </div>
                {viewOrder.discount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase text-orange-500 tracking-widest">Discount</span>
                    <span className="text-[10px] font-black text-orange-500">-Rs.{viewOrder.discount.toLocaleString()}</span>
                  </div>
                )}
                {viewOrder.deliveryFee && viewOrder.deliveryFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase text-blue-500 tracking-widest">Delivery</span>
                    <span className="text-[10px] font-black text-blue-500">Rs.{viewOrder.deliveryFee.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[10px] font-black uppercase text-white tracking-widest">Total Bill</span>
                  <span className="text-xl font-black text-emerald-500 italic">Rs.{viewOrder.total.toLocaleString()}</span>
                </div>
                {viewOrder.status === 'delivered' && viewOrder.receivedAmount !== undefined && (
                  <div className="bg-emerald-600/10 p-3 rounded-2xl border border-emerald-600/20 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] font-black uppercase text-emerald-500 tracking-widest">Amount Paid</span>
                      <span className="text-[10px] font-black text-emerald-500">Rs.{viewOrder.receivedAmount.toLocaleString()}</span>
                    </div>
                    {viewOrder.balance !== undefined && viewOrder.balance > 0 && (
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[8px] font-black uppercase text-rose-500 tracking-widest">Baqi (Balance)</span>
                        <span className="text-[10px] font-black text-rose-500">Rs.{viewOrder.balance.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-black/20 border-t border-white/5 flex gap-3">
              <button
                onClick={() => {
                  handlePrintReceipt(viewOrder);
                }}
                className="flex-1 py-4 bg-orange-600/10 text-orange-600 border border-orange-600/20 rounded-2xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {ICONS.Inventory} Print
              </button>
              <button
                onClick={() => {
                  handleShareWhatsApp(viewOrder);
                }}
                className="flex-1 py-4 bg-emerald-600/10 text-emerald-500 border border-emerald-600/20 rounded-2xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {ICONS.Send} WhatsApp
              </button>
            </div>
            
            {viewOrder.status === 'served' && (
              <div className="px-6 pb-6">
                <button
                  onClick={() => {
                    setViewOrder(null);
                    setSettlementOrder(viewOrder);
                    setReceivedAmount(viewOrder.receivedAmount?.toString() || '');
                  }}
                  className="w-full py-5 bg-amber-600 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                   {ICONS.CreditCard} Go To Settlement
                </button>
              </div>
            )}

            <button onClick={() => setViewOrder(null)} className="w-full py-3 font-black text-[var(--text-muted)] uppercase text-[8px] tracking-widest">Close View</button>
          </div>
        </div>
      )}

      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[2000] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-red-600/20 w-full max-sm p-10 space-y-8 animate-in zoom-in shadow-2xl text-center">
            <div className="w-20 h-20 bg-orange-600/10 text-orange-600 rounded-3xl mx-auto flex items-center justify-center mb-4">{ICONS.Upload}</div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white leading-none">Restore <span className="text-orange-600">Backup</span>?</h3>
              <p className="text-[11px] font-black text-red-500 uppercase leading-relaxed tracking-wide bg-red-600/5 p-5 rounded-2xl">
                Yeh amal aapka mojooda sara data (Orders, Inventory, Khata) khatam kar ke file wala data load kar dega. Kya aap jari rakhna chahte hain?
              </p>
              <p className="text-[9px] text-[var(--text-muted)] font-black uppercase">File: {showRestoreConfirm.name}</p>
            </div>
            <div className="flex gap-4 pt-4">
              <button onClick={() => setShowRestoreConfirm(null)} className="flex-1 py-5 bg-white/5 rounded-[28px] font-black uppercase text-[10px] text-white">Back</button>
              <button onClick={() => { onImportData(showRestoreConfirm); setShowRestoreConfirm(null); }} className="flex-[2] py-5 bg-orange-600 text-white rounded-[28px] font-black uppercase text-[10px] shadow-xl">Confirm Restore</button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[2000] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-red-600/40 w-full max-w-sm p-10 space-y-8 animate-in zoom-in shadow-2xl text-center">
            <div className="w-20 h-20 bg-red-600/10 text-red-600 rounded-3xl mx-auto flex items-center justify-center mb-4">{ICONS.Trash2}</div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white leading-none">Complete <span className="text-red-500">Reset?</span></h3>
              <p className="text-[10px] font-black text-red-500 uppercase mt-2 tracking-widest">
                Kya aap waqai Cloud aur App se saara data (Orders, Items, Staff) delete karna chahte hain? Yeh amal khatarnak ho sakta hai.
              </p>
            </div>
            <div className="flex gap-4 pt-4">
              <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-5 bg-white/5 rounded-[28px] font-black uppercase text-[10px] text-white">Cancel</button>
              <button onClick={() => {
                onResetData();
                setShowResetConfirm(false);
              }} className="flex-[2] py-5 bg-red-600 text-white rounded-[28px] font-black uppercase text-[10px] shadow-xl">Yes, Reset All</button>
            </div>
          </div>
        </div>
      )}

      {showCustomerPayModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[3000] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 w-full max-w-xs p-10 space-y-8 animate-in zoom-in shadow-2xl">
            <div className="text-center">
              <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">Recieve <span className="text-emerald-500">Payment</span></h3>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase mt-2">{showCustomerPayModal.name}</p>
            </div>
            <div className="space-y-4">
              <input
                type="number" autoFocus
                placeholder="AMOUNT (RS)"
                className="w-full p-5 bg-black border border-white/5 rounded-[24px] text-emerald-500 font-black text-center outline-none focus:border-emerald-600 text-xl"
                value={payAmount} onChange={e => setPayAmount(e.target.value)}
              />
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowCustomerPayModal(null)} className="flex-1 font-black text-[var(--text-muted)] uppercase text-[10px]">Cancel</button>
              <button onClick={handleCustomerPayment} className="flex-[2] py-4 bg-emerald-600 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-xl">Recieved</button>
            </div>
          </div>
        </div>
      )}


      {showCustomerHistoryModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[3000] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 w-full max-w-sm p-8 space-y-6 animate-in zoom-in shadow-2xl flex flex-col max-h-[80vh]">
            <div className="text-center shrink-0">
              <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">Payment <span className="text-blue-500">History</span></h3>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase mt-2">{showCustomerHistoryModal.name}</p>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1">
              {customerPayments.filter(p => p.customerId === showCustomerHistoryModal.id).length === 0 ? (
                <div className="p-10 text-center border-2 border-dashed border-white/5 rounded-3xl text-[var(--text-muted)] font-black uppercase text-[10px]">No Payments Recorded</div>
              ) : (
                customerPayments
                  .filter(p => p.customerId === showCustomerHistoryModal.id)
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map(p => (
                    <div key={p.id} className="bg-black/40 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-black text-white">{new Date(p.timestamp).toLocaleDateString()}</p>
                        <p className="text-[8px] font-black text-[var(--text-muted)] uppercase">{p.note || 'Manual Payment'}</p>
                      </div>
                      <p className="text-sm font-black text-emerald-500">Rs.{p.amount.toLocaleString()}</p>
                    </div>
                  ))
              )}
            </div>

            <div className="pt-4 border-t border-white/5 shrink-0">
              <button onClick={() => setShowCustomerHistoryModal(null)} className="w-full py-4 bg-white/5 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest border border-white/10">Close History</button>
            </div>
          </div>
        </div>
      )}

      {viewingStaffHistory && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[3000] flex items-center justify-center p-4 animate-in zoom-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 w-full max-w-lg h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-white/5 text-center shrink-0">
               <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white leading-none"><span className="text-orange-600">{viewingStaffHistory.name}</span>'s History</h3>
               <p className="text-[10px] font-black text-white/40 uppercase mt-2 tracking-widest">Showing total sales and recent orders</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-orange-600/10 border border-orange-600/20 p-6 rounded-[32px] text-center mb-6">
                <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Total Sales to Date</p>
                <p className="text-4xl font-black text-white italic">Rs.{orders.filter(o => o.orderTakerId === viewingStaffHistory.id).reduce((sum, o) => sum + o.total, 0).toLocaleString()}</p>
                <p className="text-[8px] font-black text-white/20 uppercase mt-2">Orders Processed: {orders.filter(o => o.orderTakerId === viewingStaffHistory.id).length}</p>
              </div>

              <p className="text-[9px] font-black text-white/20 uppercase ml-4 tracking-widest">Recent Activity</p>
              {orders.filter(o => o.orderTakerId === viewingStaffHistory.id).sort((a,b) => b.timestamp - a.timestamp).map(order => (
                <div key={order.id} className="bg-white/5 border border-white/5 p-4 rounded-[24px] flex justify-between items-center group">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-sm text-white uppercase truncate">{order.customerName}</p>
                    <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mt-1">{new Date(order.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-black text-emerald-500 italic">Rs.{order.total.toLocaleString()}</p>
                    <p className="text-[8px] font-black text-orange-600 uppercase mt-1">NO: #{order.orderNumber}</p>
                  </div>
                </div>
              ))}
              {orders.filter(o => o.orderTakerId === viewingStaffHistory.id).length === 0 && (
                <div className="text-center py-20 opacity-20 uppercase font-black text-sm italic tracking-tighter">No History Found</div>
              )}
            </div>

            <div className="p-6 border-t border-white/5 shrink-0">
               <button onClick={() => setViewingStaffHistory(null)} className="w-full py-5 bg-white/5 text-white/50 rounded-[32px] font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-colors">Close View</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;