const express = require("express");
const next = require("next");

require("dotenv").config();

const {
  getTelegram,
  getTelegramVideo,
} = require("./src/telegram/telegramClient");
const { createVideoStreamHandler } = require("./src/video/videoStream");
const {
  acquireDistributedSessionLock,
} = require("./src/telegram/distributedSessionLock");

const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();
const PORT = Number(process.env.PORT || 3000);

async function main() {
  await nextApp.prepare();

  // Keep a shared lock while this single-process server owns the Telegram
  // client, so Vercel functions using the same session wait instead of
  // connecting concurrently.
  const releaseDistributedLock = await acquireDistributedSessionLock();

  try {
    const app = express();
    const telegram = await getTelegram({ loadVideos: false });

    app.get("/video", async (request, response) => {
      const messageId = Number(request.query.messageId);
      const telegramChatId = request.query.telegramChatId;
      const video = await getTelegramVideo(
        telegram,
        messageId,
        telegramChatId,
      );
      if (!video) return response.status(404).send("Video not found");

      return createVideoStreamHandler({
        client: telegram.client,
        videoDocument: video.videoDocument,
        videoLocation: video.videoLocation,
      })(request, response);
    });

    app.get("/api/videos", async (_request, response, next) => {
      try {
        const catalog = await getTelegram();
        response.json(
          catalog.videos.map(
            ({ id, telegramChatId, chatName, name, topicId, topicName }) => ({
              id,
              telegramChatId,
              chatName,
              name,
              topicId,
              topicName,
            }),
          ),
        );
      } catch (error) {
        next(error);
      }
    });

    app.use((request, response) => handle(request, response));
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Next.js lecture player running on port ${PORT}`);
    });
  } catch (error) {
    await releaseDistributedLock().catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
