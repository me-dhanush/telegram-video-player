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

    app.get("/api/videos", async (request, response, next) => {
      try {
        const { mode, topicId } = request.query;
        const {
          loadTopicCatalog,
          getVideosForTopic,
          getRecentVideos,
        } = require("./src/telegram/telegramClient");
        const selectFields = (videos) => videos.map(
          ({ id, telegramChatId, chatName, name, topicId, topicName }) => ({
            id, telegramChatId, chatName, name, topicId, topicName,
          }),
        );
        const telegram = await getTelegram({ loadVideos: false });

        if (mode === "overview") {
          const [topics, recentVideos] = await Promise.all([
            loadTopicCatalog(telegram),
            getRecentVideos(telegram),
          ]);
          return response.json({ topics, recentVideos: selectFields(recentVideos) });
        }
        if (mode === "topics") return response.json(await loadTopicCatalog(telegram));
        if (mode === "recent") return response.json(selectFields(await getRecentVideos(telegram)));
        if (topicId) return response.json(selectFields(await getVideosForTopic(telegram, topicId)));

        const catalog = await getTelegram();
        return response.json(selectFields(catalog.videos));
      } catch (error) {
        next(error);
      }
    });

    app.use((request, response) => handle(request, response));
    app.listen(PORT, "0.0.0.0", () => {
      console.info(`[Server] Ready at http://localhost:${PORT}`);
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
