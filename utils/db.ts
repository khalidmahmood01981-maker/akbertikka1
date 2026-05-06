
import { Order } from '../types';

const DB_NAME = 'flavor-dash-offline-db';
const DB_VERSION = 1;

export interface PendingItem<T> {
  id: string;
  data: T;
  type: 'order' | 'update' | 'customer';
  timestamp: number;
}

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('pending_sync')) {
        db.createObjectStore('pending_sync', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('orders_cache')) {
        db.createObjectStore('orders_cache', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('items_cache')) {
        db.createObjectStore('items_cache', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const savePendingSync = async (item: PendingItem<any>) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pending_sync', 'readwrite');
    const store = transaction.objectStore('pending_sync');
    const request = store.put(item);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

export const getPendingSyncItems = async (): Promise<PendingItem<any>[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pending_sync', 'readonly');
    const store = transaction.objectStore('pending_sync');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deletePendingSyncItem = async (id: string) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pending_sync', 'readwrite');
    const store = transaction.objectStore('pending_sync');
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

export const cacheOrder = async (order: Order) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('orders_cache', 'readwrite');
    const store = transaction.objectStore('orders_cache');
    store.put(order);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getCachedOrders = async (): Promise<Order[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('orders_cache', 'readonly');
    const store = transaction.objectStore('orders_cache');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const cacheItems = async (items: any[]) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('items_cache', 'readwrite');
    const store = transaction.objectStore('items_cache');
    store.clear();
    for (const item of items) {
      store.put(item);
    }
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getCachedItems = async (): Promise<any[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('items_cache', 'readonly');
    const store = transaction.objectStore('items_cache');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};
