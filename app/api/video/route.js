import {
  ensureTelegramConnected,
  getTelegram,
} from "@/src/telegram/telegramClient";
import { withTelegramSession } from "@/src/telegram/withTelegramSession";
import { Api } from "teleproto";

export const maxDuration = 300;

const TELEGRAM_CHUNK_SIZE = 1024 * 1024; // 1 MB
const MAX_CACHED_BLOCK_BYTES = 32 * 1024 * 1024;

const downloadingBlocks = new Map();
const downloadedBlocks = new Map();
let downloadedBlockBytes = 0;
const fileDcIds = new Map();

function isTransientTelegramConnectionError(error) {
  const message = [error?.message, error?.cause?.message, error?.toString()]
    .filter(Boolean)
    .join(" ");

  return /connection .* (?:lost|closed|timed out)|netsocket.*closed|tcpfull timed out|ping failed|\btimeout\b|cannot send requests while disconnected|failed to reconnect/i.test(
    message,
  );
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function rememberDownloadedBlock(key, data) {
  if (data.length > MAX_CACHED_BLOCK_BYTES) return;

  const previous = downloadedBlocks.get(key);
  if (previous) {
    downloadedBlockBytes -= previous.length;
    downloadedBlocks.delete(key);
  }

  while (downloadedBlockBytes + data.length > MAX_CACHED_BLOCK_BYTES) {
    const oldestKey = downloadedBlocks.keys().next().value;
    if (oldestKey === undefined) break;
    downloadedBlockBytes -= downloadedBlocks.get(oldestKey).length;
    downloadedBlocks.delete(oldestKey);
  }

  downloadedBlocks.set(key, data);
  downloadedBlockBytes += data.length;
}

async function invokeGetFile(telegram, request, fileKey) {
  // Telegram can move a file to another DC. A direct invoke does not
  // automatically follow FILE_MIGRATE, so retry explicitly on that DC.
  let dcId = fileDcIds.get(fileKey);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await telegram.client.invoke(request, dcId);
    } catch (error) {
      if (error?.constructor?.name === "FileMigrateError") {
        if (typeof error.newDc !== "number" || error.newDc === dcId) {
          throw error;
        }

        dcId = error.newDc;
        fileDcIds.set(fileKey, dcId);
        console.log(`🔁 Telegram file is on DC ${dcId}; retrying there.`);
        continue;
      }

      if (!isTransientTelegramConnectionError(error) || attempt === 4) {
        throw error;
      }

      console.warn(
        `⚠️ Telegram connection failed while reading ${fileKey}; retry ${attempt + 1}/4.`,
        error?.message || error,
      );

      if (!telegram.client.connected) {
        await ensureTelegramConnected(telegram.client);
      }

      await wait(500 * 2 ** attempt);
    }
  }

  throw new Error("Telegram file DC migration retries exhausted");
}

async function downloadBlock(
  telegram,
  video,
  messageId,
  blockStart,
  blockSize,
) {
  const key = `${video.telegramChatId}:${messageId}:${video.videoDocument.id}:${blockStart}`;

  const cachedBlock = downloadedBlocks.get(key);
  if (cachedBlock) {
    // Refresh insertion order so frequently used blocks stay in the LRU cache.
    downloadedBlocks.delete(key);
    downloadedBlocks.set(key, cachedBlock);
    return cachedBlock;
  }

  // Someone is already downloading this block
  if (downloadingBlocks.has(key)) {
    return downloadingBlocks.get(key);
  }

  const promise = (async () => {
    // Round the final, partial Telegram block up to the next legal request
    // size. Telegram returns only the bytes that remain in the file.
    const alignedLimit = Math.min(
      TELEGRAM_CHUNK_SIZE,
      Math.ceil(blockSize / 4096) * 4096,
    );

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

      result = await invokeGetFile(
        telegram,
        new Api.upload.GetFile({
          location: video.videoLocation,
          offset: blockStart,
          limit: alignedLimit,
          precise: true,
        }),
        messageId,
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
          video.telegramEntity,
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

        result = await invokeGetFile(
          telegram,
          new Api.upload.GetFile({
            location: freshVideoLocation,
            offset: blockStart,
            limit: alignedLimit,
            precise: true,
          }),
          messageId,
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

        await ensureTelegramConnected(telegram.client);

        console.log("✅ Reconnected.");

        result = await invokeGetFile(
          telegram,
          new Api.upload.GetFile({
            location: video.videoLocation,
            offset: blockStart,
            limit: alignedLimit,
            precise: true,
          }),
          messageId,
        );
      } else {
        throw error;
      }
    }

    return Buffer.from(result.bytes);
  })();

  downloadingBlocks.set(key, promise);

  try {
    const data = await promise;
    rememberDownloadedBlock(key, data);
    return data;
  } finally {
    downloadingBlocks.delete(key);
  }
}

