import { startTelegram } from "@/src/telegram/telegramClient";
import { Api } from "teleproto";

const TELEGRAM_CHUNK_SIZE = 1024 * 1024; // 1 MB

let telegramPromise = null;

async function getTelegram() {
  if (!telegramPromise) {
    telegramPromise = startTelegram();
  }

  return telegramPromise;
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const messageId = Number(url.searchParams.get("messageId"));

    if (!messageId) {
      return new Response("Missing messageId", { status: 400 });
    }

    const telegram = await getTelegram();

    const video = telegram.videos.find((video) => video.id === messageId);

    if (!video) {
      return new Response("Video not found", { status: 404 });
    }

    const fileSize = Number(video.videoDocument.size);

    const range = request.headers.get("range");

    let browserStart = 0;

    if (range) {
      const match = range.match(/bytes=(\d+)-/);

      if (match) {
        browserStart = Number(match[1]);
      }
    }

    const blockStart =
      Math.floor(browserStart / TELEGRAM_CHUNK_SIZE) * TELEGRAM_CHUNK_SIZE;

    const offsetInsideBlock = browserStart - blockStart;

    const remainingInBlock = TELEGRAM_CHUNK_SIZE - offsetInsideBlock;

    const telegramLimit = Math.min(remainingInBlock, TELEGRAM_CHUNK_SIZE);

    const alignedLimit = Math.floor(telegramLimit / 4096) * 4096;

    if (alignedLimit <= 0) {
      return new Response("Invalid range", { status: 416 });
    }

    console.log("🌐 Browser requested video");
    console.log("Message ID:", messageId);
    console.log("Browser start:", browserStart);
    console.log("Telegram offset:", browserStart);
    console.log("Telegram limit:", alignedLimit);

    const result = await telegram.client.invoke(
      new Api.upload.GetFile({
        location: video.videoLocation,
        offset: browserStart,
        limit: alignedLimit,
        precise: true,
      }),
    );

    const data = Buffer.from(result.bytes);

    console.log("✅ Received:", data.length, "bytes from Telegram");

    const actualEnd = browserStart + data.length - 1;

    return new Response(data, {
      status: 206,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(data.length),
        "Content-Range": `bytes ${browserStart}-${actualEnd}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("❌ Video request failed:");
    console.error(error);

    return new Response("Video request failed", {
      status: 500,
    });
  }
}
