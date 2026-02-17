# WABridge

A lightweight WhatsApp HTTP Bridge. Link your WhatsApp via CLI, then send messages through a simple REST API.

Built on [Baileys](https://github.com/WhiskeySockets/Baileys).

## Install

```bash
npm install -g wabridge
```

Or run directly:

```bash
npx wabridge
```

## Quick Start

### 1. Link WhatsApp

**QR Code (default):**

```bash
wabridge
```

Scan the QR code with WhatsApp (Settings > Linked Devices > Link a Device).

**Pairing Code:**

```bash
wabridge --code
```

Enter your phone number and get an 8-digit pairing code. Go to WhatsApp > Linked Devices > Link a Device > Link with phone number.

Once linked, you can test messages interactively:

```
Commands: /send, /self, /status, /disconnect, /quit
```

Auth is saved to `~/.wabridge/` — you only need to link once.

### 2. Start the API Server

```bash
wabridge start
```

With a custom port:

```bash
wabridge start 8080
```

## API Endpoints

### Check Status

```bash
curl http://localhost:3000/status
```

```json
{ "status": "open", "user": "919876543210@s.whatsapp.net" }
```

### Send Message

```bash
curl -X POST http://localhost:3000/send \
  -H 'Content-Type: application/json' \
  -d '{"phone": "919876543210", "message": "Hello!"}'
```

```json
{ "success": true, "to": "919876543210" }
```

### Send to Self

```bash
curl -X POST http://localhost:3000/send/self \
  -H 'Content-Type: application/json' \
  -d '{"message": "Test alert"}'
```

```json
{ "success": true, "to": "self" }
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `wabridge` | Link WhatsApp via QR code + interactive CLI |
| `wabridge --code` | Link WhatsApp via pairing code |
| `wabridge start` | Start API server on port 3000 |
| `wabridge start 8080` | Start API server on custom port |

### Interactive CLI Commands

| Command | Description |
|---------|-------------|
| `/send` | Send a message to any number |
| `/self` | Send a message to yourself |
| `/status` | Check connection status |
| `/disconnect` | Unlink WhatsApp and remove saved auth |
| `/quit` | Exit |

## Use Cases

- Trading alerts to WhatsApp
- Server monitoring notifications
- Automated reminders
- Any app that needs to send WhatsApp messages via HTTP

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| Port | `3000` | `wabridge start 8080` or `PORT=8080 wabridge start` |
| Auth | `~/.wabridge/auth_store` | WhatsApp session credentials |

## Requirements

- Node.js >= 20.0.0

## License

[MIT](LICENSE)
