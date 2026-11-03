import { getTelegram, getTelegramThumbnail } from "@/src/telegram/telegramClient";
import { withTelegramSession } from "@/src/telegram/withTelegramSession";

export const maxDuration = 60;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const messageId = Number(searchParams.get("messageId"));
  const telegramChatId = searchParams.get("telegramChatId");

  if (!Number.isSafeInteger(messageId) || messageId <= 0 || !telegramChatId) {
    return new Response("Missing or invalid video identifier", { status: 400 });
  }

  try {
    const readThumbnail = (telegram) =>
      getTelegramThumbnail(telegram, messageId, telegramChatId);
    const thumbnail = process.env.TELEGRAM_LOCAL_SERVICE === "true"
      ? await readThumbnail(await getTelegram({ loadVideos: false }))
      : await withTelegramSession(readThumbnail, { loadVideos: false });

    if (!thumbnail?.bytes?.length) {
      return new Response(null, { status: 404 });
    }

    return new Response(thumbnail.bytes, {
      headers: {
        "Content-Type": thumbnail.mimeType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("Telegram thumbnail request failed:", error);
    return new Response("Thumbnail unavailable", { status: 502 });
  }
}
