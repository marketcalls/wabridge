import makeWASocket, { DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } from "baileys";
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
