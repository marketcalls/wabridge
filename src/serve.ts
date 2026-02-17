import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { startSocket, getBridge, sendMessage, sendToSelf } from "./socket.js";

const API_PORT = Number(process.env.PORT) || 3000;

// ─── HTTP API ─────────────────────────────────────────

const app = new Hono();

app.get("/status", (c) => {
  const bridge = getBridge();
  return c.json({
    status: bridge.status,
    user: bridge.sock?.user?.id || null,
  });
});

app.post("/send", async (c) => {
  try {
    const { phone, message } = await c.req.json();

    if (!phone || !message) {
      return c.json({ error: "phone and message are required" }, 400);
    }
    if (!/^\d{10,15}$/.test(phone)) {
      return c.json({ error: "Invalid phone. Use digits with country code (e.g. 919876543210)" }, 400);
    }

    const result = await sendMessage(phone, message);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/send/self", async (c) => {
  try {
    const { message } = await c.req.json();
    if (!message) {
      return c.json({ error: "message is required" }, 400);
    }

    const result = await sendToSelf(message);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Start ────────────────────────────────────────────

await startSocket({
  onOpen() {
    console.log("  WhatsApp connected!");
  },
  onClose() {
    console.log("  WhatsApp disconnected. Exiting.");
    process.exit(1);
  },
});

serve({ fetch: app.fetch, port: API_PORT }, () => {
  const url = `http://localhost:${API_PORT}`;
  const line = `  ${url}`;
  console.log([
    "",
    "  ╔════════════════════════════════════════════╗",
    "  ║         WABridge API - Running             ║",
    "  ╠════════════════════════════════════════════╣",
    "  ║  GET  /status      - Connection status     ║",
    "  ║  POST /send        - Send to any number    ║",
    "  ║  POST /send/self   - Send to yourself      ║",
    "  ╠════════════════════════════════════════════╣",
    `  ║${line.padEnd(44)}║`,
    "  ╚════════════════════════════════════════════╝",
    "",
  ].join("\n"));
});
