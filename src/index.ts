#!/usr/bin/env node
export {};

const command = process.argv[2];

if (command === "start") {
  const port = process.argv[3];
  if (port) process.env.PORT = port;
  await import("./serve.js");
} else {
  // Default: run CLI setup
  await import("./setup.js");
}
