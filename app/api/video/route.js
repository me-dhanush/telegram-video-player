import { getTelegram } from "@/src/telegram/telegramClient";

import { Api } from "teleproto";

const TELEGRAM_CHUNK_SIZE = 1024 * 1024; // 1 MB

const downloadingBlocks = new Map();

async function downloadBlock(
  telegram,
  video,
  messageId,
  blockStart,
  blockSize,
) {
  const key = `${messageId}:${blockStart}`;

  // Someone is already downloading this block
  if (downloadingBlocks.has(key)) {
    return downloadingBlocks.get(key);
  }

  const promise = (async () => {
    const alignedLimit = Math.floor(blockSize / 4096) * 4096;

    if (alignedLimit <= 0) {
      throw new Error("Invalid Telegram block size");
    }

    console.log("📥 Telegram download");
    console.log("Message ID:", messageId);
    console.log("Block:", blockStart);
    console.log("Limit:", alignedLimit);

    let result;

    try {
      // --------------------------------------------------
      // NORMAL DOWNLOAD
      // --------------------------------------------------

      result = await telegram.client.invoke(
        new Api.upload.GetFile({
          location: video.videoLocation,
          offset: blockStart,
          limit: alignedLimit,
          precise: true,
        }),
      );
    } catch (error) {
      // --------------------------------------------------
      // FILE REFERENCE EXPIRED
      // --------------------------------------------------

      if (
        error?.message?.includes("FILE_REFERENCE_EXPIRED") ||
        error?.constructor?.name === "FileReferenceExpiredError"
      ) {
        console.log("⚠️ Telegram file reference expired.");
        console.log("🔄 Refreshing message:", messageId);

        const messages = await telegram.client.getMessages(
          telegram.telegramEntity,
          {
            ids: [messageId],
          },
        );

        const freshMessage = messages?.[0];

        if (
          !freshMessage ||
          !freshMessage.media ||
          !freshMessage.media.document
        ) {
          throw new Error(`Could not refresh video message ${messageId}`);
        }

        // Create a fresh InputDocumentFileLocation
        const freshVideoLocation = telegram.createVideoLocation(freshMessage);

        // Update the in-memory video object too.
        video.videoDocument = freshMessage.media.document;
        video.videoLocation = freshVideoLocation;

        console.log("✅ File reference refreshed.");

        // --------------------------------------------------
        // RETRY DOWNLOAD WITH FRESH REFERENCE
        // --------------------------------------------------

        result = await telegram.client.invoke(
          new Api.upload.GetFile({
            location: freshVideoLocation,
            offset: blockStart,
            limit: alignedLimit,
            precise: true,
          }),
        );
      }

      // --------------------------------------------------
      // TELEGRAM DISCONNECTED
      // --------------------------------------------------
      else if (
        error?.message?.includes("Cannot send requests while disconnected")
      ) {
        console.log("⚠️ Telegram disconnected during download.");
        console.log("🔄 Reconnecting...");

        await telegram.client.connect();

        console.log("✅ Reconnected.");

        result = await telegram.client.invoke(
          new Api.upload.GetFile({
            location: video.videoLocation,
            offset: blockStart,
            limit: alignedLimit,
            precise: true,
          }),
        );
      } else {
        throw error;
      }
    }

    return Buffer.from(result.bytes);
  })();

  downloadingBlocks.set(key, promise);

  try {
    return await promise;
  } finally {
    downloadingBlocks.delete(key);
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url);

    const messageId = Number(url.searchParams.get("messageId"));

    if (!messageId) {
      return new Response("Missing messageId", {
        status: 400,
      });
    }

    const telegram = await getTelegram();

    const video = telegram.videos.find((video) => video.id === messageId);

    if (!video) {
      return new Response("Video not found", {
        status: 404,
      });
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

    // Find which 1 MB Telegram block contains this request
    const blockStart =
      Math.floor(browserStart / TELEGRAM_CHUNK_SIZE) * TELEGRAM_CHUNK_SIZE;

    const blockEnd = Math.min(blockStart + TELEGRAM_CHUNK_SIZE, fileSize);

    const blockSize = blockEnd - blockStart;

    console.log("");

    console.log("🌐 Browser requested video");
    console.log("Message ID:", messageId);
    console.log("Browser start:", browserStart);
    console.log("Telegram block:", `${blockStart} → ${blockEnd - 1}`);

    // --------------------------------------------------
    // DOWNLOAD 1 MB FROM TELEGRAM
    // --------------------------------------------------

    const telegramData = await downloadBlock(
      telegram,
      video,
      messageId,
      blockStart,
      blockSize,
    );

    console.log("✅ Received:", telegramData.length, "bytes");

    // --------------------------------------------------
    // RETURN ONLY WHAT BROWSER REQUESTED
    // --------------------------------------------------

    const offsetInsideBlock = browserStart - blockStart;

    const data = telegramData.subarray(offsetInsideBlock);

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
