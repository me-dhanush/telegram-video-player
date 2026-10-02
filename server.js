const express = require("express");
const next = require("next");

const { startTelegram } = require("./src/telegram/telegramClient");
const { createVideoStreamHandler } = require("./src/video/videoStream");

require("dotenv").config();

const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const PORT = 3000;

async function main() {
    await nextApp.prepare();

    const app = express();
    const telegram = await startTelegram();

    // Keep the existing Telegram streaming endpoint unchanged.
    app.get("/video", (req, res) => {
      const messageId = Number(req.query.messageId);

      if (!messageId) {
        return createVideoStreamHandler(telegram)(req, res);
      }

      const video = telegram.videos.find((video) => video.id === messageId);

      if (!video) {
        return res.status(404).send("Video not found");
      }

      createVideoStreamHandler({
        client: telegram.client,
        videoDocument: video.videoDocument,
        videoLocation: video.videoLocation,
      })(req, res);
    });

    app.get("/api/videos", (req, res) => {
      res.json(telegram.videos);
    });

    // Let Next.js handle the React application.
    app.use((req, res) => handle(req, res));

    app.listen(PORT, () => {
        console.log("");
        console.log("🚀 Next.js lecture player running at:");
        console.log(`http://localhost:${PORT}`);
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
