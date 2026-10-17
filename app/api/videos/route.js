import { NextResponse } from "next/server";
import { getTelegram } from "@/src/telegram/telegramClient";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const telegram = await getTelegram();
    const videosInDatabase = await prisma.video.findMany();

    console.log("✅ Prisma connected!");
    console.log("Videos in database:", videosInDatabase.length);

    // Keep Telegram document and file-location credentials on the server.
    // The player only needs these fields to display/select a video and load
    // its notes; /api/video performs the actual stream lookup server-side.
    const videos = telegram.videos.map(
      ({ id, telegramChatId, name, topicId, topicName }) => ({
        id,
        telegramChatId,
        name,
        topicId,
        topicName,
      }),
    );

    return NextResponse.json(videos);
  } catch (error) {
    console.error("Videos API error:", error);

    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 },
    );
  }
}
