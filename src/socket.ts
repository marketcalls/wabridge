// @ts-ignore - Baileys exports differ between CJS types and ESM runtime
import { makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } from "baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import path from "path";
import os from "os";
import fs from "fs";

const logger = pino({ level: "silent" });

const AUTH_DIR = path.join(os.homedir(), ".wabridge", "auth_store");

export type WASocket = any;

export interface WABridge {
  sock: WASocket;
  status: "connecting" | "open" | "disconnected";
}

export type MessageContent =
  | { type: "text"; text: string }
  | { type: "image"; url: string; caption?: string }
  | { type: "video"; url: string; caption?: string }
  | { type: "audio"; url: string; ptt?: boolean }
  | { type: "document"; url: string; mimetype: string; fileName?: string; caption?: string };

function buildBaileysContent(content: MessageContent): any {
  switch (content.type) {
    case "text":
      return { text: content.text };
    case "image":
      return { image: { url: content.url }, caption: content.caption };
    case "video":
      return { video: { url: content.url }, caption: content.caption };
    case "audio":
      return { audio: { url: content.url }, ptt: content.ptt ?? true };
    case "document":
      return { document: { url: content.url }, mimetype: content.mimetype, fileName: content.fileName, caption: content.caption };
  }
}

function resolveJid(to: string): string {
  if (to.includes("@")) return to;
  if (/^\d{10,15}$/.test(to)) return `${to}@s.whatsapp.net`;
  throw new Error("Invalid recipient. Use phone number, groupId@g.us, or channelId@newsletter");
}

const bridge: WABridge = {
  sock: null as any,
  status: "disconnected",
};

export function getBridge() {
  return bridge;
}

export function getMyJid(): string | null {
  return bridge.sock?.user?.id?.replace(/:\d+@/, "@") || null;
}

export async function sendMessage(phone: string, message: string) {
  if (!bridge.sock || bridge.status !== "open") {
    throw new Error("WhatsApp not connected");
  }
  const jid = `${phone}@s.whatsapp.net`;
  await bridge.sock.sendMessage(jid, { text: message });
  return { success: true, to: phone };
}

export async function sendToSelf(message: string) {
  const myJid = getMyJid();
  if (!myJid) throw new Error("WhatsApp not connected");
  await bridge.sock.sendMessage(myJid, { text: message });
  return { success: true, to: "self" };
}

export async function sendTo(to: string, content: MessageContent) {
  if (!bridge.sock || bridge.status !== "open") {
    throw new Error("WhatsApp not connected");
  }
  const jid = resolveJid(to);
  const msg = buildBaileysContent(content);
  await bridge.sock.sendMessage(jid, msg);
  return { success: true, to: jid };
}

export async function listGroups() {
  if (!bridge.sock || bridge.status !== "open") {
    throw new Error("WhatsApp not connected");
  }
  const groups = await bridge.sock.groupFetchAllParticipating();
  return Object.values(groups).map((g: any) => ({
    id: g.id,
    subject: g.subject,
    size: g.size ?? g.participants?.length ?? 0,
    desc: g.desc || null,
  }));
}

export async function disconnect() {
  if (bridge.sock) {
    await bridge.sock.logout();
  }
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  bridge.status = "disconnected";
}

export function startSocket(callbacks?: {
  onQR?: (qr: string, sock: WASocket) => void;
  onOpen?: () => void;
  onClose?: () => void;
}): Promise<WASocket> {
  return new Promise(async (resolve) => {
    bridge.status = "connecting";
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    console.log(`  Connecting to WhatsApp (v${version.join(".")})...`);

    bridge.sock = makeWASocket({
      version,
      logger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      generateHighQualityLinkPreview: true,
    });

    bridge.sock.ev.process(async (events: any) => {
      if (events["connection.update"]) {
        const { connection, lastDisconnect, qr } = events["connection.update"];

        if (qr) callbacks?.onQR?.(qr, bridge.sock);

        if (connection === "open") {
          bridge.status = "open";
          callbacks?.onOpen?.();
          resolve(bridge.sock);
        }

        if (connection === "close") {
          bridge.status = "disconnected";
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          if (statusCode === DisconnectReason.loggedOut) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            console.log("  Logged out. Re-linking...\n");
            startSocket(callbacks).then(resolve);
            return;
          }
          console.log("  Disconnected. Reconnecting...");
          startSocket(callbacks).then(resolve);
        }
      }

      if (events["creds.update"]) {
        await saveCreds();
      }
    });
  });
}
