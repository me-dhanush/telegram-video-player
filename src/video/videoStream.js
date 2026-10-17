const { Api } = require("teleproto");

const TELEGRAM_CHUNK_SIZE = 256 * 1024; // 256 KB
const fileDcIds = new Map();

async function invokeGetFile(client, request, fileKey) {
    let dcId = fileDcIds.get(fileKey);

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await client.invoke(request, dcId);
        } catch (error) {
            if (
                error?.constructor?.name !== "FileMigrateError" ||
                typeof error.newDc !== "number" ||
                error.newDc === dcId
            ) {
                throw error;
            }

            dcId = error.newDc;
            fileDcIds.set(fileKey, dcId);
            console.log(`🔁 Telegram file is on DC ${dcId}; retrying there.`);
        }
    }

    throw new Error("Telegram file DC migration retries exhausted");
}

function createVideoStreamHandler({
    client,
    videoDocument,
    videoLocation,
}) {
    return async function streamVideo(req, res) {
        try {
            if (!videoDocument) {
                return res.status(503).send("Video is not ready yet");
            }

            const fileSize = Number(videoDocument.size);
            if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
                return res.status(500).send("Invalid video size");
            }

            console.log("\n🌐 Browser requested video");
            console.log("Range:", req.headers.range);

            let browserStart = 0;
            let requestedEnd = fileSize - 1;

            if (req.headers.range) {
                const match = req.headers.range.match(/^bytes=(\d*)-(\d*)$/);
                if (!match || (!match[1] && !match[2])) {
                    return res
                        .status(416)
                        .set("Content-Range", `bytes */${fileSize}`)
                        .end();
                }

                if (!match[1]) {
                    const suffixLength = Number(match[2]);
                    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
                        return res
                            .status(416)
                            .set("Content-Range", `bytes */${fileSize}`)
                            .end();
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
                return res
                    .status(416)
                    .set("Content-Range", `bytes */${fileSize}`)
                    .end();
            }
            requestedEnd = Math.min(requestedEnd, fileSize - 1);

            /*
             * Telegram requires each request to stay inside
             * one 256 KB boundary.
             *
             * Example:
             * Browser asks: 8847360-
             * We calculate which 256 KB block contains that position.
             */
            const blockStart =
                Math.floor(browserStart / TELEGRAM_CHUNK_SIZE) *
                TELEGRAM_CHUNK_SIZE;

            const offsetInsideBlock = browserStart - blockStart;
            const remainingInBlock =
                TELEGRAM_CHUNK_SIZE - offsetInsideBlock;
            const telegramLimit = Math.min(
                remainingInBlock,
                TELEGRAM_CHUNK_SIZE
            );

            /* Telegram requires the limit to be divisible by 4096. */
            const alignedLimit =
                Math.ceil(telegramLimit / 4096) * 4096;

            if (alignedLimit <= 0) {
                return res.status(416).send("Invalid range");
            }

            console.log("Browser start:", browserStart);
            console.log("Telegram offset:", browserStart);
            console.log("Telegram limit:", alignedLimit);

            const result = await invokeGetFile(
                client,
                new Api.upload.GetFile({
                    location: videoLocation,
                    offset: browserStart,
                    limit: alignedLimit,
                    precise: true,
                }),
                videoDocument.id.toString()
            );

            const telegramData = Buffer.from(result.bytes);
            const data = telegramData.subarray(
                0,
                Math.min(telegramData.length, requestedEnd - browserStart + 1)
            );

            if (data.length === 0) {
                return res.status(502).send("Requested video range is unavailable");
            }

            console.log("✅ Received:", data.length, "bytes from Telegram");

            const actualEnd = browserStart + data.length - 1;

            res.status(206);
            res.set({
                "Content-Type": "video/mp4",
                "Content-Length": data.length,
                "Content-Range":
                    `bytes ${browserStart}-${actualEnd}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Cache-Control": "no-cache",
            });

            res.end(data);
        } catch (error) {
            console.error("❌ Video request failed:");
            console.error(error);

            if (!res.headersSent) {
                res.status(500).send("Video request failed");
            }
        }
    };
}

module.exports = {
    createVideoStreamHandler,
};
