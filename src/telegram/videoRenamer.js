// use this to run --> npm run rename-videos -- 20[topics id]


require("dotenv").config();

const { TelegramClient } = require("teleproto");
const { StringSession } = require("teleproto/sessions");

const renameJobs = require("./renameTitles");

const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.SESSION);

async function renameVideos(topicId) {
  const job = renameJobs[topicId];

  if (!job) {
    throw new Error(`No rename configuration found for topic ${topicId}`);
  }

  console.log(`📚 Subject: ${job.subject}`);
  console.log(`📁 Topic ID: ${topicId}`);
  console.log(`📝 Titles: ${job.titles.length}`);

  console.log("Connecting to Telegram...");

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 3,
  });

  await client.connect();

  console.log("✅ Connected to Telegram");

  const dialogs = await client.getDialogs({});

  const pwClasses = dialogs.find((dialog) => dialog.name === "PW Classes");

  if (!pwClasses) {
    throw new Error("Could not find PW Classes");
  }

  console.log("✅ Found PW Classes");

  const allMessages = await client.getMessages(pwClasses.entity, {
    limit: 100,
  });

  const videos = allMessages.filter(
    (message) =>
      message &&
      message.media &&
      message.media.document &&
      message.media.document.mimeType &&
      message.media.document.mimeType.startsWith("video/") &&
      message.replyTo?.replyToMsgId === Number(topicId),
  );

  console.log(`🎥 Found ${videos.length} videos`);

  if (videos.length !== job.titles.length) {
    throw new Error(
      `Video count (${videos.length}) does not match title count (${job.titles.length})`,
    );
  }

  console.log("");
  console.log("========== RENAME MAPPING ==========");

  videos.forEach((video, index) => {
    console.log(`${index + 1}. Message ID: ${video.id}`);
    console.log(`   OLD: ${video.message || `Video ${video.id}`}`);
    console.log(`   NEW: ${job.titles[index]}`);
  });

  console.log("====================================");
  console.log("");

  for (const [index, video] of videos.entries()) {
    const newTitle = job.titles[index];

    console.log(`✏️ Renaming ${video.id}...`);

    await client.editMessage(pwClasses.entity, {
      message: video.id,
      text: newTitle,
    });

    console.log(`   ✅ ${newTitle}`);
  }

  console.log("");
  console.log(`🎉 ${job.subject} renamed successfully!`);

  await client.disconnect();
}

const topicId = process.argv[2];

if (!topicId) {
  console.error(
    "❌ Please provide a topic ID.\n\nExample:\n  npm run rename-videos -- 48",
  );

  process.exit(1);
}

renameVideos(topicId).catch((error) => {
  console.error("❌ Rename failed:", error);

  process.exit(1);
});