export async function GET(request) {
  try {
    const handleVideoRequest = async (telegram) => {
    const url = new URL(request.url);

    const messageId = Number(url.searchParams.get("messageId"));
    const telegramChatId = url.searchParams.get("telegramChatId");

    if (!messageId) {
      return new Response("Missing messageId", {
        status: 400,
      });
    }

    const video = telegram.videos.find(
      (video) => video.id === messageId && (!telegramChatId || video.telegramChatId === telegramChatId),
    );

    if (!video) {
      return new Response("Video not found", {
        status: 404,
      });
    }

    const fileSize = Number(video.videoDocument.size);
    if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
      return new Response("Invalid video size", { status: 500 });
    }

    const range = request.headers.get("range");

    let browserStart = 0;
    let requestedEnd = fileSize - 1;

    if (range) {
      const match = range.match(/^bytes=(\d*)-(\d*)$/);
      if (!match || (!match[1] && !match[2])) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }

      if (!match[1]) {
        const suffixLength = Number(match[2]);
        if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${fileSize}` },
          });
        }
        browserStart = Math.max(0, fileSize - suffixLength);
      } else {
        browserStart = Number(match[1]);
        requestedEnd = match[2] ? Number(match[2]) : fileSize - 1;
      }
    }

    if (
      !Number.isSafeInteger(browserStart) ||
      !Number.isSafeInteger(requestedEnd) ||
      browserStart < 0 ||
      browserStart >= fileSize ||
      requestedEnd < browserStart
    ) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }
    requestedEnd = Math.min(requestedEnd, fileSize - 1);

    // Find which 1 MB Telegram block contains this request.
    const blockStart =
      Math.floor(browserStart / TELEGRAM_CHUNK_SIZE) * TELEGRAM_CHUNK_SIZE;

    const blockEnd = Math.min(blockStart + TELEGRAM_CHUNK_SIZE, fileSize);

    const blockSize = blockEnd - blockStart;

    console.log("");

    console.log("🌐 Browser requested video");
    console.log("Message ID:", messageId);
    console.log("Browser start:", browserStart);
    console.log("Telegram block:", `${blockStart} → ${blockEnd - 1}`);

    // Keep background prefetch in local single-process mode only. A Vercel
    // request must finish all Telegram work before releasing its shared lock.
    const nextBlockStart = blockEnd;
    if (process.env.TELEGRAM_LOCAL_SERVICE === "true" && nextBlockStart < fileSize) {
      void downloadBlock(
        telegram,
        video,
        messageId,
        nextBlockStart,
        Math.min(TELEGRAM_CHUNK_SIZE, fileSize - nextBlockStart),
      ).catch((error) => {
        console.warn(`Video prefetch failed for message ${messageId}:`, error);
      });
    }

    // --------------------------------------------------
    // DOWNLOAD ONE BLOCK FROM TELEGRAM
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

    const data = telegramData.subarray(
      offsetInsideBlock,
      Math.min(
        telegramData.length,
        offsetInsideBlock + requestedEnd - browserStart + 1,
      ),
    );

    if (data.length === 0) {
      return new Response("Requested video range is unavailable", {
        status: 502,
      });
    }

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
    };

    if (process.env.TELEGRAM_LOCAL_SERVICE === "true") {
      return await handleVideoRequest(await getTelegram());
    }

    return await withTelegramSession(handleVideoRequest);
  } catch (error) {
    console.error("❌ Video request failed:");
    console.error(error);

    if (error.status === 503) {
      return new Response("Telegram is busy. Retry playback shortly.", {
        status: 503,
        headers: { "Retry-After": "2" },
      });
    }

    if (isTransientTelegramConnectionError(error)) {
      return new Response("Telegram is temporarily unavailable. Retry playback shortly.", {
        status: 503,
        headers: { "Retry-After": "2" },
      });
    }

    return new Response("Video request failed", {
      status: 500,
    });
  }
}
