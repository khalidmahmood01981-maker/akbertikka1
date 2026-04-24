
import { io, Socket } from "socket.io-client";

let API_BASE = ""; // Relative to the hosted domain

export class LocalApiService {
  private socket: Socket;

  constructor(baseURL?: string) {
    if (baseURL) API_BASE = baseURL;
    this.socket = io(baseURL || undefined);
  }

  setBaseURL(url: string) {
    API_BASE = url;
    // Reconnect socket if needed, but for now just update base
  }

  // Socket listeners
  onSync(event: string, callback: (data: any) => void) {
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
}

export const api = new LocalApiService();
