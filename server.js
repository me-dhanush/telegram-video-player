const express = require("express");
const next = require("next");

const { startTelegram } = require("./src/telegram/telegramClient");
const { createVideoStreamHandler } = require("./src/video/videoStream");

require("dotenv").config();

const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const PORT = 3000;

async function main() {
    await nextApp.prepare();

    const app = express();
    const telegram = await startTelegram();

    // Keep the existing Telegram streaming endpoint unchanged.
    app.get("/video", createVideoStreamHandler(telegram));

    // Let Next.js handle the React application.
    app.use((req, res) => handle(req, res));

    app.listen(PORT, () => {
        console.log("");
        console.log("🚀 Next.js lecture player running at:");
        console.log(`http://localhost:${PORT}`);
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
