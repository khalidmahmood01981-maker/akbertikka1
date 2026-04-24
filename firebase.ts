/// <reference types="vite/client" />
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, where, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDtyTTu1xNxd9Gzu4abXhqt6dggPdxFmEM",
  authDomain: "billing-app-pro1.firebaseapp.com",
  projectId: "billing-app-pro1",
  storageBucket: "billing-app-pro1.firebasestorage.app",
  messagingSenderId: "582384956110",
  appId: "1:582384956110:web:a57d732a5a2b2e6938169f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Enable Offline Persistence
import { enableMultiTabIndexedDbPersistence } from "firebase/firestore";

if (typeof window !== "undefined") {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a a time.
      console.warn("Firestore persistence failed: Multiple tabs open");
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn("Firestore persistence failed: Browser not supported");
    }
  });
}


// Helper functions for common operations
export const collections = {
  customers: collection(db, "customers"),
  orders: collection(db, "orders"),
  items: collection(db, "items"),
  settings: collection(db, "settings"),
  orderTakers: collection(db, "orderTakers"),
  shopAccounts: collection(db, "shopAccounts"),
  suppliers: collection(db, "suppliers"),
  menuRequests: collection(db, "menuRequests"),
  staffMembers: collection(db, "staffMembers"),
  purchases: collection(db, "purchases"),
  stockCategories: collection(db, "stockCategories"),
  stockLogs: collection(db, "stockLogs"),
  khataTransactions: collection(db, "khataTransactions"),
  customerPayments: collection(db, "customerPayments"),
  supplierCategories: collection(db, "supplierCategories")
};
