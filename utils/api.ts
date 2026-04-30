
import { io, Socket } from "socket.io-client";

let API_BASE = ""; // Relative to the hosted domain

export class LocalApiService {
  private socket: Socket;
  private listeners: { [event: string]: ((data: any) => void)[] } = {};

  constructor(baseURL?: string) {
    if (baseURL) API_BASE = baseURL;
    this.socket = io(baseURL || undefined);
  }

  setBaseURL(url: string) {
    if (API_BASE === url) return;
    API_BASE = url;
    console.log("API & Socket Re-connecting to:", url);
    
    this.socket.disconnect();
    this.socket = io(url);
    
    // Re-attach all existing listeners to the new socket
    Object.keys(this.listeners).forEach(event => {
      this.listeners[event].forEach(callback => {
        this.socket.on(event, callback);
      });
    });
  }

  // Socket listeners
  onSync(event: string, callback: (data: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    this.socket.on(event, callback);
  }

  // Orders
  async getOrders() {
    const res = await fetch(`${API_BASE}/api/orders`);
    return res.json();
  }

  async saveOrder(order: any) {
    return fetch(`${API_BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order)
    });
  }

  async deleteOrder(id: string) {
    return fetch(`${API_BASE}/api/orders/${id}`, { method: "DELETE" });
  }

  // Items
  async getItems() {
    const res = await fetch(`${API_BASE}/api/items`);
    return res.json();
  }

  async saveItems(items: any[]) {
    return fetch(`${API_BASE}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items)
    });
  }

  // Customers
  async getCustomers() {
    const res = await fetch(`${API_BASE}/api/customers`);
    return res.json();
  }

  async saveCustomer(customer: any) {
    return fetch(`${API_BASE}/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(customer)
    });
  }

  // Settings
  async getSettings() {
    const res = await fetch(`${API_BASE}/api/settings`);
    return res.json();
  }

  async saveSettings(settings: any) {
    return fetch(`${API_BASE}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
  }

  async getInfo() {
    try {
      const res = await fetch(`${API_BASE}/api/info`);
      if (!res.ok) return null;
      return res.json();
    } catch (e) {
      return null;
    }
  }

  emitPrintCommand(data: { type: 'kitchen' | 'bill' | 'qr', order?: any, staff?: any }) {
    this.socket.emit("print_command", data);
  }
}

export const api = new LocalApiService();
