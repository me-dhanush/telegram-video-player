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

    let savedCount = 0;

    for (const video of videos) {
      await prisma.video.upsert({
        where: {
          telegramChatId_messageId: {
            telegramChatId: video.telegramChatId,
            messageId: video.id,
          },
        },
        update: {},
        create: {
          telegramChatId: video.telegramChatId,
          messageId: video.id,
        },
      });

      savedCount++;
    }

    const videosInDatabase = await prisma.video.count();

    console.log("✅ Videos synced!");
    console.log("Videos processed:", savedCount);
    console.log("Videos in database:", videosInDatabase);

    return NextResponse.json({
      success: true,
      videosProcessed: savedCount,
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
