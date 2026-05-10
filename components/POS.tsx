import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';
import { MenuItem, Order, OrderItem, AppSettings, Customer, StaffMember, OrderStatus, KitchenTicket } from '../types';
import { ICONS, CATEGORIES } from '../constants';
import TimeElapsed from './TimeElapsed';
import { api } from '../utils/api';

interface POSProps {
  items: MenuItem[];
  customers: Customer[];
  settings: AppSettings;
  shopName?: string;
  activeStaff?: StaffMember | null;
  pendingOrders: Order[];
  allOrders: Order[];
  onOrderComplete: (order: Order) => void;
  onUpdateOrder: (order: Order) => void;
  onDeleteOrder: (id: string) => void;
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
  orderToEdit?: Order | null;
  onClearOrderToEdit?: () => void;
  triggerConfirm: (config: { title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' }) => void;
  setIsNavHidden?: (hidden: boolean) => void;
  isAdmin?: boolean;
  initialTableNumber?: string;
  isPrinterDevice?: boolean;
  handlePrint: (order: Order, isFinalBill?: boolean) => void;
  handlePrintKitchen: (order: Order) => void;
  isCustomerMode?: boolean;
  currentOrderTakerId?: string | null;
  handlePrintQR?: (taker: StaffMember) => void;
}

const POS: React.FC<POSProps> = ({ 
  items, customers, settings, shopName, activeStaff, pendingOrders, allOrders, onOrderComplete, onUpdateOrder, onDeleteOrder, notify, orderToEdit, onClearOrderToEdit, triggerConfirm,
  setIsNavHidden, isAdmin, initialTableNumber, isPrinterDevice, handlePrint, handlePrintKitchen, isCustomerMode, currentOrderTakerId, handlePrintQR
}) => {
  const canSettlePayment = isAdmin || !activeStaff || activeStaff.role === 'cashier';
  const printedOrderIds = useRef<Set<string>>(new Set());

  const [cart, setCart] = useState<OrderItem[]>(() => {
    try {
      const saved = localStorage.getItem('pos_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Cart recovery failed", e);
      return [];
    }
  });
  const [selectedItemForQty, setSelectedItemForQty] = useState<MenuItem | null>(null);
  const [isClosingQty, setIsClosingQty] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<OrderItem | null>(null);
  const [inputQty, setInputQty] = useState<string>('1');
  const [category, setCategory] = useState<string>('All');
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('pos_customer_name') || '');
  const [customerPhone, setCustomerPhone] = useState(() => localStorage.getItem('pos_customer_phone') || '');
  const [customerWhatsApp, setCustomerWhatsApp] = useState(() => localStorage.getItem('pos_customer_whatsapp') || '');
  const [tableNumber, setTableNumber] = useState(() => localStorage.getItem('pos_table_number') || initialTableNumber || '');
  const [kitchenNotes, setKitchenNotes] = useState(() => localStorage.getItem('pos_kitchen_notes') || '');
  const [orderType, setOrderType] = useState(() => localStorage.getItem('pos_order_type') || 'Dine In');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [showCustomerModal, setShowCustomerModal] = useState(!!isCustomerMode);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('pos_customer_name', customerName);
    localStorage.setItem('pos_customer_phone', customerPhone);
    localStorage.setItem('pos_customer_whatsapp', customerWhatsApp);
    localStorage.setItem('pos_table_number', tableNumber);
    localStorage.setItem('pos_kitchen_notes', kitchenNotes);
    localStorage.setItem('pos_order_type', orderType);
  }, [customerName, customerPhone, customerWhatsApp, tableNumber, kitchenNotes, orderType]);

