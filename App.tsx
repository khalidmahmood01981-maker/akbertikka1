
import React, { useState, useEffect, useRef } from 'react';
import { onSnapshot, setDoc, doc, collection, getDocs, deleteDoc, addDoc, updateDoc } from 'firebase/firestore';
import { db, collections } from './firebase';


import { MenuItem, Order, Purchase, AppSettings, StockCategory, StockLog, KhataTransaction, ShopAccount, Customer, Supplier, SupplierCategory, StaffMember, CustomerPayment, OrderStatus, OrderItem, KitchenTicket } from './types';
import { HEADING_CLICKS_REQUIRED, INITIAL_ITEMS, ICONS, PRINT_TRANSLATIONS } from './constants';
import { QRCodeCanvas } from 'qrcode.react';
import POS from './components/POS';
import AdminDashboard from './components/AdminDashboard';
import LoginModal from './components/LoginModal';
import HistoryView from './components/HistoryView';
import InventoryView from './components/InventoryView';
import MenuManagement from './components/MenuManagement';
import CustomerLogin from './components/CustomerLogin';
import CustomerMenu from './components/CustomerMenu';
import LiveOrdersView from './components/LiveOrdersView';
import CashierView from './components/CashierView';
import * as offlineDB from './utils/db';
import { api } from './utils/api';


const safeSanitize = (obj: any): any => {
  const seen = new WeakSet();
  try {
    const json = JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return;
        if (value.nodeType || value === window || value.constructor?.name?.startsWith('HTML')) {
          return;
        }
        seen.add(value);
      }
      return value;
    });
    return JSON.parse(json);
  } catch (e) {
    console.warn("Sanitization warning:", e);
    return JSON.parse(JSON.stringify(obj, (k, v) => (typeof v === 'object' && v !== null && seen.has(v)) ? undefined : v));
  }
};

type TabType = 'dashboard' | 'menu' | 'bill' | 'history' | 'inventory' | 'orders' | 'cashier' | 'crm';

