const { Api } = require("teleproto");

const TELEGRAM_CHUNK_SIZE = 1024 * 1024; // 1 MB

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

            console.log("\n🌐 Browser requested video");
            console.log("Range:", req.headers.range);

            let browserStart = 0;

            if (req.headers.range) {
                const match = req.headers.range.match(/bytes=(\d+)-/);

                if (match) {
                    browserStart = Number(match[1]);
                }
            }

            /*
             * Telegram requires each request to stay inside
             * one 1 MB boundary.
             *
             * Example:
             * Browser asks: 8847360-
             * We calculate which 1 MB block contains that position.
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
                Math.floor(telegramLimit / 4096) * 4096;

            if (alignedLimit <= 0) {
                return res.status(416).send("Invalid range");
            }

            console.log("Browser start:", browserStart);
            console.log("Telegram offset:", browserStart);
            console.log("Telegram limit:", alignedLimit);

            const result = await client.invoke(
                new Api.upload.GetFile({
                    location: videoLocation,
                    offset: browserStart,
                    limit: alignedLimit,
                    precise: true,
                })
            );

            const data = Buffer.from(result.bytes);

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
