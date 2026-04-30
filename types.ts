
export type UnitType = 'pcs' | 'kg' | 'rs';
export type AppTheme = 'light' | 'dark' | 'midnight';
export type FontSize = 'small' | 'medium' | 'large' | 'extra-large';
export type FontFamily = 'inter' | 'oswald' | 'courier' | 'roboto' | 'serif';
export type Language = 'english' | 'urdu';

export interface ShopAccount {
  id: string;
  password: string;
  shopName: string;
  subscriptionStatus: 'active' | 'expired' | 'pending';
  expiryDate: number; // Timestamp
  createdAt: number;
  totalSalesCount?: number;
  totalRevenue?: number;
}

export interface PaymentMethod {
  id: string;
  label: string;
  isEnabled: boolean;
  details?: string;
}

export interface NotificationSound {
  id: string;
  name: string;
  url: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  whatsappNumber?: string;
  tableNumber?: string;
  totalOrders: number;
  totalSpent: number;
  lastVisit: number;
  balance: number; // Positive means they owe us (Udhaar)
}

export interface Supplier {
  id: string;
  name: string;
  categoryId: string; // Linking to SupplierCategory
}

export interface SupplierCategory {
  id: string;
  name: string;
}

export interface StaffMember {
  id: string;
  name: string;
  password: string;
  role: 'taker' | 'kitchen' | 'cashier';
  createdAt: number;
}

export interface PurchaseItem {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
  unit: UnitType;
}

export interface AppSettings {
  id?: string;
  businessName: string;
  businessLogo?: string; // Base64 logo
  taxRate: number;
  isTaxEnabled: boolean;
  isDiscountEnabled: boolean;
  defaultDiscount: number;
  theme: AppTheme;
  language?: Language;
  fontSize?: FontSize;
  fontSizeNumber?: number; // New granular control
  fontFamily?: FontFamily; // Selected font style
  isAuthEnabled: boolean;
  whatsappCountryCode: string;
  adminUsername: string;
  adminSecretKey: string;
  subscriptionPrice: number;
  collectionJazzCash: string;
  collectionEasyPaisa: string;
  notificationSoundUrl?: string; // Base64 or URL
  notificationRepeatCount?: number;
  notificationSounds?: NotificationSound[];
  deliveryZones?: DeliveryZone[];
  shopAccounts?: ShopAccount[];
  staffMembers?: StaffMember[];
  paymentMethods?: PaymentMethod[];
  purchaseCategories?: string[];
  purchaseSubCategories?: Record<string, string[]>; // Category -> SubCategories
  purchaseItems?: PurchaseItem[];
  isAutoWhatsappEnabled?: boolean;
  enableVoiceAnnouncement?: boolean;
  isAutoPrintKitchenEnabled?: boolean;
  isAutoPrintBillEnabled?: boolean;
  isSilentPrintingEnabled?: boolean;
  includeTakerNameOnPrint?: boolean;
  includeBillNoOnPrint?: boolean;
  enableKitchenPrinting?: boolean;
  enableBillPrinting?: boolean;
  isQueueModeEnabled?: boolean;
  businessDayStartTime?: string; // Format "HH:mm"
  masterIP?: string; // Local IP of the server device
  statsAdjustmentPercentage?: number; // Adjustment for displayed sales/orders
  receiptFooterText?: string; // Custom text shown on bills/receipts
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  unit: UnitType;
  image: string;
  stockAlert?: number;
}

export interface StockItem {
  id: string;
  name: string;
  currentQuantity: number;
  minStock: number;
  unit: UnitType;
  price: number;
}

export interface StockLog {
  id: string;
  itemId: string;
  itemName: string;
  categoryName: string;
  weight: number;
  rate: number;
  date: string;
  timestamp: number;
}

export interface StockCategory {
  id: string;
  name: string;
  items: StockItem[];
}

export interface OrderItem extends MenuItem {
  quantity: number;
}

export type OrderStatus = 'pending_customer' | 'received' | 'accepted' | 'preparing' | 'ready' | 'served' | 'collected' | 'delivered' | 'cancelled' | 'draft';

export interface KitchenTicket {
  id: string;
  round: number;
  timestamp: number;
  items: { id: string; name: string; quantity: number }[];
  isPrinted?: boolean;
  senderName?: string;
}

export interface Order {
  id: string;
  timestamp: number;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customerName: string;
  customerPhone: string;
  paymentMethod?: string; // 'cash', 'khata', etc.
  paymentStatus?: 'pending' | 'paid' | 'failed';
  stripeSessionId?: string;
  status?: OrderStatus;
  statusTimestamps?: Partial<Record<OrderStatus, number>>;
  orderNumber: number;
  orderTakerId?: string;
  orderTakerName?: string;
  tableNumber?: string;
  cashierId?: string;
  cashierName?: string;
  kitchenNotes?: string;
  deliveryFee?: number;
  deliveryZoneId?: string;
  receivedAmount?: number;
  balance?: number;
  isPrinted?: boolean;
  kitchenTickets?: KitchenTicket[];
  updateCount?: number;
  feedback?: {
    rating: number;
    comment: string;
    timestamp: number;
  };
}

export interface Purchase {
  id: string;
  timestamp: number;
  itemName: string;
  category: string;
  subCategory?: string;
  quantity: number;
  unit: UnitType;
  unitCost: number;
  cost: number;
  supplier: string;
  paymentMethod?: string;
  paidAmount: number;
  remainingAmount: number;
  paymentHistory?: { amount: number, timestamp: number, note?: string }[];
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  amount: number;
  timestamp: number;
  method: string;
  note?: string;
}

export interface KhataTransaction {
  id: string;
  supplier: string;
  amount: number;
  type: 'payment' | 'purchase' | 'return' | 'discount' | 'adjustment';
  note?: string;
  paymentMethod?: string; // e.g., 'cash', 'bank', 'jazzcash'
  timestamp: number;
}


