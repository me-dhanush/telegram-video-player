import { getTelegram } from "@/src/telegram/telegramClient";
import { Api } from "teleproto";
import fs from "fs/promises";
import path from "path";

const TELEGRAM_CHUNK_SIZE = 1024 * 1024; // 1 MB

const CACHE_DIR = path.join(process.cwd(), "cache", "videos");

const downloadingBlocks = new Map();

async function downloadBlock(telegram, video, messageId, blockStart, blockSize) {
  const key = `${messageId}:${blockStart}`;

  // Someone is already downloading this block
  if (downloadingBlocks.has(key)) {
    return downloadingBlocks.get(key);
  }

  const promise = (async () => {
    const videoCacheDir = path.join(CACHE_DIR, String(messageId));
    const cacheFile = path.join(videoCacheDir, `${blockStart}.bin`);

    // Check again because another request may have finished it
    try {
      return await fs.readFile(cacheFile);
    } catch {}

    const alignedLimit = Math.floor(blockSize / 4096) * 4096;

    if (alignedLimit <= 0) {
      throw new Error("Invalid Telegram block size");
    }

    console.log("📥 Background/Telegram download");
    console.log("Message ID:", messageId);
    console.log("Block:", blockStart);
    console.log("Limit:", alignedLimit);

    const result = await telegram.client.invoke(
      new Api.upload.GetFile({
        location: video.videoLocation,
        offset: blockStart,
        limit: alignedLimit,
        precise: true,
      }),
    );

    const data = Buffer.from(result.bytes);

    await fs.mkdir(videoCacheDir, {
      recursive: true,
    });

    await fs.writeFile(cacheFile, data);

    console.log("💾 Cached:", blockStart);

    return data;
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

    // Find which 1 MB cache block contains this request
    const blockStart =
      Math.floor(browserStart / TELEGRAM_CHUNK_SIZE) * TELEGRAM_CHUNK_SIZE;

    const blockEnd = Math.min(blockStart + TELEGRAM_CHUNK_SIZE, fileSize);

    const blockSize = blockEnd - blockStart;

    const videoCacheDir = path.join(CACHE_DIR, String(messageId));

    const cacheFile = path.join(videoCacheDir, `${blockStart}.bin`);

    console.log("");
    console.log("🌐 Browser requested video");
    console.log("Message ID:", messageId);
    console.log("Browser start:", browserStart);
    console.log("Cache block:", `${blockStart} → ${blockEnd - 1}`);

    // --------------------------------------------------
    // CACHE HIT
    // --------------------------------------------------

    try {
      const cachedData = await fs.readFile(cacheFile);

      console.log("💾 CACHE HIT");
      console.log("📂 Reading from disk:", cacheFile);
      console.log("📦 Cached bytes:", cachedData.length);

      const offsetInsideBlock = browserStart - blockStart;

      const data = cachedData.subarray(offsetInsideBlock);

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
    } catch {
      // File doesn't exist → continue to Telegram
    }

    // --------------------------------------------------
    // CACHE MISS
    // --------------------------------------------------

    console.log("❌ CACHE MISS");

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

    // --------------------------------------------------
    // PREFETCH NEXT BLOCKS
    // --------------------------------------------------

    const PREFETCH_BLOCKS = 4;

    for (let i = 1; i <= PREFETCH_BLOCKS; i++) {
      const nextBlockStart = blockStart + i * TELEGRAM_CHUNK_SIZE;

      if (nextBlockStart >= fileSize) {
        break;
      }

      const nextBlockSize = Math.min(
        TELEGRAM_CHUNK_SIZE,
        fileSize - nextBlockStart,
      );

      downloadBlock(
        telegram,
        video,
        messageId,
        nextBlockStart,
        nextBlockSize,
      ).catch((error) => {
        console.error(`❌ Prefetch failed for block ${nextBlockStart}:`, error);
      });
    }

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
