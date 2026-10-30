import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

export async function GET() {
  try {
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
