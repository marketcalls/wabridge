#!/usr/bin/env node
export {};

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const command = process.argv[2];

if (command === "--version" || command === "-v") {
  console.log(`wabridge/${pkg.version}`);
} else if (command === "--help" || command === "-h") {
  console.log(`wabridge/${pkg.version}

Usage: wabridge [command]

Commands:
  (default)      Scan QR code and link WhatsApp
  start [port]   Start the API server (default port: 3000)

API Endpoints:
  GET  /status        Connection status
  GET  /groups        List groups
  POST /send          Send to phone (text, image, video, audio, document)
  POST /send/self     Send to yourself
  POST /send/group    Send to group
  POST /send/channel  Send to channel/newsletter

Options:
  -v, --version  Show version
  -h, --help     Show this help`);
} else if (command === "start") {
  const port = process.argv[3];
  if (port) process.env.PORT = port;
  await import("./serve.js");
} else {
  await import("./setup.js");
}
