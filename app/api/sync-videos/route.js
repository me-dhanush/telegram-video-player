import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTelegram } from "@/src/telegram/telegramClient";

export async function GET() {
  try {
    const telegram = await getTelegram();

    const result = await prisma.video.createMany({
      data: telegram.videos.map((video) => ({
        telegramChatId: telegram.telegramChatId,
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
      videosProcessed: telegram.videos.length,
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
      { status: 500 },
    );
  }
}
