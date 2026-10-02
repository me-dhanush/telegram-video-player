import { NextResponse } from "next/server";
import { startTelegram } from "@/src/telegram/telegramClient";

let telegramPromise = null;

async function getTelegram() {
  if (!telegramPromise) {
    telegramPromise = startTelegram();
  }

  return telegramPromise;
}

export async function GET() {
  try {
    const telegram = await getTelegram();

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
