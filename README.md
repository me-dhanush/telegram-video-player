# Telegram Video Player — Next.js

This is a structural conversion of the existing lecture player to Next.js + React.

## Important

The player UI and existing behavior were kept as-is as much as possible. The Telegram streaming implementation in `src/video/videoStream.js` and Telegram client setup in `src/telegram/telegramClient.js` were not rewritten.

## Setup

1. Copy `.env.example` to `.env`.
2. Put your Telegram credentials/session into `.env`.
3. Install dependencies:

```bash
npm install
```

4. Start development:

```bash
npm run dev
```

Run exactly one app instance for a given `SESSION`. The app and `rename-videos`
script now take a per-session lock on the current machine and refuse to connect
if another local process already owns that session. If you run this app on a
multi-instance host, configure the service for a single instance; local locks do
not coordinate between separate machines. Do not run `rename-videos` while the
app is running with the same session.

If Telegram has already returned `AUTH_KEY_DUPLICATED`, stop all app instances
and scripts using that session, generate a fresh Telegram session, and replace
`SESSION` in the environment before restarting. Telegram invalidates the
duplicated authorization key, so restarting with that same session cannot
repair it.

Open:

```text
http://localhost:3000
```

## Structure

```text
app/
  page.jsx
  layout.jsx
  globals.css

components/
  LecturePlayer.jsx
  NotesPanel.jsx

src/
  telegram/
    telegramClient.js
  video/
    videoStream.js
  routes/
    videoRoutes.js

server.js
```

The React frontend calls the same `/video` endpoint used by the original player.
