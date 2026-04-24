
import React from 'react';
import { Utensils, ShoppingBag, PieChart, Settings, Package, X, Plus, Minus, Search, Trash2, Send, History, LayoutDashboard, ClipboardList, Download, Upload, ShieldCheck, Lock, Mic, QrCode, User, Users, CheckCircle, ChevronDown, ChevronRight, Play, Pause, Check, CreditCard, Image, Loader2, LogOut, Truck, ChefHat, Edit, Menu, Info, PlusCircle, Inbox, Printer, FileText, Smartphone, Monitor } from 'lucide-react';

export const HEADING_CLICKS_REQUIRED = 7;

export const ICONS = {
  Utensils: <Utensils size={20} />,
  ShoppingBag: <ShoppingBag size={20} />,
  PieChart: <PieChart size={20} />,
  Settings: <Settings size={20} />,
  Package: <Package size={20} />,
  X: <X size={20} />,
  Plus: <Plus size={20} />,
  Minus: <Minus size={20} />,
  Search: <Search size={20} />,
  Trash2: <Trash2 size={20} />,
  Send: <Send size={20} />,
  History: <History size={20} />,
  Dashboard: <LayoutDashboard size={20} />,
  Inventory: <ClipboardList size={20} />,
  Download: <Download size={20} />,
  Upload: <Upload size={20} />,
  Shield: <ShieldCheck size={20} />,
  Lock: <Lock size={16} />,
  LogOut: <LogOut size={20} />,
  Mic: <Mic size={16} />,
  QrCode: <QrCode size={20} />,
  User: <User size={20} />,
  Users: <Users size={20} />,
  CheckCircle: <CheckCircle size={20} />,
  ChevronDown: <ChevronDown size={20} />,
  ChevronRight: <ChevronRight size={20} />,
  Play: <Play size={16} />,
  Pause: <Pause size={16} />,
  Check: <Check size={20} />,
  CreditCard: <CreditCard size={20} />,
  Image: <Image size={20} />,
  Loader: <Loader2 size={20} className="animate-spin" />,
  Truck: <Truck size={20} />,
  ChefHat: <ChefHat size={20} />,
  Edit: <Edit size={20} />,
  Menu: <Menu size={20} />,
  Info: <Info size={20} />,
  PlusCircle: <PlusCircle size={20} />,
  Inbox: <Inbox size={20} />,
  Printer: <Printer size={20} />,
  FileText: <FileText size={20} />,
  Smartphone: <Smartphone size={20} />,
  Monitor: <Monitor size={20} />,
};

export const CATEGORIES = ["BBQ", "Fast Food", "Drinks", "Desserts"];

export const INITIAL_ITEMS = [
  {
    id: '1',
    name: 'Seekh Kabab (Beef)',
    price: 150,
    category: 'BBQ',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '2',
    name: 'Chicken Tikka (Chest)',
    price: 380,
    category: 'BBQ',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1632778149975-435eaa48f8db?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '3',
    name: 'Chicken Malai Boti',
    price: 450,
    category: 'BBQ',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '4',
    name: 'Reshmi Kabab',
    price: 180,
    category: 'BBQ',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1628294895950-9805252327bc?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '5',
    name: 'Zinger Burger',
    price: 320,
    category: 'Fast Food',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '6',
    name: 'Special Beef Burger',
    price: 450,
    category: 'Fast Food',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '7',
    name: 'Masala Fries (Large)',
    price: 180,
    category: 'Fast Food',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '8',
    name: 'Club Sandwich',
    price: 280,
    category: 'Fast Food',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '9',
    name: 'Cold Drink (500ml)',
    price: 100,
    category: 'Drinks',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '10',
    name: 'Mineral Water (Small)',
    price: 60,
    category: 'Drinks',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1560023907-5f339617ea30?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '11',
    name: 'Mutton Chops (4pcs)',
    price: 850,
    category: 'BBQ',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '12',
    name: 'Chicken Bihari Boti',
    price: 420,
    category: 'BBQ',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '13',
    name: 'Fish Tikka',
    price: 550,
    category: 'BBQ',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '14',
    name: 'Chicken Shawarma',
    price: 180,
    category: 'Fast Food',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '15',
    name: 'Pizza (Small)',
    price: 450,
    category: 'Fast Food',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '16',
    name: 'Chicken Nuggets (6pcs)',
    price: 250,
    category: 'Fast Food',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '17',
    name: 'Fresh Lime',
    price: 120,
    category: 'Drinks',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '18',
    name: 'Special Tea',
    price: 80,
    category: 'Drinks',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1544787210-2211d44b515b?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '19',
    name: 'Gulab Jamun (2pcs)',
    price: 120,
    category: 'Desserts',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1589119908995-c6837fa14848?auto=format&fit=crop&w=400&h=400'
  },
  {
    id: '20',
    name: 'Matka Kheer',
    price: 150,
    category: 'Desserts',
    unit: 'pcs',
    image: 'https://images.unsplash.com/photo-1589119908995-c6837fa14848?auto=format&fit=crop&w=400&h=400'
  }
];
