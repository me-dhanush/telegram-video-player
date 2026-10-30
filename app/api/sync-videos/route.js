import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

export async function GET() {
  try {
    let videos;
    if (process.env.TELEGRAM_LOCAL_SERVICE === "true") {
      const { getTelegram } = await import("@/src/telegram/telegramClient");
      videos = (await getTelegram()).videos;
    } else {
      const { withTelegramSession } = await import(
        "@/src/telegram/withTelegramSession"
      );
      videos = await withTelegramSession((telegram) => telegram.videos);
    }

    const result = await prisma.video.createMany({
      data: videos.map((video) => ({
        telegramChatId: video.telegramChatId,
        messageId: video.id,
      })),
      skipDuplicates: true,
    });

    const videosInDatabase = await prisma.video.count();

    console.log("✅ Videos synced!");
    console.log("New videos added:", result.count);
    console.log("Videos in database:", videosInDatabase);

    return NextResponse.json({
      success: true,
      videosProcessed: videos.length,
      newVideosAdded: result.count,
      videosInDatabase,
    });
  } catch (error) {
    console.error("❌ Video sync failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: error.status || 500 },
    );
  }
}
