# clode-app

A mobile client for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — chat with Claude, manage sessions, and approve tool use from your phone.


https://github.com/user-attachments/assets/faf89eb8-9de0-4458-bb3f-3fe437007379


Built with React Native + Expo. Connects to [claude-app-server](https://github.com/sumansid/claude-app-server) over WebSocket.

## Features

- Connect to the server by scanning a QR code or entering a URL
- Create and manage multiple conversation sessions
- Real-time chat with streaming responses
- Approve or deny tool-use permissions on the go
- Supports all Claude models (Opus, Sonnet, Haiku)

## Getting Started

### Prerequisites

- Node.js
- [claude-app-server](https://github.com/sumansid/claude-app-server) running on your machine

### Install and Run

```bash
npm install
npm start
```

Then open the app on your device with Expo Go, or run directly:

```bash
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Browser
```

## Tech Stack

- React Native / Expo
- TypeScript
