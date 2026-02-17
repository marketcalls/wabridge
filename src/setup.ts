import { startSocket, sendMessage, sendToSelf, disconnect } from "./socket.js";
// @ts-ignore no types available
import QRCode from "qrcode";
import * as readline from "readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (prompt: string) => new Promise<string>((resolve) => rl.question(prompt, resolve));

const usePairingCode = process.argv.includes("--code");

console.log(`
  ╔══════════════════════════════════════╗
  ║        WABridge - Setup              ║
  ╠══════════════════════════════════════╣
  ║  Link your WhatsApp account          ║
  ║  Auth is saved to ~/.wabridge/       ║
  ╚══════════════════════════════════════╝
`);

let promptStarted = false;
let pairingRequested = false;

await startSocket({
  async onQR(qr, sock) {
    if (usePairingCode) {
      if (!pairingRequested) {
        pairingRequested = true;
        const phone = (await ask("  Enter your phone number (with country code, e.g. 919876543210): ")).trim();
        if (!phone || !/^\d{10,15}$/.test(phone)) {
          console.log("  Invalid phone number. Restart and try again.");
          process.exit(1);
        }
        const code = await sock.requestPairingCode(phone);
        console.log(`\n  Your pairing code: ${code}\n`);
        console.log("  Go to WhatsApp > Linked Devices > Link a Device > Link with phone number");
        console.log("  Enter the code above to link.\n");
      }
    } else {
      console.log("  Scan this QR code with WhatsApp:\n");
      const qrText = await QRCode.toString(qr, { type: "terminal", small: true, errorCorrectionLevel: "L" });
      console.log(qrText);
    }
  },
  onOpen() {
    console.log("  WhatsApp linked successfully!\n");
    if (!promptStarted) {
      promptStarted = true;
      console.log("  Commands: /send, /self, /status, /disconnect, /quit\n");
      promptLoop();
    }
  },
  onClose() {
    process.exit(1);
  },
});

async function promptLoop() {
  while (true) {
    const input = (await ask("  > ")).trim();
    if (!input) continue;

    if (input === "/quit") {
      console.log("  Bye!");
      process.exit(0);
    }

    if (input === "/status") {
      const { getBridge, getMyJid } = await import("./socket.js");
      const b = getBridge();
      console.log(`  Status: ${b.status}`);
      console.log(`  JID: ${getMyJid() || "N/A"}`);
      continue;
    }

    if (input === "/send") {
      const phone = (await ask("  Phone (with country code, e.g. 919876543210): ")).trim();
      if (!phone || !/^\d{10,15}$/.test(phone)) {
        console.log("  Invalid phone number.");
        continue;
      }
      const msg = (await ask("  Message: ")).trim();
      if (!msg) { console.log("  Cancelled."); continue; }
      try {
        await sendMessage(phone, msg);
        console.log(`  Sent to +${phone}!`);
      } catch (err: any) {
        console.log(`  Failed: ${err.message}`);
      }
      continue;
    }

    if (input === "/self") {
      const msg = (await ask("  Message to self: ")).trim();
      if (!msg) { console.log("  Cancelled."); continue; }
      try {
        await sendToSelf(msg);
        console.log("  Sent to yourself!");
      } catch (err: any) {
        console.log(`  Failed: ${err.message}`);
      }
      continue;
    }

    if (input === "/disconnect") {
      const confirm = (await ask("  Unlink WhatsApp? This removes saved auth. (y/n): ")).trim().toLowerCase();
      if (confirm === "y") {
        try {
          await disconnect();
          console.log("  WhatsApp unlinked. Run 'wabridge' again to re-link.");
          process.exit(0);
        } catch (err: any) {
          console.log(`  Failed: ${err.message}`);
        }
      } else {
        console.log("  Cancelled.");
      }
      continue;
    }

    console.log("  Unknown. Commands: /send, /self, /status, /disconnect, /quit");
  }
}
