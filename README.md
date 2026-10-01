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