const App: React.FC = () => {
  const [activeShop, setActiveShop] = useState<ShopAccount | null>(null);
  const [activeStaff, setActiveStaff] = useState<StaffMember | null>(null);
  const [globalAccounts, setGlobalAccounts] = useState<ShopAccount[]>([
    {
      id: 'TT',
      password: '11111111',
      shopName: 'BBQ & FAST FOOD',
      subscriptionStatus: 'active',
      expiryDate: Date.now() + (365 * 24 * 60 * 60 * 1000),
      createdAt: Date.now()
    }
  ]);

  const [items, setItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierCategories, setSupplierCategories] = useState<SupplierCategory[]>([
    { id: '1', name: 'MEAT' },
    { id: '2', name: 'VEGETABLES' },
    { id: '3', name: 'GENERAL STORE' }
  ]);
  const [stockCategories, setStockCategories] = useState<StockCategory[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [khataTransactions, setKhataTransactions] = useState<KhataTransaction[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    id: 'app_settings',
    businessName: 'BBQ & FAST FOOD',
    taxRate: 0,
    isTaxEnabled: false,
    isDiscountEnabled: true,
    defaultDiscount: 0,
    theme: 'midnight',
    fontSize: 'medium',
    fontSizeNumber: 16,
    fontFamily: 'inter',
    isAuthEnabled: true,
    whatsappCountryCode: '92',
    adminUsername: 'admin',
    adminSecretKey: '111222',
    subscriptionPrice: 100,
    collectionJazzCash: '03000000000',
    collectionEasyPaisa: '03000000000',
    notificationSoundUrl: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    notificationRepeatCount: 1,
    notificationSounds: [
      { id: 'default', name: 'Standard Alert', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
      { id: 'bell', name: 'Service Bell', url: 'https://assets.mixkit.co/active_storage/sfx/2210/2210-preview.mp3' },
      { id: 'chime', name: 'Digital Chime', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' }
    ],
    deliveryZones: [
      { id: 'zone1', name: 'Local (Within 2km)', fee: 50 },
      { id: 'zone2', name: 'Mid Range (2-5km)', fee: 100 },
      { id: 'zone3', name: 'Far (5km+)', fee: 200 }
    ],
    paymentMethods: [
      { id: 'cash', label: 'Cash', isEnabled: true },
      { id: 'khata', label: 'Udhaar / Khata', isEnabled: true },
      { id: 'jazzcash', label: 'JazzCash', isEnabled: false },
      { id: 'easypaisa', label: 'EasyPaisa', isEnabled: false }
    ],
    purchaseCategories: ['Raw Material', 'Utilities', 'Rent', 'Salary', 'Maintenance', 'Marketing', 'Other'],
    purchaseItems: [
      { id: 'p1', name: 'CHICKEN', category: 'Raw Material', unit: 'kg' },
      { id: 'p2', name: 'OIL', category: 'Raw Material', unit: 'kg' },
      { id: 'p3', name: 'POTATO', category: 'Raw Material', unit: 'kg' },
      { id: 'p4', name: 'ELECTRICITY BILL', category: 'Utilities', unit: 'rs' },
      { id: 'p5', name: 'GAS BILL', category: 'Utilities', unit: 'rs' },
    ],
    isAutoWhatsappEnabled: true,
    enableVoiceAnnouncement: true,
    isAutoPrintKitchenEnabled: true,
    isAutoPrintBillEnabled: false,
    isQueueModeEnabled: true,
    enableKitchenPrinting: true,
    enableBillPrinting: true,
  });

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const saved = localStorage.getItem('app_active_tab');
    return (saved as TabType) || 'bill';
  });
  const [headingClicks, setHeadingClicks] = useState(0);
  const [showAdminPanelButton, setShowAdminPanelButton] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCustomerMode, setIsCustomerMode] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [showLoginAttempted, setShowLoginAttempted] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isTotalsUnlocked, setIsTotalsUnlocked] = useState(false);
  const [showSecretSlider, setShowSecretSlider] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinClickCount, setPinClickCount] = useState(0);
  const pinClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverInfo, setServerInfo] = useState<{ localIP: string; port: number } | null>(null);
  const [isLocalConnected, setIsLocalConnected] = useState(false);
  const [hasPendingWrites, setHasPendingWrites] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [qrTableNumber, setQrTableNumber] = useState('');
  const [isPrinterDevice, setIsPrinterDevice] = useState(() => localStorage.getItem('is_printer_device') === 'true');
  const [kitchenQueue, setKitchenQueue] = useState<Order[]>([]);
  const [showQueueModal, setShowQueueModal] = useState(false);
  
  const settingsRef = useRef(settings);
  const isPrinterDeviceRef = useRef(isPrinterDevice);
  const ordersRef = useRef(orders);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { isPrinterDeviceRef.current = isPrinterDevice; }, [isPrinterDevice]);
  useEffect(() => { ordersRef.current = orders; }, [orders]);
  const lastPrintedOrderIdRef = useRef<string | null>(null);


  const [showDataWarning, setShowDataWarning] = useState(false);

  const [dataSize, setDataSize] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevOrdersRef = useRef<Order[]>([]);
  const [currentCustomer, setCurrentCustomer] = useState<{ name: string; phone: string } | null>(null);
  const [currentTableNumber, setCurrentTableNumber] = useState<string>('');
  const [currentOrderTakerId, setCurrentOrderTakerId] = useState<string | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [showTakerQR, setShowTakerQR] = useState(false);
  const [isNavHidden, setIsNavHidden] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'info';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  const triggerConfirm = (config: {
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'info';
  }) => {
    setConfirmModal({ ...config, show: true });
  };

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialize notification sound
    const soundUrl = settings.notificationSoundUrl || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
    audioRef.current = new Audio(soundUrl);
    audioRef.current.load();

    const handleSyncToLocalServer = async () => {
      try {
        const pending = await offlineDB.getPendingSyncItems();
        if (pending.length > 0) {
          // Check if local server is reachable
          const info = await api.getInfo();
          if (info) {
            notify(`Syncing ${pending.length} changes to local server...`, "info");
            for (const item of pending) {
              try {
                if (item.type === 'order' || item.type === 'update') {
                  await api.saveOrder(item.data);
                } else if (item.type === 'customer') {
                  await api.saveCustomer(item.data);
                }
                await offlineDB.deletePendingSyncItem(item.id);
              } catch (e) {
                console.warn("Failed to sync item:", item.id, e);
              }
            }
            notify("Local sync complete!", "success");
          }
        }
      } catch (e) {
        console.error("Local sync loop failed:", e);
      }
    };

    // Periodic sync check (every 30 seconds)
    const syncInterval = setInterval(handleSyncToLocalServer, 30000);

    const checkLocalStatus = async () => {
      const info = await api.getInfo();
      setServerInfo(info);
      setIsLocalConnected(!!info);
    };
    const statusInterval = setInterval(checkLocalStatus, 10000);

    handleSyncToLocalServer(); // Run immediately
    checkLocalStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncInterval);
      clearInterval(statusInterval);
    };
  }, [isOnline, settings.notificationSoundUrl]);

  const handleManualLANSync = async () => {
    if (!isLocalConnected) return;
    try {
      notify("LAN Syncing...", "info");
      const [ordersArr, customersArr, itemsArr] = await Promise.all([
        api.getOrders(),
        api.getCustomers(),
        api.getItems()
      ]);
      
      if (Array.isArray(ordersArr)) setOrders(ordersArr.sort((a, b) => b.timestamp - a.timestamp));
      if (Array.isArray(customersArr)) setCustomers(customersArr);
      if (Array.isArray(itemsArr) && itemsArr.length > 0) setItems(itemsArr);
      
      notify("LAN Sync Complete!", "success");
    } catch (e) {
      notify("LAN Sync Failed!", "error");
    }
  };

  // Handle Master IP and Initial Data Fetch for Local Router Sync
  useEffect(() => {
    if (settings.masterIP) {
      const currentHost = window.location.hostname;
      const isRemote = currentHost !== settings.masterIP && currentHost !== 'localhost' && currentHost !== '127.0.0.1';
      
      if (isRemote) {
        const masterURL = `http://${settings.masterIP}:3000`;
        api.setBaseURL(masterURL);
        
        // Fetch fresh data from master server once connected
        if (isLocalConnected && isDataLoaded) {
          handleManualLANSync();
        }
      }
    }
  }, [settings.masterIP, isLocalConnected, isDataLoaded]);


  const playNotification = (customerName?: string, orderNumber?: number, status?: OrderStatus) => {
    // 1. Play the tune first
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.warn("Audio play blocked:", e));
    }

    // 2. Announcements
    if ('speechSynthesis' in window) {
      let text = '';
      if (status === 'ready') {
        if (orderNumber && customerName) {
          text = `Order number ${orderNumber} for ${customerName} is ready`;
        } else if (orderNumber) {
          text = `Order number ${orderNumber} is ready`;
        } else if (customerName) {
          text = `Order for ${customerName} is ready`;
        }
      } else {
        // Default new order announcement
        if (orderNumber && customerName) {
          text = `New order number ${orderNumber} for ${customerName}`;
        } else if (customerName) {
          text = `New order for ${customerName}`;
        }
      }

      if (text && settings.enableVoiceAnnouncement !== false) {
        // Small delay to let the tune start playing
        setTimeout(() => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;
          window.speechSynthesis.speak(utterance);
        }, 300);
      }
    }
  };

  // Watch for new orders to play sound and AUTO-PRINT
  useEffect(() => {
    if (orders.length > prevOrdersRef.current.length) {
      const newOrder = orders[0];
      if (newOrder && (newOrder.status === 'received' || newOrder.status === 'pending_customer')) {
        // Only auto-print if the order is fresh (within last 60 seconds) to avoid double printing on refresh
        const isFresh = (Date.now() - newOrder.timestamp) < 60000;
        if (!isFresh) return;
        // Notification logic
        const isMyOrder = !activeStaff || activeStaff.role === 'kitchen' || isAdmin || (activeStaff.id === newOrder.orderTakerId);
        if (isMyOrder) {
          playNotification(newOrder.customerName);
        }

        // Direct Auto-Print for new orders received via cloud (if we are the printer)
        if (isPrinterDevice && settings.enableKitchenPrinting && settings.isAutoPrintKitchenEnabled) {
          if (newOrder.id !== lastPrintedOrderIdRef.current) {
            handlePrintKitchen(newOrder);
          }
        }
      }
    }
    prevOrdersRef.current = orders;
  }, [orders, activeStaff, isAdmin, isPrinterDevice, settings.isAutoPrintKitchenEnabled, settings.enableKitchenPrinting]);



  const handlePrintBill = (order: Order) => {
    try {
      if (settings.enableBillPrinting === false) {
        console.log("Bill Printing is disabled in Settings!");
        return;
      }
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
                  margin: 0;
                  padding: 0;
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
          <body>
            <div style="font-family: 'Courier New', Courier, monospace; color: black; background: white; width: 100%; box-sizing: border-box; padding: 0;">

              <div style="text-align: center; border-bottom: 4px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
                <p style="margin: 0; font-size: 16px; letter-spacing: 2px; font-weight: 900;">${t.kitchen} ORDER</p>
              </div>

              <div style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 8px 0; margin-bottom: 10px; font-size: 11px; line-height: 1.5;">
                <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; background: #eee; padding: 4px; margin-bottom: 5px;">
                  <span>${t.orderNo}: #${order.orderNumber || '00'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                  <span><b>${t.date}:</b> ${new Date(order.timestamp).toLocaleDateString()}</span>
                  <span><b>${t.time}:</b> ${new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style="margin-top: 4px;">
                  <b>${t.customer}:</b> ${order.customerName.toUpperCase()}
                </div>
                ${order.tableNumber ? `<div><b>${t.table}:</b> ${order.tableNumber.toUpperCase()}</div>` : ''}
              </div>

              <div style="margin-bottom: 15px;">
                ${itemsHtml}
              </div>

              <div style="border-top: 1px solid #000; padding-top: 8px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                  <span>${t.subtotal}:</span>
                  <span>Rs.${order.subtotal.toFixed(0)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 20px; margin-top: 10px; border: 2px solid #000; padding: 8px; text-align: center;">
                  <span style="flex: 1;">${t.total}:</span>
                  <span style="flex: 1; text-align: right;">Rs.${order.total.toFixed(0)}</span>
                </div>
              </div>

              <div style="text-align: center; margin-top: 25px; border-top: 1px dashed #000; padding-top: 15px;">
                <p style="margin: 0; font-size: 12px; font-weight: bold;">${t.thankYou}</p>
              </div>
            </div>
          </body>
        </html>
      `;

      // Create hidden iframe for silent printing
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const printDocument = iframe.contentDocument || iframe.contentWindow?.document;
      if (!printDocument) return;

      printDocument.open();
      printDocument.write(printHtml);
      printDocument.close();

      // Print after a short delay
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        // Remove iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    } catch (e) {
      console.error("Print Bill Error:", e);
    }
  };

  const handlePrintKitchenTicket = (order: Order) => {
    try {
      const language = settings.language || 'english';
      const t = PRINT_TRANSLATIONS[language as keyof typeof PRINT_TRANSLATIONS] || PRINT_TRANSLATIONS.english;
      const itemsHtml = order.items.map(item => `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #000; padding: 10px 0; font-size: 18px; font-weight: 900; font-family: 'Courier New', Courier, monospace;">
          <div style="flex: 1; text-align: left;">
            ${item.name.toUpperCase()}
          </div>
          <div style="width: 50px; text-align: right;">
            x${item.quantity}
          </div>
        </div>
      `).join('');

      const printHtml = `
        <html>
          <head>
            <title>Kitchen Ticket</title>
            <style>
              @page { size: 58mm auto; margin: 0; }
              body { font-family: 'Courier New', Courier, monospace; color: black; background: white; width: 58mm; margin: 0; padding: 0; }
              .circle-container { display: flex; justify-content: center; margin: 15px 0; }
              .circle { 
                width: 48px; 
                height: 48px; 
                background: black; 
                color: white; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-weight: 900;
                border: 2px solid black;
              }
              .circle-number { font-size: 24px; line-height: 1; }
            </style>
          </head>
          <body>
            <div style="padding: 5px; width: 100%; box-sizing: border-box;">
              <div style="text-align: center; border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 12px;">
                <h1 style="margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 0px; white-space: nowrap;">AKBER TIKKA KITCHEN</h1>
                <p style="margin: 4px 0 0; font-size: 16px; font-weight: bold;">Order #${order.orderNumber}</p>
              </div>

              ${order.tableNumber ? `
                <div style="text-align: center; margin: 10px 0; font-size: 24px; font-weight: 900; border-bottom: 2px solid #000; padding-bottom: 5px;">
                  TABLE: ${order.tableNumber.toUpperCase()}
                </div>
              ` : `
                <div style="text-align: center; font-size: 14px; font-weight: bold; border: 2px solid black; padding: 5px; margin: 5px 0; background: #000; color: #fff;">
                  WALK-IN / TAKEAWAY
                </div>
              `}

              <div style="border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; font-size: 12px; font-weight: bold;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 4px;">
                   <span>${new Date(order.timestamp).toLocaleDateString()}</span>
                   <span>${new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style="font-size: 14px; margin-top: 5px;">
                   <b>CUSTOMER:</b> ${order.customerName.toUpperCase()}
                </div>
                ${order.kitchenNotes ? `
                  <div style="margin-top: 10px; font-size: 18px; background: #fff; color: #000; padding: 10px; border-radius: 8px; text-align: center; border: 3px solid #000; line-height: 1.2;">
                    <div style="font-size: 10px; margin-bottom: 4px; border-bottom: 2px solid #000; padding-bottom: 2px; font-weight: 900;">!!! INSTRUCTION !!!</div>
                    ${order.kitchenNotes.toUpperCase()}
                  </div>
                ` : ''}
              </div>

              <div style="margin-bottom: 25px;">
                ${itemsHtml}
              </div>

              <div style="text-align: center; border-top: 2px dashed #000; padding-top: 15px;">
                <p style="margin: 0; font-size: 14px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">ORDER TAKER: ${order.orderTakerName || 'OWNER'}</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(printHtml);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 500);
      }
    } catch (e) {
      console.error("Kitchen Print Error:", e);
    }
  };

  useEffect(() => {
    if (settings.notificationSoundUrl && audioRef.current) {
      audioRef.current.src = settings.notificationSoundUrl;
      audioRef.current.load();
    }
  }, [settings.notificationSoundUrl]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.fontSize = `${settings.fontSizeNumber || 16}px`;
    body.classList.remove('font-inter', 'font-oswald', 'font-courier', 'font-roboto', 'font-serif');
    body.classList.add(`font-${settings.fontFamily || 'inter'}`);
  }, [settings.fontSizeNumber, settings.fontFamily]);

  useEffect(() => {
    const localData = localStorage.getItem('business_crm_local_db');
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        setItems(parsed.items || INITIAL_ITEMS);
        setOrders(parsed.orders || []);
        setPurchases(parsed.purchases || []);
        setCustomers(parsed.customers || []);
        setSuppliers(parsed.suppliers || []);
        setSupplierCategories(parsed.supplierCategories || [
          { id: '1', name: 'MEAT' },
          { id: '2', name: 'VEGETABLES' },
          { id: '3', name: 'GENERAL STORE' }
        ]);
        setStockCategories(parsed.stockCategories || []);
        setStockLogs(parsed.stockLogs || []);
        setKhataTransactions(parsed.khataTransactions || []);
        setStaffMembers(parsed.staffMembers || []); // Load staffMembers from local storage
        
        // Try to load cached orders from IndexedDB (Priority over localStorage)
        offlineDB.getCachedOrders().then(cachedOrders => {
          if (cachedOrders.length > 0) {
            setOrders(cachedOrders.sort((a, b) => b.timestamp - a.timestamp));
          }
        });

        const savedAccounts = parsed.globalAccounts || [];

        const hasTT = savedAccounts.some((a: ShopAccount) => a.id.toUpperCase() === 'TT');
        if (!hasTT) {
          setGlobalAccounts([...globalAccounts, ...savedAccounts]);
        } else {
          setGlobalAccounts(savedAccounts);
        }
        if (parsed.settings) setSettings(prev => ({ ...prev, ...parsed.settings }));
      } catch (e) {
        console.error("Local load failed", e);
        setItems(INITIAL_ITEMS);
      }
    } else {
      // We will try fetching from API instead of INITIAL_ITEMS blindly later
      // setItems(INITIAL_ITEMS);
    }

    // Fetch local items and detect Master IP
    let detectionRetries = 0;
    const initLocalSync = async () => {
      try {
        const res = await fetch('/api/info');
        if (res.ok) {
          const info = await res.json();
          if (info && info.localIP) {
            console.log("Master Server Detected:", info.localIP);
            setServerInfo(info);
            setIsLocalConnected(true);
            
            // If we are the Master PC, ensure our settings reflect our local IP
            if (settings.masterIP !== info.localIP) {
               setSettings(prev => {
                 const newSettings = { ...prev, masterIP: info.localIP };
                 // Prime the local server with our settings
                 api.saveSettings(newSettings).catch(() => {});
                 return newSettings;
               });
            }

            // Auto-set Printer Mode ONLY for the Master PC (localhost/127.0.0.1)
            const currentHost = window.location.hostname;
            const isActuallyMaster = currentHost === 'localhost' || currentHost === '127.0.0.1';
            
            if (isActuallyMaster) {
              if (localStorage.getItem('is_printer_device') !== 'true') {
                localStorage.setItem('is_printer_device', 'true');
                setIsPrinterDevice(true);
              }
            }

            // Prime the local server with our items if it's empty or we have data
            if (items.length > 0) {
              api.saveItems(items).catch(() => {});
            }

            // If we are online, sync this Master IP to cloud so other devices find us
            if (navigator.onLine) {
              const settingsRef = doc(db, "settings", "app_settings");
              await setDoc(settingsRef, { masterIP: info.localIP }, { merge: true });
            }
          }
        }
      } catch (err) {
        // Not a master device or server not running yet
        if (detectionRetries < 5) {
          detectionRetries++;
          setTimeout(initLocalSync, 5000); // Retry every 5s for the first 5 times
        }
      }

      try {
        const fetchURL = settings.masterIP && window.location.hostname !== settings.masterIP 
          ? `http://${settings.masterIP}:3000/api/items` 
          : '/api/items';

        const res = await fetch(fetchURL);
        if (res.ok) {
          const data = await res.json();
          // Use local items if state is empty
          if (data && data.length > 0) {
            setItems(prev => {
              if (prev.length === 0) {
                 console.log("Loaded Items from Local Server:", data.length);
                 return data;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch items from local/master server", err);
      }

      // Fetch Orders from Local API
      try {
        const fetchOrdersURL = settings.masterIP && window.location.hostname !== settings.masterIP 
          ? `http://${settings.masterIP}:3000/api/orders` 
          : '/api/orders';

        const resOrders = await fetch(fetchOrdersURL);
        if (resOrders.ok) {
          const ordersData = await resOrders.json();
          if (ordersData && ordersData.length > 0) {
            setOrders(prev => {
              if (prev.length === 0) {
                 console.log("Loaded Orders from Local Server:", ordersData.length);
                 return ordersData.sort((a: Order, b: Order) => b.timestamp - a.timestamp);
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch orders from local/master server", err);
      }
    };
    initLocalSync();

    const savedShop = localStorage.getItem('shop_session');
    if (savedShop) {
      try {
        setActiveShop(JSON.parse(savedShop));
      } catch (e) {
        localStorage.removeItem('shop_session');
      }
    }

    const savedTaker = localStorage.getItem('taker_session');
    if (savedTaker) {
      try {
        setActiveStaff(JSON.parse(savedTaker));
      } catch (e) {
        localStorage.removeItem('taker_session');
      }
    }
    setIsDataLoaded(true);

    // Check for customer mode in URL
    const url = new URL(window.location.href);
    if (url.searchParams.get('mode') === 'customer') {
      const token = url.searchParams.get('token');
      const takerId = url.searchParams.get('takerId');

      // Daily Token Validation: Allow current day and previous day for buffer
      const currentDayToken = Math.floor(Date.now() / 86400000);
      const providedToken = parseInt(token || '0');
      const isTokenValid = providedToken === currentDayToken || providedToken === currentDayToken - 1;

      if (isTokenValid) {
        setIsCustomerMode(true);
        setCurrentOrderTakerId(takerId);
        setCurrentTableNumber(url.searchParams.get('table') || url.searchParams.get('t') || '');



        // Hide URL parameters to prevent bookmarking/sharing
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        notify("QR Code Expired! Please scan fresh QR from Waiter.", "error");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    // Check for payment status in URL
    const paymentStatus = url.searchParams.get('payment');
    const orderId = url.searchParams.get('orderId');

    if (paymentStatus === 'success' && orderId) {
      notify("Payment Successful! Order receive ho gaya.", "success");
      // Cleanup URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'cancel') {
      notify("Payment Cancelled. Please try again.", "error");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // snapshotsInSync functionality removed

  // Firebase Real-time Sync and Metadata check
  useEffect(() => {
    if (!isDataLoaded) return;

    // Helper to check metadata
    const handleMetadata = (snapshot: any) => {
      if (snapshot.metadata.hasPendingWrites) {
        setHasPendingWrites(true);
      } else {
        setHasPendingWrites(false);
      }
    };

    // Orders Sync - Removed Firestore listener to keep history strictly local
    // const unsubOrders = onSnapshot(collections.orders, { includeMetadataChanges: true }, (snapshot) => {
    //   handleMetadata(snapshot);
    //   const cloudOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    //   setOrders(cloudOrders.sort((a, b) => b.timestamp - a.timestamp));
    // });

    // Customer sync
    const unsubCustomers = onSnapshot(collections.customers, (snapshot) => {
      const cloudCustomers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(cloudCustomers);
    });

    // Menu Items Sync — Firebase is the single source of truth
    const unsubItems = onSnapshot(collections.items, (snapshot) => {
      const cloudItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
      if (cloudItems.length > 0) {
        // Firebase always wins — update state with the authoritative cloud list
        setItems(cloudItems);

        // Backup to local server if we are connected (Master PC)
        if (isLocalConnected) {
          api.saveItems(cloudItems).catch(() => {});
        }
      }
      // If cloud is empty, keep whatever is already in state (local fallback)
    });

    // App Settings Sync
    const unsubSettings = onSnapshot(collections.settings, (snapshot) => {
      const cloudSettings = snapshot.docs.find(doc => doc.id === 'app_settings')?.data() as AppSettings;
      if (cloudSettings) setSettings(prev => ({ ...prev, ...cloudSettings }));
    });

    // Other syncs (restored)
    const unsubPurchases = onSnapshot(collections.purchases, (snapshot) => {
      const cloudPurchases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase));
      setPurchases(cloudPurchases.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    });

    const unsubStaff = onSnapshot(collections.staffMembers, (snapshot) => {
      const cloudStaff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffMember));
      setStaffMembers(cloudStaff);
    });

    return () => {
      // unsubOrders(); // Removed
      unsubCustomers();
      unsubItems();
      unsubSettings();
      unsubPurchases();
      unsubStaff();
    };
  }, [isDataLoaded]);
  
  // Prime Local Server with Items whenever they change and we are connected
  useEffect(() => {
    if (isLocalConnected && items.length > 0) {
      api.saveItems(items).catch(() => {});
    }
  }, [items, isLocalConnected]);

  // Local Socket Listener for Offline Sync (Order Travelling)
  useEffect(() => {
    if (!isDataLoaded) return;

    // Listen for new/updated orders from local server
    api.onSync('order_sync', (newOrder: Order) => {
      console.log("Local Order Received (Sync):", newOrder);
      
      const currentOrders = ordersRef.current;
      const currentSettings = settingsRef.current;
      const currentIsPrinter = isPrinterDeviceRef.current;

      const isNewOrder = !currentOrders.find(o => o.id === newOrder.id);
      
      setOrders(prev => {
        const exists = prev.find(o => o.id === newOrder.id);
        if (exists) {
          const isDifferent = JSON.stringify(exists) !== JSON.stringify(newOrder);
          if (!isDifferent) return prev;
          return prev.map(o => o.id === newOrder.id ? newOrder : o);
        }
        return [newOrder, ...prev].sort((a, b) => b.timestamp - a.timestamp);
      });

      // --- SIDE EFFECTS (Sound & Print) ---
      
      // 1. Notification Sound
      playNotification(newOrder.customerName, newOrder.orderNumber, newOrder.status);
      
      // 2. Auto-Print vs Queue Logic (enabled only for designated printer devices, usually the Master PC)
      if (isNewOrder && currentIsPrinter && currentSettings.enableKitchenPrinting && currentSettings.isAutoPrintKitchenEnabled) {
        if (currentSettings.isQueueModeEnabled) {
          // Add to Queue instead of printing
          setKitchenQueue(prev => {
            if (prev.find(o => o.id === newOrder.id)) return prev;
            return [...prev, newOrder];
          });
          notify(`Order #${newOrder.orderNumber} added to Queue`, "info");
        } else if (newOrder.id !== lastPrintedOrderIdRef.current) {
          // Direct Auto-Print
          console.log("AUTO-PRINT TRIGGERED for order:", newOrder.orderNumber);
          handlePrintKitchen(newOrder); 
          lastPrintedOrderIdRef.current = newOrder.id;
        }
      }

      // 3. Visual Notification
      if (isNewOrder) {
        notify(`New Local Order: #${newOrder.orderNumber} (${newOrder.customerName})`, "success");
      }
    });



    api.onSync('order_deleted', (deletedId: string) => {
      setOrders(prev => prev.filter(o => o.id !== deletedId));
    });

    api.onSync('items_sync', (newItems: MenuItem[]) => {
      console.log("Local Items Received (Sync):", newItems.length);
      setItems(prev => {
        if (JSON.stringify(prev) === JSON.stringify(newItems)) return prev;
        return newItems;
      });
    });

    // Master IP logic moved to dedicated effect for reliability
  }, [isDataLoaded, settings.masterIP]);





  // Sync Local Changes to Firebase
  const syncToFirebase = async (collectionName: string, data: any[]) => {
    if (data.length === 0) return;
    setIsSyncing(true);
    try {
      for (const item of data) {
        if (item.id) {
          await setDoc(doc(db, collectionName, item.id), safeSanitize(item));
        }
      }
    } catch (e) {
      console.error(`Firebase sync failed for ${collectionName}:`, e);
    } finally {
      setTimeout(() => setIsSyncing(false), 1000);
    }
  };

  const calculateTotalDataSize = () => {
    try {
      const stateToSave = {
        items, orders, purchases, customers, suppliers, supplierCategories, stockCategories, stockLogs, khataTransactions, globalAccounts, settings, staffMembers
      };
      const size = new Blob([JSON.stringify(stateToSave)]).size;
      setDataSize(size);
      if (size >= 1024 * 1024 * 1024) { // 1GB
        setShowDataWarning(true);
      } else {
        setShowDataWarning(false);
      }
    } catch (e) {
      console.error("Size calculation failed", e);
    }
  };

  useEffect(() => {
    if (!isDataLoaded) return;
    // Only save to localStorage for offline resilience.
    // All Firebase writes happen directly at the mutation callsite.
    const stateToSave = safeSanitize({
      items, orders, purchases, customers, suppliers, supplierCategories, stockCategories, stockLogs, khataTransactions, globalAccounts, settings, staffMembers, lastUpdated: Date.now()
    });
    localStorage.setItem('business_crm_local_db', JSON.stringify(stateToSave));
    localStorage.setItem('app_active_tab', activeTab);
    calculateTotalDataSize();
  }, [items, orders, purchases, customers, suppliers, supplierCategories, stockCategories, stockLogs, khataTransactions, globalAccounts, settings, staffMembers, activeTab, isDataLoaded]);

  const getNextOrderNumber = () => {
    if (orders.length === 0) return 1;
    return Math.max(...orders.map(o => o.orderNumber || 0)) + 1;
  };

  const handleOrderComplete = async (order: Order) => {
    try {
      const enrichedOrder = {
        ...order,
        orderNumber: order.orderNumber || getNextOrderNumber()
      };

      // 1. LOCAL SYNC FIRST (Important for Offline Travel)
      await offlineDB.savePendingSync({
        id: enrichedOrder.id,
        data: enrichedOrder,
        type: 'order',
        timestamp: Date.now()
      });
      await offlineDB.cacheOrder(enrichedOrder);

      // Attempt immediate local server push
      api.saveOrder(enrichedOrder).then(() => {
        offlineDB.deletePendingSyncItem(enrichedOrder.id);
      }).catch(() => {
        console.log("Local server sync pending (will retry)");
      });

      // 2. CLOUD SYNC (Removed as per user request to keep history local)
      // setDoc(doc(db, "orders", enrichedOrder.id), safeSanitize(enrichedOrder)).catch(() => {
      //   console.log("Cloud sync pending (Offline mode)");
      // });

      // 3. Update Local State Immediately (for speed & offline)
      setOrders(prev => {
        const exists = prev.find(o => o.id === enrichedOrder.id);
        if (exists) return prev.map(o => o.id === enrichedOrder.id ? enrichedOrder : o);
        return [enrichedOrder, ...prev].sort((a, b) => b.timestamp - a.timestamp);
      });

      // Customer record upsert
      if (order.customerPhone && order.customerPhone.trim().length > 5) {
        const existingCustomer = customers.find(c => c.phone === order.customerPhone);
        const udhaarAmount = order.paymentMethod === 'khata' ? order.total : 0;
        const customerDoc = {
          id: existingCustomer?.id || order.customerPhone,
          name: order.customerName || existingCustomer?.name || 'WALK-IN',
          phone: order.customerPhone,
          whatsappNumber: order.customerPhone,
          tableNumber: order.tableNumber || existingCustomer?.tableNumber,
          totalOrders: (existingCustomer?.totalOrders || 0) + 1,
          totalSpent: (existingCustomer?.totalSpent || 0) + order.total,
          lastVisit: order.timestamp,
          balance: (existingCustomer?.balance || 0) + udhaarAmount
        };
        setDoc(doc(db, "customers", customerDoc.id), safeSanitize(customerDoc)).catch(() => {});
      }

      notify("Order Sent Successfully!", "success");
    } catch (e) {
      console.error(e);
      notify("Error: " + (e as Error).message, "error");
    }
  };



  const handleUpdateOrder = async (uo: Order) => {
    const existingOrder = orders.find(o => o.id === uo.id);
    const statusChanged = existingOrder && existingOrder.status !== uo.status;

    // 1. LOCAL SYNC FIRST
    await offlineDB.savePendingSync({
      id: uo.id,
      data: uo,
      type: 'update',
      timestamp: Date.now()
    });
    await offlineDB.cacheOrder(uo);

    api.saveOrder(uo).then(() => {
      offlineDB.deletePendingSyncItem(uo.id);
    }).catch(() => {});

    // 2. CLOUD SYNC (Removed to keep history local)
    // setDoc(doc(db, "orders", uo.id), safeSanitize(uo)).catch(() => {
    //   console.log("Cloud sync pending (Update)");
    // });

    // 3. Update Local State Immediately
    setOrders(prev => prev.map(o => o.id === uo.id ? uo : o));

    if (statusChanged) {
      playNotification(uo.customerName, uo.orderNumber, uo.status);
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setActiveShop(null);
    setActiveStaff(null);
    localStorage.removeItem('shop_session');
    localStorage.removeItem('taker_session');
    setActiveTab('bill');
    setIsCustomerMode(true);
    notify("Logged out successfully", "info");
  };

  const handlePrint = (order: Order, isFinalBill: boolean = false) => {
    handlePrintBill(order);
  };

  const handlePrintKitchen = (order: Order) => {
    lastPrintedOrderIdRef.current = order.id;
    handlePrintKitchenTicket(order);
  };

  const handleUpdateShop = async (updatedShop: ShopAccount) => {
    setGlobalAccounts(prev => prev.map(s => s.id === updatedShop.id ? updatedShop : s));
    try {
      const settingsRef = doc(db, "settings", "app_settings");
      const updatedAccounts = globalAccounts.map(s => s.id === updatedShop.id ? updatedShop : s);
      await updateDoc(settingsRef, { shopAccounts: updatedAccounts });
      notify("Shop updated successfully", "success");
    } catch (e) {
      console.error("Failed to update shop in cloud:", e);
    }
  };

  const handleResetData = async () => {
    if (confirm("Are you sure you want to reset all data? This cannot be undone.")) {
      localStorage.clear();
      setOrders([]);
      setItems(INITIAL_ITEMS);
      notify("Data reset successfully", "info");
      window.location.reload();
    }
  };

  const handleCustomerMenuLogin = async (name: string, phone: string) => {
    try {
      if (!name || !phone) return;
      const isExisting = customers.some(c => c.phone === phone);
      
      const customerData: Customer = {
        id: phone,
        name,
        phone,
        balance: 0,
        lastVisit: Date.now(),
        totalOrders: 0,
        totalSpent: 0
      };
      
      if (!isExisting) {
        // Save new customer to Local API
        await api.saveCustomer(customerData);
      }

      setCurrentCustomer({ name, phone });
      
      if (isExisting) {
        const randomMsg = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
        notify(randomMsg, "success");
      } else {
        notify(`Khush Amdeed, ${name}!`, "success");
      }
    } catch (e) {
      notify("Login failed!", "error");
    }
  };

  const handleExportData = async () => {
    try {
      const data = {
        items, orders, purchases, customers, supplierCategories, stockCategories, stockLogs, khataTransactions, globalAccounts, settings, staffMembers,
        version: '1.0',
        exportDate: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
      const fileName = `Data_${dateStr}.json`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setIsSyncing(true);
      const snap = await getDocs(collection(db, "customers"));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, "customers", d.id));
      }
      setCustomers([]);
      setIsSyncing(false);
      
      notify("Backup Downloaded & Customer Data Reset!", "success");
    } catch (e) {
      setIsSyncing(false);
      notify("Export/Reset failed: " + (e as Error).message, "error");
    }
  };

  const handleImportData = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.items) setItems(json.items);
        if (json.orders) setOrders(json.orders);
        if (json.purchases) setPurchases(json.purchases);
        if (json.customers) setCustomers(json.customers);
        if (json.supplierCategories) setSupplierCategories(json.supplierCategories);
        if (json.stockCategories) setStockCategories(json.stockCategories);
        if (json.stockLogs) setStockLogs(json.stockLogs);
        if (json.khataTransactions) setKhataTransactions(json.khataTransactions);
        if (json.globalAccounts) setGlobalAccounts(json.globalAccounts);
        if (json.settings) setSettings(prev => ({ ...prev, ...json.settings }));
        if (json.staffMembers) setStaffMembers(json.staffMembers); // Import staffMembers
        notify("Data Restored Successfully!", "success");
      } catch (err) {
        notify("Invalid Backup File!", "error");
      }
    };
    reader.readAsText(file);
  };
  if (isCustomerMode) {
    if (!isDataLoaded) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black uppercase tracking-widest animate-pulse">Loading Menu...</div>;

    return (
      <div className={`min-h-screen theme-${settings.theme}`}>
        {!currentCustomer ? (
          <CustomerLogin
            onLogin={handleCustomerMenuLogin}
            onExit={() => setIsCustomerMode(false)}
            onStaffLogin={() => {
              setIsCustomerMode(false);
              setShowLogin(true);
            }}
          />
        ) : (
          <CustomerMenu
            items={items.length > 0 ? items : INITIAL_ITEMS}
            businessName={settings.businessName}
            customerName={currentCustomer.name}
            customerPhone={currentCustomer.phone}
            customerOrders={orders.filter(o => o.customerPhone === currentCustomer.phone)}
            tableNumber={currentTableNumber}
            onSendOrder={async (order) => {
              if (!activeStaff && !activeShop && !isAdmin) {
                notify("Sirf Staff hi order finalize kar sakte hain.", "error");
                return;
              }
              const takerName = staffMembers.find(s => s.id === (currentOrderTakerId || activeStaff?.id))?.name || (activeStaff?.name) || 'Unknown';
              const enrichedOrder: Order = {
                ...order,
                status: 'pending_customer',
                orderNumber: getNextOrderNumber(),
                orderTakerId: currentOrderTakerId || activeStaff?.id,
                orderTakerName: takerName,
                tableNumber: order.tableNumber || currentTableNumber
              };
              setOrders([enrichedOrder, ...orders]);
              await api.saveOrder(enrichedOrder);
              notify(`Order sent to ${takerName}!`, "success");

            }}
            onUpdateOrder={handleUpdateOrder}
            onLogout={() => {
              setIsCustomerMode(false);
              setCurrentCustomer(null);
              setCurrentOrderTakerId(null);
            }}
          />
        )}
        {toast && (
          <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[10000] px-6 py-3 rounded-2xl shadow-2xl font-black uppercase text-[10px] tracking-widest animate-in slide-in-from-top duration-300 ${toast.type === 'success' ? 'bg-emerald-600 text-white' :
              toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'
            }`}>
            {toast.message}
          </div>
        )}
      </div>
    );
  }

  const onUpdateShop = (updatedShop: ShopAccount) => {
    setGlobalAccounts(prev => prev.map(shop => shop.id === updatedShop.id ? updatedShop : shop));
    if (activeShop && activeShop.id === updatedShop.id) {
      setActiveShop(updatedShop);
      localStorage.setItem('shop_session', JSON.stringify(updatedShop));
    }
  };

const WELCOME_MESSAGES = [
  "Welcome back! Thank you for choosing us again! ✨",
  "Humare menu mein aapka phir se khush amdeed! 🌸",
  "It's great to see you again! What would you like today? 🍔",
  "Welcome back! We hope you're having a great day! 😊",
  "Nice to see a familiar face! Enjoy your meal! ☕",
  "Aapka dobara aany ka shukria! Welcome back! ❤️"
];
  const handleHeadingClick = () => {
    setHeadingClicks(prev => {
      const next = prev + 1;
      if (next >= HEADING_CLICKS_REQUIRED) {
        setShowAdminPanelButton(true);
        notify("Admin Access Unlocked", "success");
        return 0;
      }
      return next;
    });
  };

  const navigateTo = (tab: TabType) => {
    // Admin has full access
    if (isAdmin) {
      setActiveTab(tab);
      return;
    }

    // Staff access
    if (activeStaff) {
      if (activeStaff.role === 'taker') {
        const allowed = ['bill', 'orders'];
        if (allowed.includes(tab)) {
          setActiveTab(tab);
        } else {
          notify("Aapko is section ki access nahi hai", "error");
        }
        return;
      }
      if (activeStaff.role === 'kitchen') {
        if (tab === 'orders') {
          setActiveTab(tab);
        } else {
          notify("Kitchen staff sirf Orders dekh sakte hain", "error");
        }
        return;
      }
      if (activeStaff.role === 'cashier') {
        const allowed = ['cashier', 'orders'];
        if (allowed.includes(tab)) {
          setActiveTab(tab);
        } else {
          notify("Cashier sirf Payment aur Orders dekh sakte hain", "error");
        }
        return;
      }
      return;
    }

    // Shop Owner access
    if (activeShop) {
      setActiveTab(tab);
      return;
    }

    const isRestricted = ['dashboard', 'inventory', 'menu', 'history', 'cashier'].includes(tab);
    if (isRestricted) {
      setShowLogin(true);
      return;
    }

    setActiveTab(tab);
  };

  const handlePrintQR = (taker: StaffMember) => {
    try {
      const language = settings.language || 'english';
      const t = PRINT_TRANSLATIONS[language];
      const dailyToken = Math.floor(Date.now() / 86400000);
      const baseUrl = window.location.href.split('?')[0].split('#')[0];
      const qrUrl = `${baseUrl}?mode=customer&takerId=${taker.id}&token=${dailyToken}${qrTableNumber ? `&table=${qrTableNumber}` : ''}`;

      // Use a temporary canvas to get QR as image
      const canvas = document.querySelector('canvas');
      const qrImage = canvas ? canvas.toDataURL("image/png") : '';

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
                  margin: 0;
                  padding: 0;
                }
              }
              body {
                font-family: Arial, sans-serif;
                text-align: center;
                color: black;
                background: white;
                margin: 0;
                padding: 0;
              }
            </style>
          </head>
          <body onload="window.print()">
            <div style="font-family: 'Courier New', Courier, monospace; color: black; background: white; width: 100%; box-sizing: border-box; padding: 0;">
              <div style="text-align: center; margin-bottom: 15px;">
                <h1 style="margin: 0; font-size: 22px; text-transform: uppercase; font-weight: 900;">${settings.businessName}</h1>
                <p style="margin: 2px 0; font-size: 10px; letter-spacing: 3px; font-weight: bold;">*** ${t.invoice} ***</p>
              </div>

              <div style="background: #000; color: #fff; padding: 15px; border-radius: 12px; margin-top: 10px;">
                <p style="margin: 0; font-size: 12px; font-weight: bold; opacity: 0.7;">${t.table} NUMBER</p>
                <p style="margin: 0; font-size: 42px; font-weight: 900;">${qrTableNumber || 'GEN'}</p>
              </div>

              <p style="margin: 20px 0 0; font-size: 9px; font-weight: bold; text-transform: uppercase;">Waiter: ${taker.name}</p>
              <p style="margin: 5px 0 0; font-size: 8px; color: #888;">Valid for Today Only: ${new Date().toLocaleDateString()}</p>
            </div>
          </body>
        </html>
      `;

      // Create hidden iframe for silent printing
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const printDocument = iframe.contentDocument || iframe.contentWindow?.document;
      if (!printDocument) return;

      printDocument.open();
      printDocument.write(printHtml);
      printDocument.close();

      // Print after a short delay
      setTimeout(() => {
        iframe.contentWindow?.print();
        // Remove iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
      notify("QR Code printing...", "success");
    } catch (e) {
      notify("Print failed: " + (e as Error).message, "error");
    }
  };

  const currentDisplayName = settings.businessName;

  return (
    <div className={`min-h-screen flex flex-col pb-24 overflow-x-hidden theme-${settings.theme} bg-[#080808] p-2`}>
      {/* Toast Notification */}
      {showTakerQR && activeStaff && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[50000] flex items-center justify-center p-6 animate-in fade-in zoom-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-white/5 p-10 w-full max-w-sm text-center space-y-8 shadow-2xl border-b-8 border-b-orange-600">
            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Menu QR Code</h3>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Scan to view digital menu</p>
            </div>

            <div className="bg-white p-6 rounded-[32px] inline-block shadow-inner">
              <QRCodeCanvas
                value={`${window.location.href.split('?')[0].split('#')[0]}?mode=customer&takerId=${activeStaff.id}&token=${Math.floor(Date.now() / 86400000)}${qrTableNumber ? `&table=${qrTableNumber}` : ''}`}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                   <p className="text-[8px] font-black text-orange-600 uppercase tracking-widest ml-4 text-left">Assign Table</p>
                   <input 
                     type="text" 
                     placeholder="Table #" 
                     className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black text-center outline-none focus:border-orange-600 uppercase"
                     value={qrTableNumber}
                     onChange={e => setQrTableNumber(e.target.value)}
                   />
                </div>
                <div className="flex-1 space-y-1">
                   <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest ml-4 text-left">Staff</p>
                   <div className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black text-center text-xs overflow-hidden truncate">
                     {activeStaff.name}
                   </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTakerQR(false)}
                  className="flex-1 py-5 bg-white/5 text-white rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all text-[10px]"
                >
                  Close
                </button>
                <button
                  onClick={() => handlePrintQR(activeStaff)}
                  className="flex-[2] py-5 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-orange-600/20 flex items-center justify-center gap-2 text-[10px]"
                >
                  {ICONS.Printer} Print QR Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline/Sync Banner */}
      {(!isOnline || hasPendingWrites || pendingCount > 0 || isLocalConnected) && (
        <div className={`fixed top-0 left-0 right-0 z-[1000] px-4 py-1.5 text-center text-[9px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-between gap-2 ${
          !isOnline ? 'bg-rose-600 text-white' : isLocalConnected ? 'bg-blue-600/90 backdrop-blur-md text-white' : 'bg-orange-600 text-white animate-pulse'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-white/40'} ${isOnline ? 'animate-pulse' : ''}`} />
            <span>{isOnline ? 'Cloud: Online' : 'Cloud: Offline'}</span>
          </div>

          <div className="flex-1 text-center">
            {!isOnline ? (
              <span>⚠️ Local Mode Active</span>
            ) : pendingCount > 0 ? (
              <span>🔄 Syncing {pendingCount} changes...</span>
            ) : (
              <span>{settings.businessName}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span>{isLocalConnected ? `LAN: ${serverInfo?.localIP}` : 'LAN: Disconnected'}</span>
            {isLocalConnected && (
               <button 
                 onClick={handleManualLANSync}
                 className="p-1 hover:bg-white/20 rounded-md transition-colors"
                 title="Force LAN Data Refresh"
               >
                 {ICONS.RotateCcw}
               </button>
            )}
            <div className={`w-1.5 h-1.5 rounded-full ${isLocalConnected ? 'bg-emerald-400' : 'bg-white/40'} ${isLocalConnected ? 'animate-pulse' : ''}`} />
          </div>
        </div>
      )}


      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[51000] w-full max-w-xs px-4 pointer-events-none">
          <div className={`p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 pointer-events-auto border border-white/10 ${toast.type === 'success' ? 'bg-emerald-600 text-white' :
              toast.type === 'error' ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white'
            }`}>
            <div className="shrink-0">{toast.type === 'error' ? ICONS.X : ICONS.Shield}</div>
            <p className="font-black uppercase text-[10px] tracking-widest">{toast.message}</p>
          </div>
        </div>
      )}


      {/* Main UI - Only show if authenticated or in Customer Mode */}
      {(!activeStaff && !activeShop && !isAdmin && !isCustomerMode) ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-6 animate-in fade-in zoom-in duration-700">
            <div className="w-24 h-24 bg-orange-600/10 text-orange-600 rounded-[32px] mx-auto flex items-center justify-center text-5xl mb-4 border border-orange-600/20 shadow-2xl">
              {ICONS.Shield}
            </div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white underline decoration-orange-600 underline-offset-8">Welcome</h2>
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">Please login to access the system</p>
            <button 
              onClick={() => setShowLogin(true)}
              className="mt-8 px-12 py-5 bg-orange-600 text-white rounded-[24px] font-black uppercase tracking-widest shadow-2xl shadow-orange-600/40 active:scale-95 transition-all text-sm"
            >
              Login Now
            </button>
          </div>
        </div>
      ) : (
        <>
          <header className="bg-[var(--bg-nav)]/80 backdrop-blur-xl p-2 shadow-lg flex justify-between items-center sticky top-0 z-[100] border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <div className="w-10">
                {showAdminPanelButton && !isAdmin && (
                  <button onClick={() => setShowLogin(true)} className="p-3 bg-orange-600 text-white rounded-xl shadow-lg animate-bounce">{ICONS.Lock}</button>
                )}
                {(activeShop || isAdmin) && (
                  <button onClick={handleLogout} className="p-2 text-red-500 bg-red-500/10 rounded-lg hover:bg-red-500/20 active:scale-90 transition-all">{ICONS.LogOut}</button>
                )}
                {activeStaff && (
                  <button onClick={handleLogout} className="p-2 text-red-500 bg-red-500/10 rounded-lg hover:bg-red-500/20 active:scale-90 transition-all ml-2">{ICONS.LogOut}</button>
                )}
              </div>
              {settings.businessLogo && (
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shadow-md">
                  <img src={settings.businessLogo} className="w-full h-full object-cover" alt="Logo" />
                </div>
              )}
              <h1
                className="text-xl font-black cursor-pointer select-none tracking-tighter uppercase"
                onClick={handleHeadingClick}
              >
                {currentDisplayName}
                {!isTotalsUnlocked && <span className="ml-1 text-[10px] text-yellow-500 align-middle">🔒</span>}
              </h1>
              {isSyncing && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 animate-pulse">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Cloud Sync</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {isInstallable && (
                <button
                  onClick={handleInstallClick}
                  className="px-2 py-1 bg-orange-600 hover:bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg active:scale-95 transition-all border border-orange-500/50"
                >
                  Install App
                </button>
              )}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => window.location.reload()}
                  className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg active:scale-90 transition-all border border-emerald-500/20"
                  title="Manual Sync"
                >
                  {ICONS.Refresh}
                </button>

                {isPrinterDevice && (
                  <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${settings.isAutoPrintKitchenEnabled ? 'bg-emerald-600/10 border-emerald-600 text-emerald-500' : 'bg-white/5 border-white/10 text-gray-400'}`} title={settings.isAutoPrintKitchenEnabled ? "Silent Auto-Print Active" : "Auto-Print Disabled"}>
                    {ICONS.Printer}
                    <span className="text-[7px] font-black uppercase">Kitchen</span>
                  </div>
                )}
                <div
                  className={`flex items-center gap-2 ${activeStaff?.role === 'taker' ? 'cursor-pointer active:scale-95 transition-all' : ''}`}

                onClick={() => {
                  if (activeStaff?.role === 'taker') {
                    setShowTakerQR(true);
                  }
                }}
              >
                <div className={`transition-all duration-700 ${isOnline ? 'text-emerald-500' : 'text-red-500 animate-pulse'}`}>
                  {ICONS.QrCode}
                </div>
                <span className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                  {isAdmin ? 'ADMIN PORTAL' : activeShop ? settings.businessName : activeStaff ? `${activeStaff.role.toUpperCase()}: ${activeStaff.name}` : !isOnline ? 'OFFLINE' : ''}
                </span>
              </div>
            </div>
          </div>
        </header>

          <main className="flex-1 pt-2 px-1 overflow-x-hidden">
            <div className="max-w-md mx-auto">
              {activeShop?.subscriptionStatus === 'expired' && !isAdmin ? (
                <div className="mt-10 p-10 bg-[var(--bg-card)] rounded-[48px] border-2 border-red-500 text-center space-y-8 animate-in zoom-in">
                  <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-3xl mx-auto flex items-center justify-center scale-150 mb-4">{ICONS.X}</div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-[var(--text-main)]">Account Locked</h2>
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Renewal required.</p>
                  <button onClick={handleLogout} className="w-full py-4 bg-white/5 rounded-2xl text-[9px] font-black uppercase tracking-widest text-red-500">Logout</button>
                </div>
              ) : (
                <>
                  {activeTab === 'dashboard' && (
                    <AdminDashboard
                      orders={orders}
                      purchases={purchases}
                      customers={customers}
                      setCustomers={setCustomers}
                      customerPayments={customerPayments}
                      setCustomerPayments={setCustomerPayments}
                      suppliers={suppliers}
                      setSuppliers={setSuppliers}
                      settings={{ ...settings, shopAccounts: globalAccounts }}
                      isAdmin={isAdmin}
                      activeShop={activeShop}
                      onUpdateShop={(s) => { onUpdateShop(s); notify("Shop Updated", "success"); }}
                      setSettings={async (s) => {
                        setSettings(s);
                        if (s.shopAccounts) setGlobalAccounts(s.shopAccounts);
                        // Write settings directly to Firestore
                        await setDoc(doc(db, "settings", "app_settings"), safeSanitize(s));
                      }}
                      onLogout={handleLogout}
                      onNavigateToMenu={() => setActiveTab('menu')}
                      onExportData={handleExportData}
                      onImportData={handleImportData}
                      onAddPurchase={async (p) => {
                        await setDoc(doc(db, "purchases", p.id), safeSanitize(p));
                        notify("Purchase Added", "success");
                      }}
                      onUpdatePurchase={async (up) => {
                        await setDoc(doc(db, "purchases", up.id), safeSanitize(up));
                        notify("Purchase Updated", "success");
                      }}
                      onDeletePurchase={(id) => triggerConfirm({
                        title: "Delete Purchase?",
                        message: "Kya aap waqai is purchase ko delete karna chahte hain?",
                        onConfirm: async () => {
                          await deleteDoc(doc(db, "purchases", id));
                          notify("Purchase Deleted", "error");
                        }
                      })}
                      stockCategories={stockCategories}
                      setStockCategories={setStockCategories}
                      stockLogs={stockLogs}
                      setStockLogs={setStockLogs}
                      khataTransactions={khataTransactions}
                      setKhataTransactions={setKhataTransactions}
                      onResetData={() => triggerConfirm({
                        title: "Reset All CLOUD Data?",
                        message: "Kya aap waqai Cloud se tamaam data (Orders, Purchases, Khata) delete karna chahte hain? Yeh Quota khali karne ke liye zaroori hai.",
                        onConfirm: async () => {
                          setIsSyncing(true);
                          try {
                              const collectionsToClear = [
                                "orders", "purchases", "stockLogs", "khataTransactions", 
                                "customerPayments"
                              ];

                            for (const collName of collectionsToClear) {
                              const snap = await getDocs(collection(db, collName));
                              for (const d of snap.docs) {
                                await deleteDoc(doc(db, collName, d.id));
                              }
                            }

                            // Clear Local State
                            setOrders([]);
                            setPurchases([]);
                            setStockLogs([]);
                            setKhataTransactions([]);
                            setCustomerPayments([]);

                            notify("Cloud Data Cleared! Quota reset ho gaya.", "success");
                          } catch (e) {
                            console.error("Reset failed:", e);
                            notify("Reset failed: " + (e as Error).message, "error");
                          } finally {
                            setIsSyncing(false);
                          }
                        }
                      })}
                      onResetHistory={async () => {
                        setIsSyncing(true);
                        try {
                          const orderSnap = await getDocs(collections.orders);
                          for (const d of orderSnap.docs) {
                            await deleteDoc(doc(db, "orders", d.id));
                          }
                          setOrders([]);
                          notify("Order History Cleared!", "success");
                        } catch (e) {
                          notify("Clear failed: " + (e as Error).message, "error");
                        } finally {
                          setIsSyncing(false);
                        }
                      }}
                      triggerConfirm={triggerConfirm}
                      isTotalsUnlocked={isTotalsUnlocked}
                      onUpdateOrder={handleUpdateOrder}
                      setIsNavHidden={setIsNavHidden}
                      staffMembers={staffMembers}
                      setStaffMembers={setStaffMembers}
                      menuItems={items}
                      setMenuItems={setItems}
                      isSyncing={isSyncing}
                      setIsSyncing={setIsSyncing}
                      isInstallable={isInstallable}
                      onInstall={handleInstallClick}
                      showSecretSlider={showSecretSlider}
                      setShowSecretSlider={setShowSecretSlider}
                      isPrinterDevice={isPrinterDevice}
                      setIsPrinterDevice={setIsPrinterDevice}
                    />
                  )}
                  {activeTab === 'menu' && (
                    <MenuManagement 
                      items={items} 
                      setItems={setItems} 
                      isAdmin={isAdmin || !!activeShop} 
                      onClose={() => setActiveTab('dashboard')}
                      setIsNavHidden={setIsNavHidden}
                    />
                  )}
                  {activeTab === 'bill' && (
                    <POS
                      isCustomerMode={isCustomerMode}
                      items={items}
                      customers={customers}
                      settings={settings}
                      shopName={activeShop?.shopName}
                      activeStaff={activeStaff}
                      pendingOrders={orders.filter(o => 
                        (o.status === 'pending_customer' || o.status === 'draft') && 
                        (!activeStaff || activeStaff.role === 'kitchen' || isAdmin || o.orderTakerId === activeStaff.id)
                      )}
                      allOrders={orders.filter(o => 
                        !activeStaff || activeStaff.role === 'kitchen' || isAdmin || o.orderTakerId === activeStaff.id
                      )}
                      onOrderComplete={handleOrderComplete}
                      orderToEdit={orderToEdit}
                      onClearOrderToEdit={() => setOrderToEdit(null)}
                      onUpdateOrder={handleUpdateOrder}
                      onDeleteOrder={(id) => triggerConfirm({
                        title: "Cancel Order?",
                        message: "Kya aap waqai is order ko cancel karna chahte hain?",
                        onConfirm: async () => {
                          const orderToCancel = orders.find(o => o.id === id);
                          if (orderToCancel) {
                            const updated = { ...orderToCancel, status: 'cancelled' as OrderStatus };
                            setOrders(prev => prev.map(o => o.id === id ? updated : o));
                            api.saveOrder(updated).catch(() => {});
                            await setDoc(doc(db, "orders", id), { status: 'cancelled' }, { merge: true });
                            notify("Order Cancelled", "error");
                          }
                        }
                      })}
                      notify={notify}
                      triggerConfirm={triggerConfirm}
                      setIsNavHidden={setIsNavHidden}
                      isAdmin={isAdmin || !!activeShop}
                      initialTableNumber={currentTableNumber}
                      handlePrint={handlePrint}
                      handlePrintKitchen={handlePrintKitchen}
                      currentOrderTakerId={currentOrderTakerId}
                    />
                  )}
                  {activeTab === 'history' && (
                    <HistoryView
                      orders={isCustomerMode && currentCustomer 
                        ? orders.filter(o => o.customerPhone === currentCustomer.phone) 
                        : orders}
                      customers={customers}
                      settings={settings}
                      purchases={purchases}
                      activeStaff={activeStaff}
                      onUpdateOrder={handleUpdateOrder}
                      onUpdatePurchase={(up) => setPurchases(purchases.map(p => p.id === up.id ? up : p))}
                      onDeleteOrder={(id) => triggerConfirm({
                        title: "Delete Order?",
                        message: "Kya aap waqai is order ko delete karna chahte hain?",
                        onConfirm: async () => {
                          setOrders(prev => prev.filter(o => o.id !== id));
                          api.deleteOrder(id).catch(() => {});
                          // await deleteDoc(doc(db, "orders", id)); // Disabled cloud delete
                          notify("Order Deleted", "error");
                        }
                      })}
                      onDeletePurchase={(id) => triggerConfirm({
                        title: "Delete Purchase?",
                        message: "Kya aap waqai is purchase ko delete karna chahte hain?",
                        onConfirm: () => {
                          setPurchases(prev => prev.filter(p => p.id !== id));
                          notify("Purchase Deleted", "error");
                        }
                      })}
                      onEditOrder={(order) => {
                        setOrderToEdit(order);
                        setActiveTab('bill');
                      }}
                      onResetHistory={() => triggerConfirm({
                        title: "Clear History?",
                        message: "Kya aap waqai poori history clear karna chahte hain?",
                        onConfirm: async () => {
                          setIsSyncing(true);
                          try {
                            // Cloud delete disabled
                            // const orderSnap = await getDocs(collections.orders);
                            // for (const d of orderSnap.docs) {
                            //   await deleteDoc(doc(db, "orders", d.id));
                            // }
                            
                            // Delete from local server API (Need to implement bulk delete or loop)
                            for (const o of orders) {
                              api.deleteOrder(o.id).catch(() => {});
                            }
                            setOrders([]);
                            notify("History Cleared", "success");
                          } catch (e) {
                            notify("Clear failed", "error");
                          } finally {
                            setIsSyncing(false);
                          }
                        }
                      })}
                      isAdmin={isAdmin || !!activeShop}
                      notify={notify}
                      triggerConfirm={triggerConfirm}
                      isTotalsUnlocked={isTotalsUnlocked}
                      staffMembers={staffMembers}
                    />
                  )}
                  {activeTab === 'orders' && (
                    <LiveOrdersView
                      orders={orders}
                      activeStaff={activeStaff}
                      settings={settings}
                      notify={notify}
                      onUpdateStatus={async (order, status) => {
                        const updatedOrder = {
                          ...order,
                          status,
                          statusTimestamps: { ...order.statusTimestamps, [status]: Date.now() }
                        };
                        handleUpdateOrder(updatedOrder);
                        notify(`Order ${status}`, "success");
                      }}
                      onEditOrder={(order) => {
                        setOrderToEdit(order);
                        setActiveTab('bill');
                      }}
                      triggerConfirm={triggerConfirm}
                      isAdmin={isAdmin || !!activeShop}
                      onUpdateOrder={handleUpdateOrder}
                    />
                  )}
                  {activeTab === 'inventory' && (
                    <InventoryView
                      purchases={purchases}
                      onAddPurchase={(p) => setPurchases([p, ...purchases])}
                      stockCategories={stockCategories}
                      setStockCategories={setStockCategories}
                      stockLogs={stockLogs}
                      setStockLogs={setStockLogs}
                      khataTransactions={khataTransactions}
                      setKhataTransactions={setKhataTransactions}
                      supplierCategories={supplierCategories}
                      setSupplierCategories={setSupplierCategories}
                      suppliers={suppliers}
                      setSuppliers={setSuppliers}
                      settings={settings}
                      isAdmin={isAdmin || !!activeShop}
                      triggerConfirm={triggerConfirm}
                      setIsNavHidden={setIsNavHidden}
                    />
                  )}
                  {activeTab === 'cashier' && (
                    <CashierView
                      orders={orders}
                      onUpdateOrder={handleUpdateOrder}
                      settings={settings}
                      notify={notify}
                      triggerConfirm={triggerConfirm}
                      isAdmin={isAdmin || !!activeShop}
                      activeStaff={activeStaff}
                    />
                  )}
                  {activeTab === 'crm' && (
                    <AdminDashboard
                      orders={orders}
                      purchases={purchases}
                      customers={customers}
                      setCustomers={setCustomers}
                      customerPayments={customerPayments}
                      setCustomerPayments={setCustomerPayments}
                      suppliers={suppliers}
                      setSuppliers={setSuppliers}
                      settings={settings}
                      setSettings={setSettings}
                      onLogout={handleLogout}
                      isAdmin={isAdmin}
                      activeShop={activeShop}
                      onUpdateShop={handleUpdateShop}
                      onNavigateToMenu={() => setActiveTab('menu')}
                      onExportData={handleExportData}
                      onImportData={handleImportData}
                      onResetData={handleResetData}
                      onAddPurchase={(p) => setPurchases([p, ...purchases])}
                      onUpdatePurchase={(up) => setPurchases(purchases.map(p => p.id === up.id ? up : p))}
                      onDeletePurchase={(id) => setPurchases(purchases.filter(p => p.id !== id))}
                      stockCategories={stockCategories}
                      setStockCategories={setStockCategories}
                      stockLogs={stockLogs}
                      setStockLogs={setStockLogs}
                      khataTransactions={khataTransactions}
                      setKhataTransactions={setKhataTransactions}
                      onUpdateOrder={handleUpdateOrder}
                      triggerConfirm={triggerConfirm}
                      onResetHistory={() => {}}
                      onUnlockRequest={() => setShowPinModal(true)}
                      setIsNavHidden={setIsNavHidden}
                      staffMembers={staffMembers}
                      setStaffMembers={setStaffMembers}
                      menuItems={items}
                      setMenuItems={setItems}
                      isSyncing={isSyncing}
                      setIsSyncing={setIsSyncing}
                      isInstallable={isInstallable}
                      onInstall={handleInstallClick}
                      showSecretSlider={showSecretSlider}
                      setShowSecretSlider={setShowSecretSlider}
                      isCashier={true}
                    />
                  )}
                </>
              )}
            </div>
          </main>



          {!isNavHidden && !showTakerQR && !showLogin && !showPinModal && !confirmModal.show && !showDataWarning && (
            <nav className="fixed bottom-0 left-0 right-0 bg-[var(--bg-nav)]/90 backdrop-blur-2xl border-t border-[var(--border)] flex justify-around items-center p-1.5 pb-safe z-[100] rounded-t-[32px] shadow-2xl">
              <NavTab
                icon={ICONS.Dashboard}
                label={isAdmin ? "Admin" : "Owner"}
                color="cyan"
                active={activeTab === 'dashboard'}
                locked={!isAdmin && !activeShop}
                hidden={!!activeStaff}
                onClick={() => {
                  const now = Date.now();
                  if (!pinClickTimerRef.current) {
                    pinClickTimerRef.current = setTimeout(() => {
                      setPinClickCount(0);
                      pinClickTimerRef.current = null;
                    }, 3000);
                  }
                  
                  const newCount = pinClickCount + 1;
                  setPinClickCount(newCount);
                  
                  if (!showSecretSlider && newCount >= 7) {
                    setShowPinModal(true);
                    setShowSecretSlider(true);
                    setPinClickCount(0);
                    if (pinClickTimerRef.current) {
                      clearTimeout(pinClickTimerRef.current);
                      pinClickTimerRef.current = null;
                    }
                  } else if (showSecretSlider && newCount >= 3) {
                    setShowSecretSlider(false);
                    setPinClickCount(0);
                    if (pinClickTimerRef.current) {
                      clearTimeout(pinClickTimerRef.current);
                      pinClickTimerRef.current = null;
                    }
                    alert("Sales Adjustment Slider Hidden!");
                  } else if (newCount >= 7) {
                    // Regular unlock even if slider already visible
                    setShowPinModal(true);
                    setPinClickCount(0);
                  }

                  if (activeTab !== 'dashboard') {
                    navigateTo('dashboard');
                  }
                }}
              />
              <NavTab icon={ICONS.ShoppingBag} label="Order Taker" color="orange" active={activeTab === 'bill'} locked={false} hidden={activeStaff ? activeStaff.role !== 'taker' : (!isAdmin && !activeShop)} onClick={() => navigateTo('bill')} />
              <NavTab icon={ICONS.Zap} label="Cashier" color="emerald" active={activeTab === 'cashier'} locked={!isAdmin && !activeShop && !activeStaff} hidden={activeStaff ? activeStaff.role !== 'cashier' : (!isAdmin && !activeShop)} onClick={() => navigateTo('cashier')} />
              <NavTab icon={ICONS.User} label="Customer Khata" color="cyan" active={activeTab === 'crm'} locked={!isAdmin && !activeShop && !activeStaff} hidden={activeStaff ? true : (!isAdmin && !activeShop)} onClick={() => navigateTo('crm')} />
              <NavTab icon={ICONS.ChefHat} label="Kitchen" color="amber" active={activeTab === 'orders'} locked={!isAdmin && !activeShop && !activeStaff} hidden={activeStaff ? activeStaff.role !== 'kitchen' : (!isAdmin && !activeShop)} onClick={() => navigateTo('orders')} />
              <NavTab icon={ICONS.History} label="History/Exp" color="emerald" active={activeTab === 'history'} locked={!isAdmin && !activeShop && !activeStaff} hidden={activeStaff ? true : (!isAdmin && !activeShop)} onClick={() => navigateTo('history')} />
            </nav>
          )}
        </>
      )}

      {/* Owner PIN Modal */}
      {showDataWarning && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[52000] flex items-center justify-center p-6 animate-in fade-in zoom-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-orange-500/20 p-10 w-full max-w-md text-center space-y-8 shadow-2xl border-b-8 border-b-orange-600">
            <div className="space-y-4">
              <div className="w-24 h-24 bg-orange-600/10 text-orange-600 rounded-[32px] flex items-center justify-center mx-auto text-5xl">
                ⚠️
              </div>
              <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Data <span className="text-orange-600">Limit reached</span></h3>
              <p className="text-[12px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-relaxed">
                App ka data 1GB se zayada ho gaya hai. <br/>
                Please data download karke save karein taake sync chalta rahe.
              </p>
            </div>

            <div className="bg-white/5 p-6 rounded-[32px] border border-white/5">
              <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Current Data Size</p>
              <p className="text-2xl font-black text-white uppercase italic">{(dataSize / (1024 * 1024)).toFixed(2)} MB</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={handleExportData}
                className="w-full py-6 bg-orange-600 text-white rounded-[24px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-orange-600/20 text-lg"
              >
                Download Data Now
              </button>
              <button
                onClick={() => setShowDataWarning(false)}
                className="w-full py-4 bg-white/5 text-white rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all text-[10px] border border-white/10"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}



      {showPinModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[53000] flex items-center justify-center p-6">
          <div className="bg-[var(--bg-card)] rounded-[44px] border border-yellow-500/20 w-full max-w-sm p-8 space-y-6 shadow-2xl animate-in zoom-in">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-yellow-500/10 text-yellow-500 rounded-3xl mx-auto flex items-center justify-center mb-2">
                <span className="text-3xl">🔐</span>
              </div>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Owner <span className="text-yellow-500">Access</span></h3>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Enter PIN to unlock totals</p>
            </div>
            <div className="space-y-3">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                placeholder="● ● ● ● ●"
                value={pinInput}
                onChange={e => { setPinInput(e.target.value); setPinError(false); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const today = new Date();
                    const datePin = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;
                    if (pinInput === settings.adminSecretKey || pinInput === datePin || pinInput === '111222') {
                      setIsTotalsUnlocked(true);
                      setShowPinModal(false);
                      setPinInput('');
                      notify('Totals Unlocked!', 'success');
                    } else {
                      setPinError(true);
                    }
                  }
                }}
                className={`w-full p-5 rounded-[24px] text-center text-2xl font-black tracking-[0.5em] text-white bg-black/40 border-2 outline-none transition-all ${pinError ? 'border-red-500 animate-pulse' : 'border-white/10 focus:border-yellow-500'}`}
                autoFocus
              />
              {pinError && <p className="text-center text-red-500 text-[10px] font-black uppercase tracking-widest">❌ Wrong PIN</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  const today = new Date();
                  const datePin = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;
                  if (pinInput === settings.adminSecretKey || pinInput === datePin || pinInput === '111222') {
                    setIsTotalsUnlocked(true);
                    setShowPinModal(false);
                    setPinInput('');
                    notify('Totals Unlocked!', 'success');
                  } else {
                    setPinError(true);
                  }
                }}
                className="py-4 bg-yellow-500 text-black rounded-[20px] font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all shadow-xl shadow-yellow-500/20"
              >
                Unlock
              </button>
              <button
                onClick={() => { setShowPinModal(false); setPinInput(''); setPinError(false); }}
                className="py-4 bg-white/5 text-white rounded-[20px] font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all border border-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[54000] flex items-center justify-center p-6 animate-in fade-in">
          <div className={`bg-[var(--bg-card)] rounded-[40px] border ${confirmModal.type === 'info' ? 'border-blue-500/20' : 'border-red-500/20'} w-full max-w-sm p-8 text-center space-y-6 shadow-2xl`}>
            <div className={`w-20 h-20 ${confirmModal.type === 'info' ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'} rounded-3xl flex items-center justify-center mx-auto text-4xl`}>
              {confirmModal.type === 'info' ? ICONS.Info : ICONS.Trash2}
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">
                {confirmModal.title}
              </h3>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-relaxed">
                {confirmModal.message}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                className="py-4 bg-white/5 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest"
              >
                No
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(prev => ({ ...prev, show: false }));
                }}
                className={`py-4 ${confirmModal.type === 'info' ? 'bg-blue-600' : 'bg-red-600'} text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg`}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogin && <LoginModal
        onEnterCustomerMode={() => {
          setIsCustomerMode(true);
          setShowLogin(false);
          notify("Entering Customer Mode", "success");
        }}
        onLogin={(p) => {
          // 1. Check Master Admin (Secret Key or Date-based PIN)
          const today = new Date();
          const datePin = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;
          
          if (p === settings.adminSecretKey || p === datePin || p === '111222') {
            setIsAdmin(true);
            setShowLogin(false);
            setActiveTab('bill');
            notify("Master Admin Access Granted", "success");
            return;
          }

          // 2. Check Shop Owners
          const acc = globalAccounts.find(a => a.password === p);
          if (acc) {
            setActiveShop(acc);
            localStorage.setItem('shop_session', JSON.stringify(acc));
            setShowLogin(false);
            setActiveTab('bill');
            notify(`Welcome, ${acc.shopName}`, "success");
            return;
          }

          // 3. Check Staff Members
          const staff = staffMembers.find(s => s.password === p);
          if (staff) {
            setActiveStaff(staff);
            localStorage.setItem('taker_session', JSON.stringify(staff));
            setShowLogin(false);
            if (staff.role === 'kitchen') {
              setActiveTab('orders');
            } else {
              setActiveTab('bill');
            }
            notify(`Welcome, ${staff.name}`, "success");
            return;
          }

          notify("Ghalat Password ya PIN!", "error");
        }} onClose={() => setShowLogin(false)} />}
    </div>
  );
};

interface NavTabProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  locked: boolean;
  hidden?: boolean;
  color: 'orange' | 'cyan' | 'emerald' | 'amber';
  onClick: () => void;
}

const NavTab: React.FC<NavTabProps> = ({ icon, label, active, locked, hidden, color, onClick }) => {
  if (hidden) return null;
  const colorMap = {
    orange: { text: 'text-orange-500', bg: 'bg-orange-600/15', inactive: 'text-orange-500/40' },
    cyan: { text: 'text-cyan-500', bg: 'bg-cyan-600/15', inactive: 'text-cyan-500/40' },
    emerald: { text: 'text-emerald-500', bg: 'bg-emerald-600/15', inactive: 'text-emerald-500/40' },
    amber: { text: 'text-amber-500', bg: 'bg-amber-600/15', inactive: 'text-amber-500/40' },
  };

  const theme = colorMap[color];

  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full py-1.5 transition-all relative ${active ? `${theme.text} font-bold -translate-y-1` : 'text-gray-500'}`}>
      {locked && (
        <div className="absolute top-0 right-1/4 text-[8px] text-gray-400 opacity-50">{ICONS.Lock}</div>
      )}
      <div className={`p-2 rounded-xl transition-colors duration-300 ${active ? theme.bg : 'bg-transparent'}`}>
        <div className={active ? theme.text : theme.inactive}>
          {icon}
        </div>
      </div>
      <span className={`text-[9px] mt-1 uppercase tracking-widest font-black ${active ? theme.text : 'text-gray-500/70'}`}>{label}</span>
    </button>
  );
};

export default App;
