import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { startSocket, getBridge, getMyJid, sendTo, listGroups } from "./socket.js";
import type { MessageContent } from "./socket.js";

const API_PORT = Number(process.env.PORT) || 3000;

// ─── Helpers ─────────────────────────────────────────

function parseMessageContent(body: any): MessageContent | null {
  if (body.image) {
    return { type: "image", url: body.image, caption: body.caption };
  }
  if (body.video) {
    return { type: "video", url: body.video, caption: body.caption };
  }
  if (body.audio) {
    return { type: "audio", url: body.audio, ptt: body.ptt };
  }
  if (body.document) {
    if (!body.mimetype) return null;
    return { type: "document", url: body.document, mimetype: body.mimetype, fileName: body.fileName, caption: body.caption };
  }
  if (body.message) {
    return { type: "text", text: body.message };
  }
  return null;
}

// ─── HTTP API ─────────────────────────────────────────

const app = new Hono();

app.get("/status", (c) => {
  const bridge = getBridge();
  return c.json({
    status: bridge.status,
    user: bridge.sock?.user?.id || null,
  });
});

app.get("/groups", async (c) => {
  try {
    const groups = await listGroups();
    return c.json({ groups });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/send", async (c) => {
  try {
    const body = await c.req.json();
    const { phone } = body;

    if (!phone) {
      return c.json({ error: "phone is required" }, 400);
    }
    if (!/^\d{10,15}$/.test(phone)) {
      return c.json({ error: "Invalid phone. Use digits with country code (e.g. 919876543210)" }, 400);
    }

    const content = parseMessageContent(body);
    if (!content) {
      return c.json({ error: "message content is required (message, image, video, audio, or document)" }, 400);
    }

    await sendTo(phone, content);
    return c.json({ success: true, to: phone });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/send/self", async (c) => {
  try {
    const body = await c.req.json();
    const content = parseMessageContent(body);
    if (!content) {
      return c.json({ error: "message content is required (message, image, video, audio, or document)" }, 400);
    }

    const myJid = getMyJid();
    if (!myJid) {
      return c.json({ error: "WhatsApp not connected" }, 500);
    }

    await sendTo(myJid, content);
    return c.json({ success: true, to: "self" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/send/group", async (c) => {
  try {
    const body = await c.req.json();
    const { groupId } = body;

    if (!groupId) {
      return c.json({ error: "groupId is required" }, 400);
    }
    if (!groupId.endsWith("@g.us")) {
      return c.json({ error: "groupId must end with @g.us" }, 400);
    }

    const content = parseMessageContent(body);
    if (!content) {
      return c.json({ error: "message content is required (message, image, video, audio, or document)" }, 400);
    }

    const result = await sendTo(groupId, content);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/send/channel", async (c) => {
  try {
    const body = await c.req.json();
    const { channelId } = body;

    if (!channelId) {
      return c.json({ error: "channelId is required" }, 400);
    }
    if (!channelId.endsWith("@newsletter")) {
      return c.json({ error: "channelId must end with @newsletter" }, 400);
    }

    const content = parseMessageContent(body);
    if (!content) {
      return c.json({ error: "message content is required (message, image, video, audio, or document)" }, 400);
    }

    const result = await sendTo(channelId, content);
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
    "  ╔══════════════════════════════════════════════════╗",
    "  ║           WABridge API - Running                 ║",
    "  ╠══════════════════════════════════════════════════╣",
    "  ║  GET  /status        - Connection status         ║",
    "  ║  GET  /groups        - List groups               ║",
    "  ║  POST /send          - Send to phone number      ║",
    "  ║  POST /send/self     - Send to yourself          ║",
    "  ║  POST /send/group    - Send to group             ║",
    "  ║  POST /send/channel  - Send to channel           ║",
    "  ╠══════════════════════════════════════════════════╣",
    `  ║${line.padEnd(50)}║`,
    "  ╚══════════════════════════════════════════════════╝",
    "",
  ].join("\n"));
});
