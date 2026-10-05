import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startTelegram } from "@/src/telegram/telegramClient";

export async function GET() {
  try {
    const telegram = await startTelegram();

    let savedCount = 0;

    for (const video of telegram.videos) {
      await prisma.video.upsert({
        where: {
          telegramChatId_messageId: {
            telegramChatId: telegram.telegramChatId,
            messageId: video.id,
          },
        },
        update: {},
        create: {
          telegramChatId: telegram.telegramChatId,
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
      { status: 500 },
    );
  }
}
