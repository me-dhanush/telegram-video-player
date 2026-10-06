require("dotenv").config();

const { TelegramClient, Api } = require("teleproto");
const { StringSession } = require("teleproto/sessions");

const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.SESSION);

async function startTelegram() {
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
  console.log("Group ID:", pwClasses.id.toString());

  const forumTopics = await client.invoke(
    new Api.messages.GetForumTopics({
      peer: pwClasses.entity,
      q: "",
      offsetDate: 0,
      offsetId: 0,
      offsetTopic: 0,
      limit: 100,
    }),
  );

  console.log("📚 Forum topics found:", forumTopics.topics.length);

  forumTopics.topics.forEach((topic) => {
    console.log("📁 TOPIC:", topic.id, topic.title);
  });

  const messages = await client.getMessages(pwClasses.entity, { ids: [19] });

  const message = messages[0];

  if (!message || !message.media || !message.media.document) {
    throw new Error("Message 19 does not contain a video");
  }

  const videoDocument = message.media.document;

  console.log("🎥 Video found");
  console.log("Message ID:", message.id);
  console.log("Size:", videoDocument.size.toString());
  console.log("DC:", videoDocument.dcId);

  const videoLocation = new Api.InputDocumentFileLocation({
    id: videoDocument.id,
    accessHash: videoDocument.accessHash,
    fileReference: videoDocument.fileReference,
    thumbSize: "",
  });

function createVideoLocation(message) {
  const document = message.media.document;

  return new Api.InputDocumentFileLocation({
    id: document.id,
    accessHash: document.accessHash,
    fileReference: document.fileReference,
    thumbSize: "",
  });
}

  console.log("✅ Video location ready");

const allMessages = [];

for await (const message of client.iterMessages(pwClasses.entity)) {
  allMessages.push(message);
}

console.log(`📨 Total Telegram messages fetched: ${allMessages.length}`);

const videos = allMessages
  .filter(
    (message) =>
      message &&
      message.media &&
      message.media.document &&
      message.media.document.mimeType &&
      message.media.document.mimeType.startsWith("video/"),
  )
  .map((message) => {
    const topicId = message.replyTo?.replyToMsgId;

    const topic = forumTopics.topics.find((topic) => topic.id === topicId);

    console.log("VIDEO TOPIC:", message.id, topicId, topic?.title);

    return {
      id: message.id,
      name: message.message || `Video ${message.id}`,
      topicId: topicId,
      topicName: topic?.title || `Topic ${topicId}`,
      videoDocument: message.media.document,
      videoLocation: createVideoLocation(message),
    };
  });

  console.log(`🎥 Found ${videos.length} videos in recent messages`);

  return {
    client,
    videoDocument,
    videoLocation,
    videos,
    telegramChatId: pwClasses.id.toString(),
  };
}

let telegramPromise = null;

async function getTelegram() {
  if (!telegramPromise) {
    telegramPromise = startTelegram();
  }

  return telegramPromise;
}

module.exports = {
  startTelegram,
  getTelegram,
};
