import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get("topicId");
    const mode = searchParams.get("mode");
    const selectFields = (videos) => videos.map(
      ({ id, telegramChatId, chatName, name, topicId, topicName }) => ({
        id, telegramChatId, chatName, name, topicId, topicName,
      }),
    );

    if (mode === "topics" || mode === "recent" || mode === "overview" || topicId) {
      const run = async (telegram) => {
        const { loadTopicCatalog, getVideosForTopic, getRecentVideos } =
          await import("@/src/telegram/telegramClient");
        if (mode === "topics") return loadTopicCatalog(telegram);
        if (mode === "overview") {
          const [topics, recentVideos] = await Promise.all([
            loadTopicCatalog(telegram), getRecentVideos(telegram),
          ]);
          return { topics, recentVideos: selectFields(recentVideos) };
        }
        if (mode === "recent") return selectFields(await getRecentVideos(telegram));
        return selectFields(await getVideosForTopic(telegram, topicId));
      };
      let result;
      if (process.env.TELEGRAM_LOCAL_SERVICE === "true") {
        const { getTelegram } = await import("@/src/telegram/telegramClient");
        result = await run(await getTelegram({ loadVideos: false }));
      } else {
        const { withTelegramSession } = await import("@/src/telegram/withTelegramSession");
        result = await withTelegramSession(run, { loadVideos: false });
      }
      return NextResponse.json(result);
    }

    const listTelegramVideos = (telegram) =>
      telegram.videos.map(
        ({ id, telegramChatId, chatName, name, topicId, topicName }) => ({
          id,
          telegramChatId,
          chatName,
          name,
          topicId,
          topicName,
        }),
      );

    let videos;
    if (process.env.TELEGRAM_LOCAL_SERVICE === "true") {
      const { getTelegram } = await import("@/src/telegram/telegramClient");
      videos = listTelegramVideos(await getTelegram());
    } else {
      const { withTelegramSession } = await import(
        "@/src/telegram/withTelegramSession"
      );
      videos = await withTelegramSession(listTelegramVideos);
    }

    const videosInDatabase = await prisma.video.findMany();

    console.log("✅ Prisma connected!");
    console.log("Videos in database:", videosInDatabase.length);

    return NextResponse.json(videos);
  } catch (error) {
    console.error("Videos API error:", error);

    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: error.status || 500 },
    );
  }
}
