import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { createServer as createHttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import Database from "better-sqlite3";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite
const db = new Database('restaurant.db');
db.pragma('journal_mode = WAL');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    data TEXT,
    timestamp INTEGER
  );
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    data TEXT
  );
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    data TEXT
  );
  CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    data TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const io = new SocketServer(httpServer, {
    cors: { origin: "*" }
  });

  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Track connected devices
  const connectedDevices = new Map<string, any>();

  const broadcastConnections = () => {
    const list = Array.from(connectedDevices.values());
    io.emit("active_connections", list);
  };

  // Socket.io for Real-time Sync
  io.on("connection", (socket) => {
    const clientIP = socket.handshake.address.replace('::ffff:', '');
    console.log("Client connected:", socket.id, "from", clientIP);
    
    // Default entry
    connectedDevices.set(socket.id, {
      id: socket.id,
      ip: clientIP,
      name: "Unknown Device",
      role: "guest",
      lastSeen: Date.now(),
      userAgent: socket.handshake.headers['user-agent']
    });
    
    broadcastConnections();

    socket.on("identify", (data) => {
      console.log("Client identified:", socket.id, data.name);
      connectedDevices.set(socket.id, {
        ...connectedDevices.get(socket.id),
        ...data,
        lastSeen: Date.now()
      });
      broadcastConnections();
    });

    socket.on("print_command", (data) => {
      console.log("Print command received:", data.type, "for order:", data.order?.id);
      io.emit("print_command", data);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      connectedDevices.delete(socket.id);
      broadcastConnections();
    });
  });

  // DB Helper
  const broadcast = (event: string, data: any) => io.emit(event, data);

  // API Routes
  
  app.get("/api/info", (req, res) => {
    res.json({
      localIP: getLocalIP(),
      port: PORT,
      timestamp: Date.now(),
      os: os.platform(),
      hostname: os.hostname()
    });
  });
  
  // Orders
  app.get("/api/orders", (req, res) => {
    const orders = db.prepare("SELECT data FROM orders ORDER BY timestamp DESC").all();
    res.json(orders.map((o: any) => JSON.parse(o.data)));
  });

  app.post("/api/orders", (req, res) => {
    const order = req.body;
    db.prepare("INSERT OR REPLACE INTO orders (id, data, timestamp) VALUES (?, ?, ?)")
      .run(order.id, JSON.stringify(order), order.timestamp || Date.now());
    broadcast("order_sync", order);
    res.json({ success: true });
  });

  app.delete("/api/orders/:id", (req, res) => {
    db.prepare("DELETE FROM orders WHERE id = ?").run(req.params.id);
    broadcast("order_deleted", req.params.id);
    res.json({ success: true });
  });

  // Items
  app.get("/api/items", (req, res) => {
    const items = db.prepare("SELECT data FROM items").all();
    res.json(items.map((i: any) => JSON.parse(i.data)));
  });

  app.post("/api/items", (req, res) => {
    const items = req.body;
    const insert = db.prepare("INSERT OR REPLACE INTO items (id, data) VALUES (?, ?)");
    const deleteOld = db.prepare("DELETE FROM items");
    
    db.transaction(() => {
      deleteOld.run();
      for (const item of items) {
        insert.run(item.id, JSON.stringify(item));
      }
    })();
    
    broadcast("items_sync", items);
    res.json({ success: true });
  });

  // Customers
  app.get("/api/customers", (req, res) => {
    const customers = db.prepare("SELECT data FROM customers").all();
    res.json(customers.map((c: any) => JSON.parse(c.data)));
  });

  app.post("/api/customers", (req, res) => {
    const customer = req.body;
    db.prepare("INSERT OR REPLACE INTO customers (id, data) VALUES (?, ?)")
      .run(customer.id || customer.phone, JSON.stringify(customer));
    broadcast("customer_sync", customer);
    res.json({ success: true });
  });

  // Settings
  app.get("/api/settings", (req, res) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'app_settings'").get();
    res.json(row ? JSON.parse((row as any).value) : {});
  });

  app.post("/api/settings", (req, res) => {
    const settings = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)")
      .run(JSON.stringify(settings));
    broadcast("settings_sync", settings);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  // Get Local IP Address
  const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      if (iface) {
        for (let i = 0; i < iface.length; i++) {
          const alias = iface[i];
          if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
            return alias.address;
          }
        }
      }
    }
    return '0.0.0.0';
  };

  const localIP = getLocalIP();

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Flavor Dash Local Server Started!`);
    console.log(`Local Access: http://localhost:${PORT}`);
    console.log(`Network Access: http://${localIP}:${PORT}`);
    console.log(`-------------------------------------------\n`);
  });
}

startServer();