  useEffect(() => {
    if (initialTableNumber && !localStorage.getItem('pos_table_number')) {
      setTableNumber(initialTableNumber);
    }
  }, [initialTableNumber]);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);

  React.useEffect(() => {
    if (successOrder && settings.isAutoWhatsappEnabled) {
      handleShareWhatsApp(successOrder);
    }
  }, [successOrder, settings.isAutoWhatsappEnabled]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showPendingOrders, setShowPendingOrders] = useState(false);
  const [showReadyOrders, setShowReadyOrders] = useState(false);
  const [showServedOrders, setShowServedOrders] = useState(false);
  const [showActiveOrders, setShowActiveOrders] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [selectedDeliveryZoneId, setSelectedDeliveryZoneId] = useState<string | null>(null);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [quickAdd, setQuickAdd] = useState<Record<string, { itemId: string, qty: string }>>({});
  const [showMenuPicker, setShowMenuPicker] = useState(false);
  const [targetOrderForPicker, setTargetOrderForPicker] = useState<Order | null>(null);
  const [selectedOrderToReview, setSelectedOrderToReview] = useState<Order | null>(null);

  const orderDateRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const originalItemsRef = useRef<OrderItem[]>([]);

  useEffect(() => {
    const isAnyModalOpen = isScannerOpen || showPendingOrders || showReadyOrders || showServedOrders || showActiveOrders || isCheckoutOpen || !!selectedItemForQty || !!successOrder || showMenuPicker || !!itemToRemove;
    setIsNavHidden?.(isAnyModalOpen);
  }, [isScannerOpen, showPendingOrders, showReadyOrders, showServedOrders, showActiveOrders, isCheckoutOpen, selectedItemForQty, successOrder, showMenuPicker, itemToRemove, setIsNavHidden]);

  const filteredItems = category === 'All' ? items : items.filter(i => i.category === category);

  // Track previous counts for blinking effects
  const prevPendingCount = useRef(pendingOrders.length);
  const prevReadyCount = useRef(allOrders.filter(o => o.status === 'ready').length);
  const [blinkPending, setBlinkPending] = useState(false);
  const [blinkReady, setBlinkReady] = useState(false);

  useEffect(() => {
    if (pendingOrders.length > prevPendingCount.current) {
      setBlinkPending(true);
      setTimeout(() => setBlinkPending(false), 5000); // Blink for 5 seconds
    }
    prevPendingCount.current = pendingOrders.length;
  }, [pendingOrders.length]);

  const readyOrders = (allOrders || [])
    .filter(o => o.status === 'ready')
    .sort((a, b) => a.timestamp - b.timestamp);

  useEffect(() => {
    if (readyOrders.length > prevReadyCount.current) {
      setBlinkReady(true);
      setTimeout(() => setBlinkReady(false), 5000); // Blink for 5 seconds
    }
    prevReadyCount.current = readyOrders.length;
  }, [readyOrders.length]);

  // Sync Table Number with Order Type
  useEffect(() => {
    if (!canSettlePayment && orderType !== 'Dine In') {
      setOrderType('Dine In');
      return;
    }
    
    if (orderType === 'Take Away') {
      setTableNumber('Take Away');
    } else if (orderType === 'Home Delivery') {
      setTableNumber('Home Delivery');
    } else if (orderType === 'Dine In' && (tableNumber === 'Take Away' || tableNumber === 'Home Delivery')) {
      setTableNumber('');
    }
  }, [orderType, canSettlePayment]);

  const servedOrders = (allOrders || [])
    .filter(o => {
      const isPaid = (o.receivedAmount || 0) >= (o.total || 0);
      if (o.orderType && o.orderType !== 'Dine In' && isPaid) return false;
      return o.status === 'served';
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  const activeOrders = (allOrders || [])
    .filter(o => {
      const isPaid = (o.receivedAmount || 0) >= (o.total || 0);
      if (o.orderType && o.orderType !== 'Dine In' && isPaid) return false;
      return o.status && ['received', 'accepted', 'preparing', 'ready', 'served'].includes(o.status) && new Date(o.timestamp).toDateString() === new Date().toDateString();
    })
    .sort((a, b) => {
      // Show 'served' (generated bills that are unpaid) at the very top
      if (a.status === 'served' && b.status !== 'served') return -1;
      if (a.status !== 'served' && b.status === 'served') return 1;
      return a.timestamp - b.timestamp;
    });

  useEffect(() => {
    if (orderToEdit) {
      setCart([]); 
      setCustomerName(orderToEdit.customerName);
      setCustomerPhone(orderToEdit.customerPhone);
      setTableNumber(orderToEdit.tableNumber || '');
      setCurrentOrderId(orderToEdit.id);
      originalItemsRef.current = [...orderToEdit.items];
      setSelectedDeliveryZoneId(orderToEdit.deliveryZoneId || null);
      setSelectedPaymentMethod(orderToEdit.paymentMethod || 'cash');
      if (onClearOrderToEdit) onClearOrderToEdit();
      notify("Order loaded for editing", "success");
    }
  }, [orderToEdit]);

  useEffect(() => {
    if (isScannerOpen) {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render((decodedText) => {
        handleScanSuccess(decodedText);
        scanner.clear();
        setIsScannerOpen(false);
      }, (error) => {
        // console.warn(error);
      });

      scannerRef.current = scanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error("Scanner cleanup failed", e));
        scannerRef.current = null;
      }
    };
  }, [isScannerOpen]);

  useEffect(() => {
    if (initialTableNumber) {
      setTableNumber(initialTableNumber);
    }
  }, [initialTableNumber]);

  // Auto-focus quantity input when modal opens
  useEffect(() => {
    if (selectedItemForQty) {
      setTimeout(() => {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }, 100);
    }
  }, [selectedItemForQty]);

  const handleScanSuccess = (decodedText: string) => {
    // Check if it's an item ID
    const item = items.find(i => i.id === decodedText || i.name.toLowerCase() === decodedText.toLowerCase());
    if (item) {
      setSelectedItemForQty(item);
      notify(`Item Found: ${item.name}`, "success");
      return;
    }

    // Check if it's a customer phone or ID
    const customer = customers.find(c => c.phone === decodedText || c.id === decodedText || c.name.toLowerCase() === decodedText.toLowerCase());
    if (customer) {
      setCustomerName(customer.name);
      setCustomerPhone(customer.phone);
      setIsCheckoutOpen(true);
      notify(`Customer Found: ${customer.name}`, "success");
      return;
    }

    // Check if it's an Order ID (for Order Taker printing)
    const order = allOrders.find(o => o.id === decodedText || (o.orderNumber && o.orderNumber.toString() === decodedText));
    if (order) {
      handlePrint(order);
      notify(`Order Found: #${order.orderNumber}. Printing...`, "success");
      return;
    }

    notify("QR Code not recognized", "error");
  };




  useEffect(() => {
    const phone = customerPhone.trim();
    const name = customerName.trim();
    if (phone.length > 0 || name.length > 0) {
      const filtered = customers.filter(c =>
        (phone.length > 0 && c.phone.includes(phone)) ||
        (name.length > 0 && c.name.toLowerCase().includes(name.toLowerCase()))
      ).slice(0, 5);
      setFilteredCustomers(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [customerPhone, customerName, customers]);

  const selectCustomer = (c: Customer) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (selectedItemForQty && qtyInputRef.current) {
      qtyInputRef.current.focus();
      qtyInputRef.current.select();
      
      // Pre-fill with current cart quantity if it exists
      const existing = cart.find(i => i.id === selectedItemForQty.id);
      if (existing) {
        setInputQty(existing.quantity.toString());
      } else {
        setInputQty(selectedItemForQty.unit === 'rs' ? '100' : '1');
      }
    }
  }, [selectedItemForQty]);

  const closeQtyModal = () => {
    setIsClosingQty(true);
    setTimeout(() => {
      setSelectedItemForQty(null);
      setIsClosingQty(false);
    }, 200);
  };

  const handleCheckout = (mode: 'final' | 'kitchen' | 'draft' | 'update' = 'final') => {
    try {
      if (cart.length === 0) {
        notify("Cart khali hai!", "error");
        return;
      }

      if (mode === 'kitchen' || mode === 'final') {
        if (!tableNumber.trim()) {
           notify("Table number ya 'Takeaway' likhna zaroori hai!", "error");
           return;
        }
        
        if (!isCustomerMode && orderType !== 'Dine In' && canSettlePayment) {
          const isPaid = (Number(receivedAmount) || 0) >= (finalTotal || 0);
          if (!isPaid) {
            notify(`Pehle bill pay karein (Total: Rs.${(finalTotal || 0).toFixed(0)})`, "error");
            return;
          }
        }
      }

      const timestamp = Date.now();
      if (selectedPaymentMethod === 'khata' && (!customerPhone || customerPhone.length < 5)) {
        notify("Khata ke liye mobile number lazmi hai!", "error");
        return;
      }

      let status: OrderStatus = mode === 'draft' ? 'draft' : (mode === 'final' ? 'served' : 'received');
      if (isCustomerMode) {
        status = 'pending_customer';
      }

      const existingOrder = currentOrderId ? (allOrders || []).find(o => o.id === currentOrderId) : null;
      
      let newKitchenTickets = existingOrder?.kitchenTickets || [];
      let newUpdateCount = existingOrder?.updateCount || 0;
      let didAddTicket = false;

      if (mode === 'kitchen' || status === 'received' || status === 'served' || mode === 'update') {
        const ticketItems: { id: string; name: string; quantity: number }[] = [];
        
        if (mode === 'update') {
          // In update mode, everything in cart is an addition
          cart.forEach(cartItem => {
            ticketItems.push({
              id: cartItem.id,
              name: cartItem.name,
              quantity: cartItem.quantity
            });
          });
        } else {
          // In initial kitchen mode, everything is new
          cart.forEach(cartItem => {
            ticketItems.push({
              id: cartItem.id,
              name: cartItem.name,
              quantity: cartItem.quantity
            });
          });
        }

        if (ticketItems.length > 0) {
          newUpdateCount += 1;
          newKitchenTickets = [
            ...newKitchenTickets,
            {
              id: `TKT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
              round: newUpdateCount,
              timestamp: Date.now(),
              items: ticketItems,
              isPrinted: false,
              senderName: activeStaff?.name || shopName || 'OWNER'
            }
          ];
          didAddTicket = true;
          notify(`Sent ${ticketItems.length} new items to kitchen!`, "success");
        }
      }

      let newOrder: Order;

      if (existingOrder) {
        let updatedItems = [...existingOrder.items];
        cart.forEach(cartItem => {
          const existingIdx = updatedItems.findIndex(i => i.id === cartItem.id);
          if (existingIdx >= 0) {
            updatedItems[existingIdx] = {
              ...updatedItems[existingIdx],
              quantity: updatedItems[existingIdx].quantity + cartItem.quantity
            };
          } else {
            updatedItems.push({ ...cartItem });
          }
        });

        const newSubtotal = updatedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
        const newTax = settings?.isTaxEnabled ? (newSubtotal * settings.taxRate / 100) : 0;
        const newDiscount = settings?.isDiscountEnabled ? (newSubtotal * (settings?.defaultDiscount || 0) / 100) : 0;
        const newTotal = newSubtotal + newTax - newDiscount + (existingOrder.deliveryFee || 0);

        newOrder = {
          ...existingOrder,
          items: updatedItems,
          subtotal: newSubtotal,
          tax: newTax,
          discount: newDiscount,
          total: newTotal,
          customerName: customerName.trim() || 'WALK-IN',
          customerPhone: customerPhone.trim() || '',
          whatsappNumber: customerWhatsApp.trim() || undefined,
          paymentMethod: selectedPaymentMethod,
          orderType: orderType,
          status: mode === 'final' ? 'served' : (isCustomerMode ? 'pending_customer' : (mode === 'kitchen' ? 'received' : existingOrder.status)),
          isPrinted: mode === 'kitchen' ? false : (existingOrder.isPrinted || false),
          kitchenTickets: newKitchenTickets,
          updateCount: newUpdateCount,
          statusTimestamps: mode === 'update' ? existingOrder.statusTimestamps : {
            ...existingOrder.statusTimestamps,
            [mode === 'final' ? 'served' : (isCustomerMode ? 'pending_customer' : (mode === 'kitchen' ? 'received' : existingOrder.status!))]: Date.now()
          },
          kitchenNotes: kitchenNotes.trim() || undefined,
          tableNumber: tableNumber.trim() || undefined,
          deliveryFee,
          deliveryZoneId: selectedDeliveryZoneId || undefined,
        };
      } else {
        newOrder = {
          id: Math.random().toString(36).substr(2, 9).toUpperCase(),
          timestamp,
          items: cart,
          subtotal,
          tax: taxAmount,
          discount: discountAmount,
          total: finalTotal,
          customerName: customerName.trim() || 'WALK-IN',
          customerPhone: customerPhone.trim() || '',
          whatsappNumber: customerWhatsApp.trim() || undefined,
          paymentMethod: selectedPaymentMethod,
          receivedAmount: receivedAmount ? parseFloat(receivedAmount) : 0,
          balance: (finalTotal - (receivedAmount ? parseFloat(receivedAmount) : 0)),
          orderType: orderType,
          status,
          kitchenTickets: newKitchenTickets,
          updateCount: newUpdateCount,
          statusTimestamps: {
            [status]: Date.now()
          },
          orderNumber: Math.max(0, ...(allOrders || []).map(o => o.orderNumber || 0)) + 1,
          kitchenNotes: kitchenNotes.trim() || undefined,
          orderTakerId: activeStaff?.id || currentOrderTakerId || undefined,
          orderTakerName: (activeStaff?.name) || (isCustomerMode ? 'CUSTOMER_QR' : shopName) || 'OWNER',
          tableNumber: tableNumber.trim() || undefined,
          deliveryFee,
          deliveryZoneId: selectedDeliveryZoneId || undefined,
        };
      }

      if (currentOrderId && existingOrder) {
        onUpdateOrder(newOrder);
      } else {
        onOrderComplete(newOrder);
      }

      // Auto Print Logic removed as per user request

      if (mode === 'final') {
        setSuccessOrder(newOrder);
      } else if (mode === 'kitchen' || mode === 'update') {
        if (isCustomerMode) {
          notify("Order sent to Order Taker!", "success");
        } else {
          // Conditional Printing based on Order Type
          if (orderType === 'Dine In' && didAddTicket) {
            // handlePrintKitchen(newOrder); // Keep disabled for Dine-in as per previous instructions
          } else if (orderType === 'Take Away' && didAddTicket) {
            // TAKE AWAY: Print both Kitchen and Bill
            handlePrintKitchen(newOrder);
            handlePrint(newOrder, true);
            notify("Take Away: Bill & Kitchen Printed!", "success");
          } else if (didAddTicket) {
            // Only print if payment is fully received for Delivery etc.
            const isPaid = (Number(receivedAmount) || 0) >= (finalTotal || 0);
            if (isPaid) {
              handlePrint(newOrder, true);
              notify("Bill Printed!", "success");
            } else {
              // handlePrintKitchen(newOrder);
              notify("Order sent to kitchen record!", "info");
            }
          }
          if (mode === 'update') notify("Order updated successfully!", "success");
          else notify("Order processed!", "success");
        }
        resetForNextBill();
      } else if (mode === 'draft') {
        notify("Order saved as draft!", "info");
        resetForNextBill();
      }
      setIsCheckoutOpen(false);
    } catch (e) {
      notify("Checkout failed: " + (e as Error).message, "error");
    }
  };

  const resetForNextBill = () => {
    try {
      localStorage.removeItem('pos_cart');
      localStorage.removeItem('pos_customer_name');
      localStorage.removeItem('pos_customer_phone');
      localStorage.removeItem('pos_customer_whatsapp');
      localStorage.removeItem('pos_table_number');
      localStorage.removeItem('pos_kitchen_notes');
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerWhatsApp('');
      setTableNumber(initialTableNumber || '');
      setKitchenNotes('');
      setSuccessOrder(null);
      setCurrentOrderId(null);
      setReceivedAmount('');
      setSelectedDeliveryZoneId(null);
      notify("New Bill Started!", "success");
    } catch (e) {
      notify("Reset fail ho gaya: " + (e as Error).message, "error");
    }
  };





  const handleShareWhatsApp = (order: Order) => {
    try {
      const rawPhone = order.customerPhone.trim();
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

      const headerName = shopName || settings.businessName;
      const dateStr = new Date(order.timestamp).toLocaleDateString();
      const tableStr = order.tableNumber ? `Table: ${order.tableNumber}\n` : '';
      const itemsList = order.items.map(item => `• ${item.name} (${item.unit === 'rs' ? 'Rs.' : 'x'}${item.quantity}): Rs.${(item.price * item.quantity).toFixed(0)}`).join('\n');

      const deliveryStr = order.deliveryFee && order.deliveryFee > 0 ? `Delivery Fee: Rs. ${order.deliveryFee.toFixed(0)}\n` : '';
      const message = `*${headerName} - INVOICE*\n--------------------------\nOrder ID: ${order.id}\nDate: ${dateStr}\n${tableStr}Customer: ${order.customerName}\nPayment: ${order.paymentMethod?.toUpperCase()}\n--------------------------\n${itemsList}\n--------------------------\nSubtotal: Rs. ${order.subtotal.toFixed(0)}\n${deliveryStr}*Grand Total: Rs. ${order.total.toFixed(0)}*\n--------------------------\nShukriya! Phir zaroor aaiye ga.`;

      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
      notify("WhatsApp bill sent!", "success");
    } catch (e) {
      notify("WhatsApp fail ho gaya: " + (e as Error).message, "error");
    }
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const taxAmount = settings?.isTaxEnabled ? (subtotal * settings.taxRate / 100) : 0;
  const discountAmount = settings?.isDiscountEnabled ? (subtotal * (settings?.defaultDiscount || 0) / 100) : 0;
  const deliveryFee = settings.deliveryZones?.find(z => z.id === selectedDeliveryZoneId)?.fee || 0;
  const finalTotal = subtotal + taxAmount - discountAmount + deliveryFee;

  const quickQtys = selectedItemForQty?.unit === 'rs' ? [50, 100, 200, 500, 1000] : [1, 2, 5, 10, 20];

  const currentItemTotal = selectedItemForQty ?
    (parseFloat(inputQty) || 0) * (selectedItemForQty.unit === 'rs' ? 1 : selectedItemForQty.price)
    : 0;

  return (
    <>
      {/* Customer Details Modal (Auto-open in Customer Mode) */}
      <AnimatePresence>
        {showCustomerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--bg-card)] w-full max-w-sm rounded-[32px] border border-white/10 shadow-2xl overflow-hidden"
            >
              <div className="bg-orange-600 p-6 text-center">
                <h3 className="font-black text-2xl uppercase tracking-widest text-white italic">Welcome!</h3>
                <p className="text-white/80 text-[10px] uppercase font-bold tracking-widest mt-1">Please enter your details</p>
              </div>
              <div className="p-6 space-y-4">
                <input
                  type="text"
                  placeholder="YOUR NAME *"
                  className="w-full p-5 bg-black/40 border-2 border-white/5 rounded-[24px] outline-none font-black text-white text-center uppercase focus:border-orange-600 transition-all text-xs"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="WHATSAPP NUMBER *"
                  className="w-full p-5 bg-black/40 border-2 border-white/5 rounded-[24px] outline-none font-black text-white text-center uppercase focus:border-orange-600 transition-all text-xs"
                  value={customerWhatsApp}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setCustomerWhatsApp(val);
                    setCustomerPhone(val); // Sync with phone
                  }}
                />
                <input
                  type="text"
                  placeholder="TABLE NUMBER *"
                  className="w-full p-5 bg-black/40 border-2 border-white/5 rounded-[24px] outline-none font-black text-white text-center uppercase focus:border-orange-600 transition-all text-xs"
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value)}
                />
                <button
                  onClick={() => {
                    if (!customerName.trim() || !customerWhatsApp.trim() || !tableNumber.trim()) {
                      notify("Please fill all details", "error");
                      return;
                    }
                    setShowCustomerModal(false);
                  }}
                  className="w-full bg-orange-600 text-white py-5 rounded-[24px] font-black uppercase text-[12px] tracking-widest shadow-xl active:scale-95 transition-all mt-4"
                >
                  Continue to Menu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Code Modal for Customers */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[600] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--bg-card)] rounded-[48px] border border-white/10 p-10 shadow-2xl text-center max-w-sm w-full relative"
            >
              <button 
                onClick={() => setShowQRModal(false)}
                className="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 text-white hover:bg-white/10"
              >
                {ICONS.X}
              </button>

              <div className="space-y-6">
                <div className="w-20 h-20 bg-indigo-600/20 text-indigo-500 rounded-3xl mx-auto flex items-center justify-center mb-4 scale-125">
                  {ICONS.QrCode}
                </div>
                
                <h3 className="text-2xl font-black uppercase tracking-tighter text-white italic">Scan to Order</h3>
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-8">Customer can scan this QR to see the menu</p>

                <div className="bg-white p-6 rounded-[32px] inline-block shadow-2xl border-4 border-indigo-600/20">
                  <QRCodeCanvas
                    value={`${window.location.protocol}//${settings.masterIP ? (settings.masterIP.includes(':') ? settings.masterIP : `${settings.masterIP}:3000`) : window.location.host}${window.location.pathname}?mode=customer&takerId=${activeStaff?.id}&token=${Math.floor(Date.now() / 86400000)}`}
                    size={220}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="H"
                  />
                </div>

                <div className="pt-4">
                  <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-2xl p-3 inline-block">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 italic">Scan or Open:</p>
                    <p className="text-[12px] font-black text-white">{window.location.protocol}//{settings.masterIP ? (settings.masterIP.includes(':') ? settings.masterIP : `${settings.masterIP}:3000`) : window.location.host}</p>
                  </div>
                </div>

                <div className="pt-4">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic">Taker: {activeStaff?.name}</p>
                </div>

                {handlePrintQR && activeStaff && (
                  <button
                    onClick={() => handlePrintQR(activeStaff)}
                    className="w-full mt-4 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                  >
                    {ICONS.Printer} Print QR Code
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`space-y-4 animate-in fade-in duration-500 pb-[140px] px-0.5 transition-all`}>
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategoryMenu(!showCategoryMenu)}
            className="p-4 bg-orange-600 text-white rounded-[20px] shadow-xl active:scale-90 transition-all flex items-center justify-center"
            title="Categories"
          >
            {ICONS.Menu}
          </button>
          
          <button
            onClick={() => {
              if (cart.length > 0) {
                triggerConfirm({
                  title: "New Order?",
                  message: "Current items will be cleared. Continue?",
                  onConfirm: resetForNextBill,
                  type: 'danger'
                });
              } else {
                resetForNextBill();
              }
            }}
            className="px-4 py-4 bg-white/5 border border-white/10 text-orange-600 rounded-[20px] shadow-lg active:scale-90 transition-all flex items-center justify-center gap-2 group"
          >
            <div className="bg-orange-600 text-white p-1 rounded-lg group-active:rotate-180 transition-transform">
              {ICONS.Plus}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest hidden xs:block">New Order</span>
          </button>

          {(cart.length > 0 || !!currentOrderId) && (
            <button
              onClick={() => {
                if (cart.length > 0) {
                  setIsCheckoutOpen(true);
                } else {
                  setShowActiveOrders(true);
                }
              }}
              className={`px-4 py-4 ${currentOrderId ? 'bg-orange-600 animate-pulse' : 'bg-blue-600/10'} border ${currentOrderId ? 'border-orange-400' : 'border-blue-600/20'} ${currentOrderId ? 'text-white' : 'text-blue-600'} rounded-[20px] shadow-lg active:scale-90 transition-all flex items-center justify-center gap-2 group`}
            >
              <div className={`${currentOrderId ? 'bg-white text-orange-600' : 'bg-blue-600 text-white'} p-1 rounded-lg`}>
                {currentOrderId ? ICONS.Edit : ICONS.Eye}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest hidden xs:block">
                {currentOrderId ? `Updating #${allOrders.find(o => o.id === currentOrderId)?.orderNumber}` : (cart.length > 0 ? 'View Cart' : 'Review Orders')}
              </span>
              {cart.length > 0 && !currentOrderId && (
                <span className="bg-orange-600 text-white text-[8px] px-1.5 py-0.5 rounded-full">{cart.length}</span>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {readyOrders.length > 0 && (
            <button
              onClick={() => setShowReadyOrders(true)}
              className="p-4 bg-emerald-600 text-white rounded-[20px] shadow-xl active:scale-90 transition-all flex items-center justify-center relative"
              title="Ready Orders"
            >
              {ICONS.Bell}
              <span className="absolute -top-1 -right-1 bg-white text-emerald-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-emerald-600 animate-bounce">
                {readyOrders.length}
              </span>
            </button>
          )}


          <div className="relative">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="p-4 bg-[var(--bg-card)] text-orange-600 border border-orange-600/20 rounded-[20px] shadow-xl active:scale-90 transition-transform flex items-center justify-center"
              title="Scan QR Code"
            >
              {ICONS.QrCode}
            </button>
          </div>
        </div>
      </div>

      {/* Category Dropdown Menu */}
      <AnimatePresence>
        {showCategoryMenu && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-3 gap-2 p-4 bg-[var(--bg-card)] rounded-[24px] border border-orange-600/20 shadow-2xl z-50"
          >
            <button
              onClick={() => { setCategory('All'); setShowCategoryMenu(false); }}
              className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all ${category === 'All' ? 'bg-orange-600 border-orange-600 text-white' : 'bg-black/20 border-white/5 text-[var(--text-muted)]'}`}
            >
              All Items
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setShowCategoryMenu(false); }}
                className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all ${category === cat ? 'bg-orange-600 border-orange-600 text-white' : 'bg-black/20 border-white/5 text-[var(--text-muted)]'}`}
              >
                {cat}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Bottom Category Bar */}
      {activeStaff?.role !== 'taker' && (
        <div className="fixed bottom-[74px] left-0 right-0 bg-[var(--bg-main)]/90 backdrop-blur-2xl border-t border-white/5 p-3 flex gap-2 overflow-x-auto no-scrollbar z-[90] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <button
            onClick={() => setCategory('All')}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-4 ${category === 'All' ? 'bg-orange-600 border-orange-800 text-white shadow-xl scale-105' : 'bg-white/5 border-white/10 text-gray-500'}`}
          >
            All Items
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-4 ${category === cat ? 'bg-orange-600 border-orange-800 text-white shadow-xl scale-105' : 'bg-white/5 border-white/10 text-gray-500'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Large Action Buttons */}
      {/* Large Action Buttons - Hidden for Customers */}
      {!isCustomerMode && (
        <div className="grid grid-cols-3 gap-3 pb-2">
          {/* Button 1: Ready Orders Modal */}
          <button
            onClick={() => setShowReadyOrders(true)}
            className={`relative group p-4 rounded-[24px] shadow-xl active:scale-95 transition-all flex flex-col items-center justify-center gap-2 border-b-4 ${blinkReady ? 'bg-emerald-500 animate-pulse border-emerald-700 ring-4 ring-emerald-500/50' : 'bg-emerald-600 border-emerald-800 text-white'}`}
          >
            <div className="p-2 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
              {ICONS.Utensils}
            </div>
            <div className="text-center">
              <span className="text-[9px] font-black uppercase tracking-tighter italic">Ready Order</span>
              {readyOrders.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-white text-emerald-600 text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-emerald-600 shadow-lg animate-bounce">
                  {readyOrders.length}
                </span>
              )}
            </div>
          </button>

          {/* Button 2: Active Orders Modal */}
          <button
            onClick={() => setShowActiveOrders(true)}
            className="relative group p-4 bg-blue-600 text-white rounded-[24px] shadow-xl active:scale-95 transition-all flex flex-col items-center justify-center gap-2 border-b-4 border-blue-800"
          >
            <div className="p-2 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
              {ICONS.History}
            </div>
            <div className="text-center">
              <span className="text-[9px] font-black uppercase tracking-tighter italic">Active Order</span>
              {activeOrders.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-white text-blue-600 text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-blue-600 shadow-lg">
                  {activeOrders.length}
                </span>
              )}
            </div>
          </button>

          {/* Button 3: New Orders (Pending Customer) Modal */}
          <button
            onClick={() => setShowPendingOrders(true)}
            className={`relative group p-4 rounded-[24px] shadow-xl active:scale-95 transition-all flex flex-col items-center justify-center gap-2 border-b-4 ${blinkPending ? 'bg-indigo-600 animate-pulse border-indigo-800 ring-4 ring-indigo-500/50' : 'bg-indigo-600 border-indigo-800 text-white'}`}
          >
            <div className="p-2 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
              {ICONS.Inbox}
            </div>
            <div className="text-center">
              <span className="text-[9px] font-black uppercase tracking-tighter italic">New Order</span>
              {pendingOrders.filter(o => o.status === 'pending_customer').length > 0 && (
                <span className="absolute -top-1 -right-1 bg-white text-indigo-600 text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-indigo-600 shadow-lg animate-bounce">
                  {pendingOrders.filter(o => o.status === 'pending_customer').length}
                </span>
              )}
            </div>
          </button>
        </div>
      )}

      {/* Item Grid */}
      <motion.div
        layout
        className="grid grid-cols-2 sm:grid-cols-3 md:gap-4 lg:gap-6 gap-3"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1
            }
          }
        }}
      >
        {filteredItems.map(item => {
          const totalQtyInCart = cart
            .filter(i => i.id === item.id)
            .reduce((sum, i) => sum + i.quantity, 0);

          return (
            <motion.div
              layout
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              key={item.id}
              onClick={() => setSelectedItemForQty(item)}
              className="bg-[var(--bg-card)] rounded-[24px] border overflow-hidden transition-all shadow-xl group relative active:scale-95 border-[var(--border)] hover:border-orange-600 cursor-pointer aspect-square"
            >
              {/* Image Container - Now Fills Entire Card */}
              <div className="absolute inset-0 w-full h-full bg-gray-900/10">
                <img 
                  src={api.getImageUrl(item.image)} 
                  alt={item.name} 
                  loading="lazy" 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80'; // Fallback
                  }}
                />
                
                {/* Dark Gradient Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
              </div>

              {/* Price Tag */}
              <div className="absolute top-2 right-2 bg-orange-600/90 backdrop-blur-md text-white px-2 py-1 rounded-lg text-[10px] font-black border border-white/20 shadow-lg z-20">
                {item.unit === 'rs' ? 'Any' : `Rs.${item.price}`}
              </div>

              {/* Item Name Overlay at Bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-2 text-center z-30">
                <h3 className="text-[14px] sm:text-2xl md:text-3xl font-black uppercase text-white leading-tight drop-shadow-md px-1 whitespace-normal">
                  {item.name}
                </h3>
              </div>

              {/* Quantity Counter Overlay */}
              {totalQtyInCart > 0 && (
                <div className="absolute top-2 left-2 bg-white text-orange-600 min-w-[28px] h-7 px-2 rounded-xl flex items-center justify-center text-[12px] font-black z-40 shadow-2xl border-2 border-orange-600 animate-in zoom-in">
                  {item.unit === 'rs' ? `Rs.${totalQtyInCart}` : totalQtyInCart}
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Order Taker QR Code for Customers - Hidden as requested */}
      {/* {activeStaff && (
        <div className="bg-[var(--bg-card)] rounded-[24px] border border-orange-600/20 p-6 shadow-2xl text-center">
          <h3 className="text-lg font-black uppercase text-orange-600 mb-4">Scan to Order</h3>
          <div className="flex justify-center">
            <QRCodeCanvas
              value={`${window.location.href.split('?')[0].split('#')[0]}?mode=customer&takerId=${activeStaff.id}&token=${Math.floor(Date.now() / 86400000)}`}
              size={150}
              bgColor="#000000"
              fgColor="#ffffff"
              level="M"
            />
          </div>
          <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-4">Customers can scan this QR to view menu and place orders</p>
        </div>
      )} */}

      {/* Qty Modal */}
      {selectedItemForQty && (
        <div className={`fixed inset-0 bg-black/95 backdrop-blur-2xl z-[5000] flex items-start justify-center p-4 pt-20 ${isClosingQty ? 'animate-out fade-out' : 'animate-in fade-in'}`}>
          <div className={`bg-[var(--bg-card)] rounded-[40px] border border-white/10 w-full max-w-[320px] shadow-2xl border-b-8 border-b-orange-600 flex flex-col ${isClosingQty ? 'animate-out zoom-out' : 'animate-in zoom-in'}`}>
            <div className="p-6 text-center space-y-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-black uppercase tracking-tighter text-white italic">{selectedItemForQty.name}</h3>
                <p className="text-[12px] font-black text-orange-600 uppercase">{selectedItemForQty.unit === 'rs' ? 'Flexible Amount' : `Rate: Rs.${selectedItemForQty.price}`}</p>
              </div>

              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-widest text-center">Add Quantity</p>
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => setInputQty(prev => Math.max(selectedItemForQty.unit === 'rs' ? 10 : 1, (parseFloat(prev) || 0) - (selectedItemForQty.unit === 'rs' ? 50 : 1)).toString())} className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-orange-600 active:scale-90 transition-all border border-white/5">{ICONS.Minus}</button>
                  <input
                    ref={qtyInputRef}
                    type="number"
                    inputMode="decimal"
                    className="w-24 py-3 bg-black/40 border-2 border-orange-600/20 rounded-2xl text-center text-2xl font-black text-white outline-none focus:border-orange-600 transition-all"
                    value={inputQty}
                    onChange={e => setInputQty(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (setCart(prev => [...prev, { ...selectedItemForQty, quantity: parseFloat(inputQty) }]), closeQtyModal())}
                  />
                  <button onClick={() => setInputQty(prev => ((parseFloat(prev) || 0) + (selectedItemForQty.unit === 'rs' ? 50 : 1)).toString())} className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-orange-600 active:scale-90 transition-all border border-white/5">{ICONS.Plus}</button>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-1.5">
                {quickQtys.map(num => (
                  <button key={num} onClick={() => setInputQty(num.toString())} className={`py-2 px-4 rounded-lg text-[10px] font-black border transition-all active:scale-95 ${inputQty === num.toString() ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white/5 border-white/10 text-[var(--text-muted)]'}`}>{num}</button>
                ))}
              </div>

              <div className="flex gap-2 pt-4 border-t border-white/5 items-center">
                <button onClick={closeQtyModal} className="px-2 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Cancel</button>
                {cart.find(i => i.id === selectedItemForQty.id) && (
                  <button 
                    onClick={() => {
                      setCart(prev => prev.filter(i => i.id !== selectedItemForQty.id));
                      closeQtyModal();
                      notify("Item removed", "info");
                    }}
                    className="p-3 bg-red-600/10 text-red-500 rounded-xl active:scale-90 transition-all border border-red-500/20"
                  >
                    {ICONS.Trash2}
                  </button>
                )}
                <button
                  onClick={() => { 
                    const qty = parseFloat(inputQty);
                    if (isNaN(qty) || qty <= 0) {
                      notify("Sahi quantity likhen", "error");
                      return;
                    }

                    // Fraud Prevention Check
                    if (currentOrderId && activeStaff?.role === 'taker') {
                      const original = originalItemsRef.current.find(i => i.id === selectedItemForQty.id);
                      if (original && qty < original.quantity) {
                         notify(`Fraud Prevention: Aap quantity kam nahi ker sakte (${original.quantity} se kam nahi)`, "error");
                         return;
                      }
                    }

                    setCart(prev => {
                      const exists = prev.find(i => i.id === selectedItemForQty.id);
                      if (exists) {
                        return prev.map(i => i.id === selectedItemForQty.id ? { ...i, quantity: qty } : i);
                      }
                      return [...prev, { ...selectedItemForQty, quantity: qty }];
                    }); 
                    closeQtyModal(); 
                    notify("Item updated", "success"); 
                  }}
                  className="flex-1 bg-orange-600 text-white rounded-2xl py-4 font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all border-b-4 border-orange-800"
                >
                  Confirm Rs.{(currentItemTotal || 0).toFixed(0)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Summary Trigger */}
      <AnimatePresence>
        {cart.length > 0 && !isCheckoutOpen && !successOrder && !selectedItemForQty && (
          <motion.div 
            initial={{ y: 100 }} 
            animate={{ y: 0 }} 
            className="fixed bottom-0 left-0 right-0 z-[1000] bg-[var(--bg-nav)]/95 backdrop-blur-2xl border-t border-white/10 flex flex-col items-center p-4 pb-safe rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
          >
            {isCustomerMode ? (
              <div className="flex flex-col items-center gap-2 w-full">
                <button
                  onClick={() => setIsCheckoutOpen(true)}
                  className="w-full max-w-md bg-orange-600 text-white p-3 rounded-[24px] shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all border-b-4 border-orange-800"
                >
                  <div className="bg-white/20 p-2 rounded-xl">{ICONS.ShoppingBag}</div>
                  <p className="text-xl font-black italic leading-none">{cart.length} Items</p>
                </button>
                
                <button
                  onClick={() => handleCheckout('kitchen')}
                  className="w-full max-w-md bg-indigo-600 text-white p-3 rounded-[24px] shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all border-b-4 border-indigo-900 animate-pulse"
                >
                  <div className="bg-white/20 p-2 rounded-xl">{ICONS.Send}</div>
                  <p className="text-lg font-black italic leading-none">Send: Rs.{finalTotal.toFixed(0)}</p>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setIsCheckoutOpen(true);
                  if (!isCustomerMode) {
                    setCustomerPhone('');
                    setCustomerWhatsApp('');
                    setCustomerName('');
                  }
                }}
                className="w-full max-w-md bg-gradient-to-r from-orange-600 to-orange-500 text-white p-4 rounded-[24px] shadow-2xl flex items-center justify-center active:scale-95 transition-all border-b-4 border-orange-800 gap-4"
              >
                <div className="bg-white/20 p-2 rounded-xl text-white">
                  {ICONS.ShoppingBag}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-white text-xl font-black italic leading-none">{cart.length} Items</p>
                  <span className="text-white/40">|</span>
                  <p className="text-white text-2xl font-black italic tracking-tighter leading-none">Rs.{finalTotal.toFixed(0)}</p>
                </div>
              </button>
            )}

            <div className="text-center">
              <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                v1.6 - Phone Optional & Bottom Position
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout Full Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl z-[2500] flex flex-col justify-end">
          <div className="bg-[var(--bg-nav)] rounded-t-[50px] h-[85vh] w-full max-w-md mx-auto flex flex-col shadow-2xl border-t border-white/5 animate-in slide-in-from-bottom duration-400 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[var(--bg-nav)] z-10 rounded-t-[50px]">
              <div>
                <h3 className="font-black text-xl uppercase tracking-tighter text-orange-600 italic">Checkout</h3>
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none mt-1">{cart.length} Items Selected</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">Total Bill</p>
                  <p className="text-xl font-black text-emerald-500 italic tracking-tighter leading-none">Rs.{finalTotal.toFixed(0)}</p>
                </div>
                <button onClick={() => setIsCheckoutOpen(false)} className="p-3 rounded-2xl bg-white/5 text-white">{ICONS.X}</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-20">
              <div className="relative space-y-3">
                {/* Order Type Dropdown at the top */}
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Order Type</p>
                  <select 
                    value={orderType}
                    onChange={e => setOrderType(e.target.value)}
                    className="w-full p-5 bg-black/40 border-2 border-white/5 rounded-[24px] outline-none font-black text-orange-600 text-center uppercase focus:border-orange-600 transition-all text-xs appearance-none"
                  >
                    <option value="Dine In">Dine In 🍽️</option>
                    {canSettlePayment && (
                      <>
                        <option value="Take Away">Take Away 🥡</option>
                        <option value="Home Delivery">Home Delivery 🛵</option>
                        <option value="Other">Other 📦</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="CUSTOMER NAME (OPTIONAL)"
                    className="w-full p-5 bg-black/40 border-2 border-white/5 rounded-[24px] outline-none font-black text-white text-center uppercase focus:border-orange-600 transition-all text-[10px]"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="WHATSAPP # (OPTIONAL)"
                    className="w-full p-5 bg-black/40 border-2 border-white/5 rounded-[24px] outline-none font-black text-white text-center uppercase focus:border-orange-600 transition-all text-[10px]"
                    value={customerWhatsApp}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setCustomerWhatsApp(val);
                      setCustomerPhone(val);
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="TABLE # / BUZZER *"
                      className={`w-full p-5 bg-black/40 border-2 rounded-[24px] outline-none font-black text-white text-center uppercase focus:border-orange-600 transition-all ${!tableNumber.trim() ? 'border-orange-600/30 ring-2 ring-orange-600/5' : 'border-white/5'}`}
                      value={tableNumber}
                      onChange={e => setTableNumber(e.target.value)}
                    />
                  </div>
                  
                  {/* Payment Method Dropdown where Kitchen Notes was */}
                  <div className="space-y-1">
                    <select 
                      value={selectedPaymentMethod}
                      onChange={e => setSelectedPaymentMethod(e.target.value)}
                      className="w-full p-5 bg-black/40 border-2 border-white/5 rounded-[24px] outline-none font-black text-emerald-500 text-center uppercase focus:border-emerald-600 transition-all text-[10px] appearance-none"
                    >
                      {settings.paymentMethods?.filter(m => m.isEnabled).map(method => (
                        <option key={method.id} value={method.id}>{method.label.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>



              {/* Payment Settlement for Take Away / Home Delivery / Other */}
              {orderType !== 'Dine In' && canSettlePayment && (
                <div className="p-6 bg-black/30 rounded-[32px] border-2 border-emerald-600/20 space-y-4 shadow-inner">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.2em] italic">Settlement <span className="text-white">(Bill Pay)</span></h4>
                    <div className="px-3 py-1 bg-emerald-600/10 rounded-full border border-emerald-600/20">
                      <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Total: Rs.{finalTotal.toFixed(0)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-3">Received</p>
                      <input 
                        type="number"
                        placeholder="0.00"
                        className="w-full p-4 bg-black/40 border-2 border-white/5 rounded-2xl outline-none font-black text-emerald-400 text-center focus:border-emerald-600 transition-all text-lg"
                        value={receivedAmount}
                        onChange={e => setReceivedAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-3">Change (Baqi)</p>
                      <div className="w-full p-4 bg-emerald-600/10 border-2 border-emerald-600/20 rounded-2xl font-black text-white text-center text-lg flex items-center justify-center italic">
                        Rs.{(Math.max(0, (Number(receivedAmount) || 0) - (finalTotal || 0))).toFixed(0)}
                      </div>
                    </div>
                  </div>
                  
                  {(Number(receivedAmount) || 0) < (finalTotal || 0) && (
                    <p className="text-[8px] font-black text-orange-600 uppercase text-center tracking-widest animate-pulse">
                      Pending Balance: Rs.{ ((finalTotal || 0) - (Number(receivedAmount) || 0)).toFixed(0) }
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-2 bg-[var(--bg-card)] p-3 rounded-[20px] border border-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm uppercase truncate text-white italic leading-none mb-1">{item.name}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-orange-600 font-black text-[10px]">Rs.{item.price}</span>
                        <div className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-0.5 border border-white/5">
                          <button 
                            onClick={() => {
                              if (currentOrderId && activeStaff?.role === 'taker') {
                                const original = originalItemsRef.current.find(it => it.id === item.id);
                                if (original && item.quantity <= original.quantity) {
                                  notify("Fraud Prevention: Quantity kam nahi ker sakte", "error");
                                  return;
                                }
                              }
                              setCart(prev => prev.map(it => it.id === item.id ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it));
                            }}
                            className="text-white/40 hover:text-white"
                          >
                            {ICONS.Minus}
                          </button>
                          <span className="text-[12px] font-black text-white min-w-[20px] text-center">{item.quantity}</span>
                          <button 
                            onClick={() => {
                              setCart(prev => prev.map(it => it.id === item.id ? { ...it, quantity: it.quantity + 1 } : it));
                            }}
                            className="text-white/40 hover:text-white"
                          >
                            {ICONS.Plus}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <p className="text-white font-black text-xs">Rs.{(item.price * item.quantity).toFixed(0)}</p>
                      <button 
                        onClick={() => {
                          if (currentOrderId && activeStaff?.role === 'taker') {
                            const isOriginal = originalItemsRef.current.some(i => i.id === item.id);
                            if (isOriginal) {
                              notify("Fraud Prevention: Purana item delete nahi ho sakta", "error");
                              return;
                            }
                          }
                          setItemToRemove(item);
                        }} 
                        className="p-2 text-red-500 bg-red-500/10 rounded-xl active:scale-90 transition-all"
                      >
                        {ICONS.Trash2}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Taker & Table Info for Customer */}
              {isCustomerMode && (
                <div className="bg-indigo-600/10 border border-indigo-600/20 p-5 rounded-[32px] flex items-center justify-between">
                  <div className="flex flex-col">
                    <p className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Sending Order To</p>
                    <p className="text-lg font-black text-white uppercase italic leading-none">{currentOrderTakerId ? `Order Taker #${currentOrderTakerId.substring(0,4)}` : 'Main Counter'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">At Table</p>
                    <p className="text-xl font-black text-white italic leading-none">{tableNumber || 'N/A'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Combined Final Actions */}
            <div className="p-4 pb-20 bg-[var(--bg-nav)] border-t border-white/5 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
              {/* Kitchen and Draft Row - Prominent */}
              {!isCustomerMode && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleCheckout('kitchen')}
                    className={`flex-1 ${currentOrderId ? 'bg-indigo-600 border-indigo-800' : 'bg-orange-600 border-orange-800'} text-white py-6 rounded-[24px] font-black uppercase text-[14px] tracking-widest shadow-xl active:scale-95 transition-all border-b-8 flex items-center justify-center gap-3`}
                  >
                    {ICONS.Utensils} {currentOrderId ? 'Send New Items' : 'Send to Kitchen'}
                  </button>
                  {!currentOrderId && (
                    <button
                      onClick={() => handleCheckout('draft')}
                      className="w-24 bg-white/5 text-blue-500 py-6 rounded-[24px] font-black uppercase text-[10px] tracking-tight border border-blue-600/20 active:scale-95 transition-all flex flex-col items-center justify-center leading-none"
                    >
                      <span className="opacity-60 mb-1">{ICONS.Save}</span>
                      DRAFT
                    </button>
                  )}
                  {currentOrderId && (
                    <button
                      onClick={() => handleCheckout('update')}
                      className="w-24 bg-emerald-600/10 text-emerald-500 py-6 rounded-[24px] font-black uppercase text-[10px] tracking-tight border border-emerald-600/20 active:scale-95 transition-all flex flex-col items-center justify-center leading-none"
                    >
                      <span className="opacity-60 mb-1">{ICONS.Refresh}</span>
                      UPDATE
                    </button>
                  )}
                </div>
              )}
              {isCustomerMode && (
                <button
                  onClick={() => handleCheckout('kitchen')}
                  className="w-full bg-indigo-600 text-white py-6 rounded-[24px] font-black uppercase text-[14px] tracking-widest shadow-2xl active:scale-95 transition-all border-b-8 border-indigo-800 flex items-center justify-center gap-3"
                >
                  {ICONS.CheckCircle} SEND ORDER
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[4000] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[24px] border border-white/10 w-full max-w-sm p-4 space-y-3 animate-in zoom-in shadow-2xl relative">
            <button
              onClick={() => setIsScannerOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 text-white z-10"
            >
              {ICONS.X}
            </button>
            <div className="text-center space-y-1">
              <h3 className="text-xl font-black uppercase tracking-tighter italic text-white">QR <span className="text-orange-600">Scanner</span></h3>
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Scan Item or Customer QR</p>
            </div>
            <div id="qr-reader" className="overflow-hidden rounded-2xl border-2 border-orange-600/20 bg-black/40 aspect-square"></div>
            <p className="text-[8px] font-black text-center text-orange-600 uppercase animate-pulse">Align QR code within the frame</p>
          </div>
        </div>
      )}


      {/* Active Orders Modal */}
      <AnimatePresence>
        {showActiveOrders && (
          <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--bg-card)] rounded-[48px] border border-white/5 w-full max-w-2xl p-8 space-y-8 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/20">
                    {ICONS.History}
                  </div>
                  <div>
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-none">Order</h3>
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">Active orders in progress</p>
                  </div>
                </div>
                <button onClick={() => setShowActiveOrders(false)} className="p-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all">{ICONS.X}</button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8">
                {/* Current Selection / Cart Review */}
                {cart.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-4">
                       <div className="h-px flex-1 bg-orange-600/30"></div>
                       <h4 className="text-[12px] font-black text-orange-600 uppercase tracking-[0.4em] italic">Current Selection</h4>
                       <div className="h-px flex-1 bg-orange-600/30"></div>
                    </div>
                    <div className="bg-orange-600/5 rounded-[40px] border border-orange-600/10 p-6 space-y-4 shadow-xl">
                      <div className="space-y-3">
                        {cart.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-black/60 p-4 rounded-2xl border border-white/5 group hover:border-orange-600/30 transition-all shadow-inner">
                             <div className="flex flex-col">
                                <p className="text-[16px] font-black text-white uppercase italic leading-none">{item.name}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[8px] font-black bg-orange-600/20 text-orange-600 px-1.5 py-0.5 rounded uppercase">Rate: Rs.{item.price}</span>
                                  <span className="text-[8px] font-black bg-white/5 text-white/40 px-1.5 py-0.5 rounded uppercase">Qty: {item.quantity}</span>
                                </div>
                             </div>
                             <div className="text-right">
                               <p className="text-xl font-black text-white italic tracking-tighter leading-none">Rs.{(item.price * item.quantity).toFixed(0)}</p>
                               <p className="text-[8px] font-black text-orange-600/40 uppercase mt-1">Total Item</p>
                             </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 border-t border-orange-600/10 flex justify-between items-center px-2">
                         <p className="text-sm font-black text-white/40 uppercase italic tracking-widest">Estimated Total</p>
                         <p className="text-3xl font-black text-orange-600 tracking-tighter italic">Rs.{finalTotal.toFixed(0)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => { setShowActiveOrders(false); setIsCheckoutOpen(true); }}
                          className="py-5 bg-orange-600 text-white rounded-[24px] font-black uppercase tracking-widest text-[12px] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 border-b-8 border-orange-800"
                        >
                          {ICONS.CheckCircle} Checkout
                        </button>
                        <button 
                          onClick={() => {
                            triggerConfirm({
                              title: "Clear Order?",
                              message: "Kya aap waqai is order ko khatam karna chahte hain?",
                              onConfirm: resetForNextBill,
                              type: 'danger'
                            });
                          }}
                          className="py-5 bg-white/5 text-red-500 rounded-[24px] font-black uppercase tracking-widest text-[12px] active:scale-95 transition-all border border-white/10"
                        >
                          {ICONS.Trash2} Clear
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 px-4 pt-4">
                   <div className="h-px flex-1 bg-blue-600/30"></div>
                   <h4 className="text-[12px] font-black text-blue-500 uppercase tracking-[0.4em] italic">Active Orders</h4>
                   <div className="h-px flex-1 bg-blue-600/30"></div>
                </div>

                {activeOrders.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="text-6xl opacity-10">{ICONS.History}</div>
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">No active orders found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeOrders.map(order => {
                      const timeDiff = Date.now() - order.timestamp;
                      const isUrgent = timeDiff > 15 * 60 * 1000 && order.status !== 'ready';
                      const progress = order.status === 'received' ? 25 : order.status === 'accepted' ? 50 : order.status === 'preparing' ? 75 : order.status === 'ready' ? 100 : 0;
                      const statusColor = order.status === 'received' ? 'bg-blue-500' : order.status === 'accepted' ? 'bg-indigo-500' : order.status === 'preparing' ? 'bg-amber-500' : order.status === 'ready' ? 'bg-emerald-500' : 'bg-gray-500';

                      return (
                        <div
                          key={order.id}
                          onClick={() => {
                            setCart(order.items);
                            setCustomerName(order.customerName);
                            setCustomerPhone(order.customerPhone);
                            setTableNumber(order.tableNumber || '');
                            setCurrentOrderId(order.id);
                            setSelectedPaymentMethod(order.paymentMethod || 'cash');
                            setShowActiveOrders(false);
                            notify("Order loaded! You can add more items.", "success");
                          }}
                          className={`w-full bg-black/40 p-5 rounded-[32px] border space-y-4 text-left transition-all active:scale-[0.98] cursor-pointer relative overflow-hidden group ${isUrgent ? 'border-red-600/30 bg-red-600/5' : 'border-white/5 hover:border-blue-500/50'
                            }`}
                        >
                          {/* Progress Bar */}
                          <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
                            <div className={`h-full transition-all duration-1000 ${statusColor}`} style={{ width: `${progress}%` }} />
                          </div>

                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                                  <span className="text-2xl font-black">#{order.orderNumber || '??'}</span>
                                </span>
                                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black text-white uppercase tracking-widest ${statusColor}`}>
                                  {order.status?.toUpperCase()}
                                </span>
                                {order.tableNumber && (
                                  <span className="text-[8px] font-black text-orange-600 uppercase tracking-widest bg-orange-600/10 px-2 py-0.5 rounded-lg border border-orange-600/20">
                                    Table {order.tableNumber}
                                  </span>
                                )}
                                {(order.updateCount || 0) > 1 && (
                                  <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                                    Update {order.updateCount}
                                  </span>
                                )}
                              </div>
                              <p className="text-xl font-black text-white uppercase italic leading-none truncate max-w-[140px]">{order.customerName}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-black text-white italic leading-none">Rs.{order.total.toFixed(0)}</p>
                              <TimeElapsed
                                timestamp={order.timestamp}
                                statusTimestamps={order.statusTimestamps}
                                currentStatus={order.status}
                                className={`text-[10px] font-black uppercase block mt-1 ${isUrgent ? 'text-red-500 animate-pulse' : 'text-orange-600'}`}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
                            <div className="flex -space-x-2 overflow-hidden">
                              {order.items.slice(0, 3).map((item, idx) => (
                                <div key={idx} className="w-8 h-8 rounded-full border-2 border-black bg-white/10 flex items-center justify-center text-[8px] font-black text-white/70 uppercase">
                                  {item.name.charAt(0)}
                                </div>
                              ))}
                              {order.items.length > 3 && (
                                <div className="w-8 h-8 rounded-full border-2 border-black bg-white/5 flex items-center justify-center text-[8px] font-black text-white/50">
                                  +{order.items.length - 3}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {order.status === 'ready' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShareWhatsApp(order);
                                    onUpdateOrder({
                                      ...order,
                                      status: 'delivered',
                                      statusTimestamps: {
                                        ...order.statusTimestamps,
                                        delivered: Date.now()
                                      }
                                    });
                                    notify("Order Served & Bill Sent!", "success");
                                  }}
                                  className="px-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all hover:bg-emerald-500 flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                                >
                                  {ICONS.CheckCircle}
                                  Finish
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCart([]); // Start empty for additions
                                  originalItemsRef.current = [...order.items];
                                  setCustomerName(order.customerName);
                                  setCustomerPhone(order.customerPhone);
                                  setTableNumber(order.tableNumber || '');
                                  setCurrentOrderId(order.id);
                                  setShowActiveOrders(false);
                                  notify("Order loaded for editing", "info");
                                }}
                                className="px-4 py-2 bg-blue-500/10 text-blue-500 rounded-2xl active:scale-75 transition-all hover:bg-blue-500/20 flex items-center gap-2 border border-blue-500/20"
                              >
                                {ICONS.Edit}
                                <span className="text-[10px] font-black uppercase tracking-widest">Update</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowActiveOrders(false)}
                className="w-full py-6 bg-white/5 text-white rounded-[32px] font-black uppercase text-[12px] tracking-widest border border-white/5 hover:bg-white/10 transition-all"
              >
                Close Dashboard
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ready Orders Modal */}
      <AnimatePresence>
        {showReadyOrders && (
          <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--bg-card)] rounded-[48px] border border-white/5 w-full max-w-2xl p-8 space-y-8 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-600/20">
                    {ICONS.CheckCircle}
                  </div>
                  <div>
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-none">Ready <span className="text-emerald-500">Orders</span></h3>
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">Serve these to customers now</p>
                  </div>
                </div>
                <button onClick={() => setShowReadyOrders(false)} className="p-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all">{ICONS.X}</button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {readyOrders.map(order => (
                    <div key={order.id} className="bg-black/40 p-5 rounded-[32px] border border-emerald-500/20 space-y-4 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />

                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xl font-black text-white uppercase italic leading-none truncate max-w-[140px]">{order.customerName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                              #{order.orderNumber || '??'}
                            </span>
                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                              Table {order.tableNumber || 'N/A'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-white italic leading-none">Rs.{order.total.toFixed(0)}</p>
                          <TimeElapsed
                            timestamp={order.timestamp}
                            statusTimestamps={order.statusTimestamps}
                            currentStatus={order.status}
                            className="text-[10px] font-black text-emerald-500 uppercase block mt-1"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 py-3 border-y border-white/5">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Order Items</p>
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white/5 p-2 rounded-xl">
                            <p className="text-[11px] font-black text-white uppercase italic">{item.name}</p>
                            <p className="text-[11px] font-black text-emerald-500">x{item.quantity}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        {isAdmin && (
                          <button
                            onClick={() => {
                              onUpdateOrder({ 
                                ...order, 
                                status: 'served',
                                statusTimestamps: { ...order.statusTimestamps, served: Date.now() }
                              });
                              notify("Order marked as served!", "success");
                              if (readyOrders.length === 1) setShowReadyOrders(false);
                            }}
                            className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-600/20 active:scale-95 transition-all hover:bg-emerald-500 flex items-center justify-center gap-2"
                          >
                            {ICONS.CheckCircle}
                            Serve
                          </button>
                        )}
                          <button
                            onClick={() => {
                              setCart(order.items);
                              setCustomerName(order.customerName);
                              setCustomerPhone(order.customerPhone);
                              setTableNumber(order.tableNumber || '');
                              setCurrentOrderId(order.id);
                              setShowReadyOrders(false);
                              onUpdateOrder({
                                ...order,
                                status: 'received',
                                statusTimestamps: { ...order.statusTimestamps, received: Date.now() }
                              });
                              notify("Ready Order loaded for editing", "info");
                            }}
                            className="flex-1 py-4 bg-blue-600/10 text-blue-500 rounded-2xl border border-blue-600/20 font-black uppercase text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            {ICONS.Edit}
                            <span className="text-[10px] font-black uppercase tracking-widest">Update</span>
                          </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowReadyOrders(false)}
                className="w-full py-6 bg-white/5 text-white rounded-[32px] font-black uppercase text-[12px] tracking-widest border border-white/5 hover:bg-white/10 transition-all"
              >
                Close Ready Orders
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Served Orders Modal */}
      <AnimatePresence>
        {showServedOrders && (
          <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--bg-card)] rounded-[48px] border border-white/5 w-full max-w-2xl p-8 space-y-8 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20">
                    {ICONS.CheckCircle}
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-none">Served <span className="text-indigo-500">Orders</span></h3>
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">Add items or generate bill</p>
                  </div>
                </div>
                <button onClick={() => setShowServedOrders(false)} className="p-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all">{ICONS.X}</button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {servedOrders.map(order => (
                    <div key={order.id} className="bg-black/40 p-5 rounded-[32px] border border-indigo-500/20 space-y-4 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500" />

                      <div className="flex justify-between items-start">
                        <div className="flex flex-col items-center text-center w-full">
                          <p className="text-2xl font-black text-white uppercase italic leading-none truncate max-w-full mb-3">{order.customerName}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-4xl font-black text-indigo-500 uppercase tracking-widest bg-indigo-500/10 px-4 py-2 rounded-2xl border-2 border-indigo-500/20">
                              #{order.orderNumber || '??'}
                            </span>
                            <div className="flex flex-col items-start bg-indigo-500/10 px-3 py-1 rounded-xl border border-indigo-500/20">
                              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Table</span>
                              <span className="text-lg font-black text-white uppercase tracking-tighter leading-none">{order.tableNumber || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center w-full">
                          <p className="text-2xl font-black text-white italic leading-none">Rs.{order.total.toFixed(0)}</p>
                          <TimeElapsed
                            timestamp={order.timestamp}
                            statusTimestamps={order.statusTimestamps}
                            currentStatus={order.status}
                            className="text-[10px] font-black text-indigo-500 uppercase block mt-2"
                          />
                        </div>
                      </div>

                      <div className="space-y-3 py-4 border-y border-white/5">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 text-center">Order Items</p>
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5">
                            <div className="flex flex-col">
                              <p className="text-[14px] font-black text-white uppercase italic leading-none">{item.name}</p>
                              <p className="text-[10px] font-bold text-white/40 mt-1">Rs.{item.price} per {item.unit}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => {
                                  const updatedItems = [...order.items];
                                  if (updatedItems[idx].quantity > 1) {
                                    updatedItems[idx].quantity -= 1;
                                  } else {
                                    updatedItems.splice(idx, 1);
                                  }

                                  const subtotal = updatedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
                                  const tax = settings?.isTaxEnabled ? (subtotal * settings.taxRate / 100) : 0;
                                  const discount = settings?.isDiscountEnabled ? (subtotal * (settings?.defaultDiscount || 0) / 100) : 0;
                                  const total = subtotal + tax - discount + (order.deliveryFee || 0);

                                  onUpdateOrder({ ...order, items: updatedItems, subtotal, tax, discount, total });
                                }}
                                className="w-8 h-8 flex items-center justify-center bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 active:scale-90 transition-all"
                              >
                                {ICONS.Minus}
                              </button>
                              <p className="text-[16px] font-black text-white min-w-[30px] text-center">{item.quantity}</p>
                              <button
                                onClick={() => {
                                  const updatedItems = [...order.items];
                                  updatedItems[idx].quantity += 1;

                                  const subtotal = updatedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
                                  const tax = settings?.isTaxEnabled ? (subtotal * settings.taxRate / 100) : 0;
                                  const discount = settings?.isDiscountEnabled ? (subtotal * (settings?.defaultDiscount || 0) / 100) : 0;
                                  const total = subtotal + tax - discount + (order.deliveryFee || 0);

                                  onUpdateOrder({ ...order, items: updatedItems, subtotal, tax, discount, total });
                                }}
                                className="w-8 h-8 flex items-center justify-center bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 active:scale-90 transition-all"
                              >
                                {ICONS.Plus}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Quick Add Custom Item */}
                      <div className="bg-white/5 p-4 rounded-[32px] border border-white/5 space-y-4 flex flex-col items-center">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest text-center">Quick Add Item</p>
                        <div className="flex flex-col gap-3 w-full max-w-xs">
                          <select
                            value={quickAdd[order.id]?.itemId || ''}
                            onChange={e => setQuickAdd({ ...quickAdd, [order.id]: { ...(quickAdd[order.id] || {}), itemId: e.target.value } })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[12px] text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none text-center"
                          >
                            <option value="" className="bg-gray-900">Select Item...</option>
                            {Object.entries(items.reduce((acc, item) => {
                              if (!acc[item.category]) acc[item.category] = [];
                              acc[item.category].push(item);
                              return acc;
                            }, {} as Record<string, MenuItem[]>)).sort(([a], [b]) => a.localeCompare(b)).map(([category, catItems]) => (
                              <optgroup key={category} label={category.toUpperCase()} className="bg-gray-900 text-indigo-400 font-black">
                                {(catItems as MenuItem[]).map(item => (
                                  <option key={item.id} value={item.id} className="bg-gray-900 text-white font-medium">
                                    {item.name} - Rs.{item.price}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>

                          <div className="flex items-center justify-center gap-4">
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Quantity:</span>
                            <input
                              type="number"
                              placeholder="1"
                              min="1"
                              value={quickAdd[order.id]?.qty || '1'}
                              onChange={e => setQuickAdd({ ...quickAdd, [order.id]: { ...(quickAdd[order.id] || {}), qty: e.target.value } })}
                              className="w-20 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-lg font-black text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500 transition-colors text-center"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            const itemId = quickAdd[order.id]?.itemId;
                            const qty = parseFloat(quickAdd[order.id]?.qty || '1');

                            if (!itemId || isNaN(qty) || qty <= 0) {
                              notify("Please select an item and valid quantity", "error");
                              return;
                            }

                            const selectedItem = items.find(i => i.id === itemId);
                            if (!selectedItem) {
                              notify("Item not found", "error");
                              return;
                            }

                            // Check if item already exists in order
                            const existingItemIndex = order.items.findIndex(i => i.id === selectedItem.id);
                            let updatedItems = [...order.items];

                            if (existingItemIndex >= 0) {
                              updatedItems[existingItemIndex] = {
                                ...updatedItems[existingItemIndex],
                                quantity: updatedItems[existingItemIndex].quantity + qty
                              };
                            } else {
                              const newItem: OrderItem = {
                                ...selectedItem,
                                quantity: qty
                              };
                              updatedItems.push(newItem);
                            }

                            const newSubtotal = updatedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
                            const newTax = settings?.isTaxEnabled ? (newSubtotal * settings.taxRate / 100) : 0;
                            const newDiscount = settings?.isDiscountEnabled ? (newSubtotal * (settings?.defaultDiscount || 0) / 100) : 0;
                            const newTotal = newSubtotal + newTax - newDiscount + (order.deliveryFee || 0);

                            onUpdateOrder({
                              ...order,
                              items: updatedItems,
                              subtotal: newSubtotal,
                              tax: newTax,
                              discount: newDiscount,
                              total: newTotal
                            });

                            setQuickAdd({ ...quickAdd, [order.id]: { itemId: '', qty: '1' } });
                            notify(`${selectedItem.name} added to bill!`, "success");
                          }}
                          className="w-full max-w-xs bg-indigo-600 text-white px-6 py-4 rounded-[20px] font-black text-[12px] active:scale-95 transition-all shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 uppercase tracking-widest mt-2"
                        >
                          ADD TO BILL
                        </button>

                        <button
                          onClick={() => {
                            setTargetOrderForPicker(order);
                            setShowMenuPicker(true);
                          }}
                          className="w-full max-w-xs bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 px-6 py-4 rounded-[20px] font-black text-[12px] active:scale-95 transition-all hover:bg-indigo-600/20 uppercase tracking-widest mt-2 flex items-center justify-center gap-2"
                        >
                          {ICONS.Search}
                          BROWSE FULL MENU
                        </button>
                      </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handlePrint(order)}
                            className="p-4 bg-blue-600 text-white rounded-2xl active:scale-95 transition-all shadow-lg flex items-center justify-center"
                            title="Print Bill"
                          >
                            {ICONS.Printer}
                          </button>

                            <button
                              onClick={() => {
                                setCart([]); // Start empty for additions
                                originalItemsRef.current = [...order.items];
                                setCustomerName(order.customerName);
                                setCustomerPhone(order.customerPhone);
                                setTableNumber(order.tableNumber || '');
                                setCurrentOrderId(order.id);
                                setShowServedOrders(false);
                                onUpdateOrder({
                                  ...order,
                                  status: 'received',
                                  statusTimestamps: { ...order.statusTimestamps, received: Date.now() }
                                });
                                notify("Served Order loaded for editing", "info");
                              }}
                              className="flex-1 py-4 bg-white/5 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/10 active:scale-95 transition-all hover:bg-white/10 flex items-center justify-center gap-2"
                            >
                              {ICONS.Edit}
                              Update Bill
                            </button>

                        <button
                          onClick={() => {
                            handleShareWhatsApp(order);
                            onUpdateOrder({
                              ...order,
                              status: 'delivered',
                              statusTimestamps: {
                                ...order.statusTimestamps,
                                delivered: Date.now()
                              }
                            });
                            notify("Bill Generated & Sent!", "success");
                            if (settings.isAutoPrintBillEnabled) {
                              handlePrint(order);
                            }
                            if (servedOrders.length === 1) setShowServedOrders(false);
                          }}
                          className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[12px] tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 active:scale-95 transition-all hover:bg-indigo-500 group"
                        >
                          {ICONS.CheckCircle}
                          GENERATE BILL
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowServedOrders(false)}
                className="w-full py-6 bg-white/5 text-white rounded-[32px] font-black uppercase text-[12px] tracking-widest border border-white/5 hover:bg-white/10 transition-all"
              >
                Close Served Orders
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pending Customer Orders Modal */}
      <AnimatePresence>
        {showPendingOrders && (
          <div className="fixed inset-0 z-[4500] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPendingOrders(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-[var(--bg-card)] rounded-[48px] border border-white/5 p-8 shadow-2xl space-y-6 max-h-[80vh] flex flex-col"
            >
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Pending <span className="text-emerald-500">Orders</span></h3>
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Drafts and Customer QR Orders</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
                {[...pendingOrders]
                  .sort((a, b) => a.timestamp - b.timestamp)
                  .map(order => {
                    const isCustomerOrder = order.status === 'pending_customer';
                    const timeSince = Date.now() - order.timestamp;
                    const isWaiting = timeSince > 3 * 60 * 1000; // 3 mins
                    return (
                    <div key={order.id} className={`relative bg-white/5 p-5 rounded-[32px] border space-y-4 overflow-hidden ${isCustomerOrder ? 'border-indigo-500/50' : 'border-blue-500/30'}`}>
                      {isCustomerOrder && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500" />
                      )}
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-3 py-1 bg-white/10 text-white text-[14px] font-black uppercase rounded-lg border border-white/10 tracking-widest">#{order.orderNumber || '??'}</span>
                            <p className="text-lg font-black text-white uppercase italic leading-none">{order.customerName}</p>
                            {isCustomerOrder ? (
                              <span className={`px-2 py-0.5 text-white text-[7px] font-black uppercase rounded-full tracking-widest flex items-center gap-1 ${isWaiting ? 'bg-red-500 animate-pulse' : 'bg-indigo-600'}`}>
                                {isWaiting ? '⚠ WAITING' : '👤 CUSTOMER'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-blue-600 text-white text-[7px] font-black uppercase rounded-full tracking-widest">DRAFT</span>
                            )}
                          </div>
                          <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isCustomerOrder ? 'text-indigo-400' : 'text-blue-500'}`}>
                            {order.customerPhone || 'No Phone'}
                          </p>
                          <TimeElapsed
                            timestamp={order.timestamp}
                            statusTimestamps={order.statusTimestamps}
                            currentStatus={order.status}
                            className="text-[8px] font-black text-[var(--text-muted)] uppercase block mt-1"
                          />
                        </div>
                        <p className="text-xs font-black text-[var(--text-muted)]">{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>

                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-[11px] font-bold text-white/60">
                            <span>{item.name} x{item.quantity}</span>
                            <span>Rs.{item.price * item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 border-t border-white/5 flex gap-3">
                        {isAdmin && (
                          <button
                            onClick={() => triggerConfirm({
                              title: "Cancel Order?",
                              message: "Kya aap waqai is order ko cancel karna chahte hain?",
                              onConfirm: () => {
                                onUpdateOrder({ ...order, status: 'cancelled' });
                                notify("Order Cancelled", "error");
                                if (pendingOrders.length === 1) setShowPendingOrders(false);
                              }
                            })}
                            className="p-4 bg-red-500/10 text-red-500 rounded-2xl active:scale-95 transition-all"
                          >
                            {ICONS.Trash2}
                          </button>
                        )}
                        <div className="flex flex-1 gap-2">
                          <button
                            onClick={() => {
                              setCart(order.items);
                              setCustomerName(order.customerName);
                              setCustomerPhone(order.customerPhone);
                              setTableNumber(order.tableNumber || '');
                              setCurrentOrderId(order.id);
                              // Track original items for fraud prevention
                              originalItemsRef.current = JSON.parse(JSON.stringify(order.items));
                              
                              setShowPendingOrders(false);
                              setShowActiveOrders(false);
                              setIsCheckoutOpen(false);
                              notify(`Order #${order.orderNumber} loaded for adding items`, "info");
                              
                              // Scroll to menu
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className={`flex-1 py-4 ${activeStaff?.role === 'taker' ? 'bg-orange-600 text-white' : 'bg-white/5 text-white'} rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all border border-white/10 flex items-center justify-center gap-2 shadow-lg`}
                          >
                            {activeStaff?.role === 'taker' ? ICONS.PlusCircle : ICONS.Edit}
                            {activeStaff?.role === 'taker' ? 'Add Items' : 'Update Order'}
                          </button>
                          <button
                            onClick={() => setSelectedOrderToReview(order)}
                            className="flex-1 py-4 bg-indigo-600/10 text-indigo-400 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all border border-indigo-600/20 flex items-center justify-center gap-2"
                          >
                            {ICONS.Eye}
                            Review
                          </button>
                          <button
                            onClick={() => {
                              // Send directly to kitchen
                              const kitchenTicket: KitchenTicket = {
                                id: `TKT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                                round: (order.updateCount || 0) + 1,
                                timestamp: Date.now(),
                                items: order.items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity })),
                                isPrinted: false,
                                senderName: activeStaff?.name || shopName || 'OWNER'
                              };

                              const updatedOrder: Order = { 
                                ...order, 
                                status: 'received', 
                                statusTimestamps: {
                                  ...order.statusTimestamps,
                                  received: Date.now()
                                },
                                kitchenTickets: [...(order.kitchenTickets || []), kitchenTicket],
                                updateCount: (order.updateCount || 0) + 1
                              };

                              onUpdateOrder(updatedOrder);
                              notify("Sent to Kitchen!", "success");
                              if (pendingOrders.length === 1) setShowPendingOrders(false);
                            }}
                            className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                          >
                            {ICONS.ChefHat}
                            Send to Kitchen
                          </button>
                        </div>
                      </div>
                    </div>
                  ); })}
              </div>

              <button
                onClick={() => setShowPendingOrders(false)}
                className="w-full py-4 bg-white/5 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Review Detail Modal */}
      <AnimatePresence>
        {selectedOrderToReview && (
          <div className="fixed inset-0 z-[6000] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedOrderToReview(null)}
              className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-[var(--bg-card)] rounded-[48px] border border-white/5 p-8 shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">Review Items</h2>
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Order #{selectedOrderToReview.orderNumber}</p>
                </div>
                <button onClick={() => setSelectedOrderToReview(null)} className="p-3 bg-white/5 rounded-2xl text-[var(--text-muted)]">{ICONS.X}</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 no-scrollbar">
                <div className="bg-white/5 rounded-3xl p-6 border border-white/5 space-y-4">
                  {selectedOrderToReview.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5">
                      <div className="flex flex-col">
                        <p className="text-sm font-black text-white uppercase italic">{item.name}</p>
                        <p className="text-[10px] font-bold text-orange-600/60 uppercase">Rate: Rs.{item.price} x {item.quantity}</p>
                      </div>
                      <p className="text-sm font-black text-white italic">Rs.{item.price * item.quantity}</p>
                    </div>
                  ))}
                  
                  <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                    <p className="text-sm font-black text-white uppercase italic">Total Bill</p>
                    <p className="text-2xl font-black text-emerald-500 tracking-tighter italic">Rs.{selectedOrderToReview.total}</p>
                  </div>
                </div>

                <div className="bg-indigo-600/10 border border-indigo-600/20 p-4 rounded-3xl">
                   <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 italic text-center">Customer Details</p>
                   <p className="text-sm font-black text-white text-center uppercase">{selectedOrderToReview.customerName}</p>
                   <p className="text-xs font-bold text-white/40 text-center uppercase mt-1">{selectedOrderToReview.customerPhone}</p>
                   {selectedOrderToReview.tableNumber && (
                     <p className="text-lg font-black text-orange-600 text-center mt-2 uppercase italic tracking-tighter">Table: {selectedOrderToReview.tableNumber}</p>
                   )}
                </div>
              </div>

              <div className="pt-8 grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setSelectedOrderToReview(null)}
                  className="py-5 bg-white/5 text-white rounded-[24px] font-black uppercase tracking-widest text-[12px] active:scale-95 transition-all border border-white/10"
                >
                  Back
                </button>
                <button 
                  onClick={() => {
                    const order = selectedOrderToReview;
                    const kitchenTicket: KitchenTicket = {
                      id: `TKT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                      round: (order.updateCount || 0) + 1,
                      timestamp: Date.now(),
                      items: order.items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity })),
                      isPrinted: false,
                      senderName: activeStaff?.name || shopName || 'OWNER'
                    };

                    const updatedOrder: Order = { 
                      ...order, 
                      status: 'received', 
                      statusTimestamps: {
                        ...order.statusTimestamps,
                        received: Date.now()
                      },
                      kitchenTickets: [...(order.kitchenTickets || []), kitchenTicket],
                      updateCount: (order.updateCount || 0) + 1
                    };

                    onUpdateOrder(updatedOrder);
                    setSelectedOrderToReview(null);
                    if (pendingOrders.length === 1) setShowPendingOrders(false);
                    notify("Sent to Kitchen!", "success");
                  }}
                  className="py-5 bg-emerald-600 text-white rounded-[24px] font-black uppercase tracking-widest text-[12px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {ICONS.ChefHat} Send
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      {successOrder && (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl z-[3000] flex items-center justify-center p-8 animate-in zoom-in duration-500">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-orange-600/20 w-full max-w-sm p-10 space-y-8 shadow-2xl text-center border-b-[12px] border-b-orange-600">
            <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-full mx-auto flex items-center justify-center mb-4 ring-8 ring-emerald-500/5">
              <div className="scale-[2]">{ICONS.History}</div>
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-black uppercase tracking-tighter italic text-white leading-none">Bill <span className="text-orange-600">Saved!</span></h3>
              <p className="text-[12px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-relaxed">Bill Total: Rs.{successOrder.total.toFixed(0)}</p>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <button onClick={() => handlePrint(successOrder, true)} className="w-full py-6 bg-white/5 rounded-[32px] font-black uppercase text-[10px] text-white flex flex-col items-center gap-3 border border-white/10 hover:bg-white/15 transition-all active:scale-95">
                <div className="scale-150 text-orange-600">{ICONS.Printer}</div>
                Print Receipt
              </button>
            </div>

            <button onClick={resetForNextBill} className="w-full py-6 bg-orange-600 text-white rounded-[32px] font-black uppercase text-[14px] shadow-2xl active:scale-95 transition-all tracking-tighter hover:bg-orange-700">DONE / NEXT BILL</button>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {itemToRemove && (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl z-[3500] flex items-center justify-center p-8 animate-in fade-in">
          <div className="bg-[var(--bg-card)] rounded-[48px] border border-red-600/20 w-full max-w-sm p-10 space-y-8 animate-in zoom-in shadow-2xl text-center">
            <div className="w-20 h-20 bg-red-600/10 text-red-600 rounded-[28px] mx-auto flex items-center justify-center mb-4"><div className="scale-125">{ICONS.Trash2}</div></div>
            <div className="space-y-4">
              <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white leading-none">Remove <span className="text-red-600">Item</span>?</h3>
              <p className="text-[12px] font-black text-white uppercase tracking-wider truncate">{itemToRemove.name}</p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setItemToRemove(null)} className="flex-1 py-5 bg-white/5 rounded-[28px] font-black uppercase text-[11px] text-white">Back</button>
              <button onClick={() => { setCart(prev => prev.filter(i => i.id !== itemToRemove.id)); setItemToRemove(null); notify("Item removed", "info"); }} className="flex-1 py-5 bg-red-600 text-white rounded-[28px] font-black uppercase text-[11px] shadow-xl">Delete</button>
            </div>
          </div>
        </div>
      )}
      {/* Menu Picker Modal */}
      <AnimatePresence>
        {showMenuPicker && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[3000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[var(--bg-card)] rounded-[40px] border border-white/10 w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl">
                    {ICONS.Search}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase italic leading-none">Browse <span className="text-indigo-500">Menu</span></h3>
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase mt-1 tracking-widest">Add items to Order #{targetOrderForPicker?.orderNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowMenuPicker(false);
                    setTargetOrderForPicker(null);
                  }}
                  className="p-3 bg-white/5 text-white rounded-2xl active:scale-90 transition-all"
                >
                  {ICONS.X}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                {CATEGORIES.map(cat => {
                  const itemsInCategory = items.filter(i => i.category === cat);
                  if (itemsInCategory.length === 0) return null;

                  return (
                    <div key={cat} className="space-y-4">
                      <div className="flex items-center gap-3 px-2">
                        <div className="h-px flex-1 bg-white/5"></div>
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] italic">{cat}</h4>
                        <div className="h-px flex-1 bg-white/5"></div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {itemsInCategory.map(item => (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (!targetOrderForPicker) return;
                              const currentOrder = targetOrderForPicker;
                              const existingItem = currentOrder.items.find(i => i.id === item.id);
                              
                              let updatedItems: OrderItem[];
                              if (existingItem) {
                                updatedItems = currentOrder.items.map(i =>
                                  i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
                                );
                              } else {
                                updatedItems = [...currentOrder.items, { ...item, quantity: 1 }];
                              }

                              const newSubtotal = updatedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
                              const newTax = settings?.isTaxEnabled ? (newSubtotal * settings.taxRate / 100) : 0;
                              const newDiscount = settings?.isDiscountEnabled ? (newSubtotal * (settings?.defaultDiscount || 0) / 100) : 0;
                              const newTotal = newSubtotal + newTax - newDiscount + (currentOrder.deliveryFee || 0);

                              const updatedOrder = {
                                ...currentOrder,
                                items: updatedItems,
                                subtotal: newSubtotal,
                                tax: newTax,
                                discount: newDiscount,
                                total: newTotal
                              };

                              onUpdateOrder(updatedOrder);
                              setTargetOrderForPicker(updatedOrder);
                              notify(`${item.name} added to bill!`, "success");
                            }}
                            className="bg-black/40 border border-white/5 p-4 rounded-[32px] flex flex-col items-center justify-center text-center gap-3 active:scale-95 transition-all hover:bg-white/5 group relative cursor-pointer"
                          >
                            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-3xl group-hover:bg-indigo-600/20 group-hover:text-indigo-400 transition-all">
                              {itemsInCategory.find(i => i.id === item.id)?.emoji || '🍕'}
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-white uppercase italic leading-tight">{item.name}</p>
                              <p className="text-[10px] font-black text-indigo-400 mt-1">Rs.{item.price}</p>
                            </div>
                            <div className="absolute top-2 right-2 bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                              +
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-6 border-t border-white/5 bg-black/20 flex items-center justify-between">
                <div className="flex flex-col">
                  <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-none">Current total</p>
                  <p className="text-2xl font-black text-indigo-400 italic">Rs.{targetOrderForPicker?.total.toLocaleString()}</p>
                </div>
                <button
                  onClick={() => {
                    setShowMenuPicker(false);
                    setTargetOrderForPicker(null);
                  }}
                  className="px-10 py-5 bg-indigo-600 text-white rounded-[24px] font-black uppercase text-[12px] tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  DONE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
    </>
  );
};

export default POS;