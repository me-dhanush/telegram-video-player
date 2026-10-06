import { NextResponse } from "next/server";
import { getTelegram } from "@/src/telegram/telegramClient";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const telegram = await getTelegram();
    const videosInDatabase = await prisma.video.findMany();

    console.log("✅ Prisma connected!");
    console.log("Videos in database:", videosInDatabase.length);

    return NextResponse.json(telegram.videos);
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
